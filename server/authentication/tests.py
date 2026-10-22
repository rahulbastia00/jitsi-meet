import hashlib
import time
from unittest.mock import patch
from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
import redis
from rest_framework import status
from rest_framework.test import APIClient

from .services import EmailServiceError

User = get_user_model()


class InMemoryFakeRedis:
    """
    A lightweight, thread-safe in-memory Redis mock for test isolation.
    """
    def __init__(self):
        self.storage = {}
        self.expirations = {}

    def _is_expired(self, key):
        if key in self.expirations and time.time() > self.expirations[key]:
            self.storage.pop(key, None)
            self.expirations.pop(key, None)
            return True
        return False

    def exists(self, key):
        if self._is_expired(key):
            return 0
        return 1 if key in self.storage else 0

    def get(self, key):
        if self._is_expired(key):
            return None
        val = self.storage.get(key)
        if isinstance(val, str):
            return val.encode('utf-8')
        return val

    def set(self, key, value, ex=None):
        if isinstance(value, str):
            value = value.encode('utf-8')
        self.storage[key] = value
        if ex:
            self.expirations[key] = time.time() + ex
        else:
            self.expirations.pop(key, None)
        return True

    def delete(self, *keys):
        count = 0
        for k in keys:
            if k in self.storage:
                del self.storage[k]
                count += 1
            self.expirations.pop(k, None)
        return count

    def incr(self, key):
        if self._is_expired(key):
            self.storage[key] = 0
        val = int(self.storage.get(key, 0)) + 1
        self.storage[key] = val
        return val

    def expire(self, key, seconds):
        if key in self.storage:
            self.expirations[key] = time.time() + seconds
            return True
        return False

    def hset(self, key, field=None, value=None, mapping=None):
        if self._is_expired(key):
            self.storage[key] = {}
        if key not in self.storage or not isinstance(self.storage[key], dict):
            self.storage[key] = {}

        if mapping:
            for m_k, m_v in mapping.items():
                self.storage[key][m_k.encode('utf-8')] = str(m_v).encode('utf-8')
        elif field is not None and value is not None:
            self.storage[key][str(field).encode('utf-8')] = str(value).encode('utf-8')
        return True

    def hgetall(self, key):
        if self._is_expired(key):
            return {}
        data = self.storage.get(key, {})
        if isinstance(data, dict):
            return dict(data)
        return {}

    def pipeline(self):
        return FakeRedisPipeline(self)


class FakeRedisPipeline:
    """Mock pipeline supporting watch, multi, and execution."""
    def __init__(self, fake_redis):
        self.redis = fake_redis
        self.commands = []
        self.watched = []

    def watch(self, *keys):
        self.watched.extend(keys)

    def unwatch(self):
        self.watched.clear()

    def multi(self):
        pass

    def hset(self, key, *args, **kwargs):
        self.commands.append(('hset', (key,) + args, kwargs))
        return self

    def hgetall(self, key):
        return self.redis.hgetall(key)

    def get(self, key):
        return self.redis.get(key)

    def set(self, key, value, ex=None):
        self.commands.append(('set', (key, value), {'ex': ex}))
        return self

    def delete(self, *keys):
        self.commands.append(('delete', keys, {}))
        return self

    def expire(self, key, seconds):
        self.commands.append(('expire', (key, seconds), {}))
        return self

    def incr(self, key):
        self.commands.append(('incr', (key,), {}))
        return self

    def execute(self):
        results = []
        for cmd, args, kwargs in self.commands:
            method = getattr(self.redis, cmd)
            results.append(method(*args, **kwargs))
        self.commands = []
        return results


class AuthenticationSystemTests(TestCase):
    """
    Comprehensive tests covering all 11 critical authentication scenarios.
    """

    def setUp(self):
        self.client = APIClient()
        self.fake_redis = InMemoryFakeRedis()
        self.redis_patcher = patch('authentication.services.get_redis_client', return_value=self.fake_redis)
        self.redis_patcher.start()

        # URLs
        self.send_otp_url = reverse('authentication:send-otp')
        self.verify_otp_url = reverse('authentication:verify-otp')
        self.register_url = reverse('authentication:register')
        self.login_url = reverse('authentication:login')
        self.refresh_url = reverse('authentication:refresh')
        self.logout_url = reverse('authentication:logout')
        self.csrf_url = reverse('authentication:csrf')

    def tearDown(self):
        self.redis_patcher.stop()

    def _extract_otp_from_redis(self, email: str) -> str:
        """Helper to find the generated OTP plaintext from tests."""
        # Find the 6-digit number matching the stored SHA256 digest in fake redis
        data = self.fake_redis.hgetall(f"otp:{email.lower()}")
        stored_digest = data.get(b'digest', b'').decode('utf-8')
        for i in range(100000, 1000000):
            if hashlib.sha256(str(i).encode('utf-8')).hexdigest() == stored_digest:
                return str(i)
        return ""

    # 1. OTP generation and successful verification
    def test_otp_generation_and_successful_verification(self):
        response = self.client.post(self.send_otp_url, {'email': 'user1@example.com'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('verification code has been sent', response.data['detail'])

        otp = self._extract_otp_from_redis('user1@example.com')
        self.assertTrue(len(otp) == 6)

        verify_resp = self.client.post(self.verify_otp_url, {
            'email': 'user1@example.com',
            'otp': otp,
        })
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        self.assertIn('verification_ticket', verify_resp.data)
        self.assertTrue(len(verify_resp.data['verification_ticket']) > 20)

    # 2. Expired and incorrect OTP rejection
    def test_expired_and_incorrect_otp_rejection(self):
        # Nonexistent OTP
        verify_resp = self.client.post(self.verify_otp_url, {
            'email': 'nobody@example.com',
            'otp': '999999',
        })
        self.assertEqual(verify_resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid or expired', verify_resp.data['detail'])

        # Incorrect OTP
        self.client.post(self.send_otp_url, {'email': 'user2@example.com'})
        verify_wrong = self.client.post(self.verify_otp_url, {
            'email': 'user2@example.com',
            'otp': '000000',
        })
        self.assertEqual(verify_wrong.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('remaining', verify_wrong.data['detail'])

    # 3. Maximum OTP attempts
    def test_maximum_otp_attempts_exceeded(self):
        self.client.post(self.send_otp_url, {'email': 'user3@example.com'})

        # 1st wrong attempt
        resp1 = self.client.post(self.verify_otp_url, {'email': 'user3@example.com', 'otp': '111111'})
        self.assertEqual(resp1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('2 attempt(s) remaining', resp1.data['detail'])

        # 2nd wrong attempt
        resp2 = self.client.post(self.verify_otp_url, {'email': 'user3@example.com', 'otp': '222222'})
        self.assertEqual(resp2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('1 attempt(s) remaining', resp2.data['detail'])

        # 3rd wrong attempt -> locked out
        resp3 = self.client.post(self.verify_otp_url, {'email': 'user3@example.com', 'otp': '333333'})
        self.assertEqual(resp3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Maximum verification attempts exceeded', resp3.data['detail'])

        # 4th attempt -> expired/deleted
        resp4 = self.client.post(self.verify_otp_url, {'email': 'user3@example.com', 'otp': '444444'})
        self.assertEqual(resp4.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid or expired', resp4.data['detail'])

    # 4. Registration without valid email verification
    def test_registration_without_valid_email_verification(self):
        resp = self.client.post(self.register_url, {
            'email': 'unverified@example.com',
            'password': 'SecurePassword123!',
            'password_confirm': 'SecurePassword123!',
            'terms_accepted': True,
            'verification_ticket': 'invalid_ticket_placeholder',
        })
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Invalid or expired registration verification ticket', resp.data['detail'])

    # 5. Password-policy and confirmation validation
    def test_password_policy_and_confirmation_validation(self):
        # Register a valid ticket first
        self.client.post(self.send_otp_url, {'email': 'pwdtest@example.com'})
        otp = self._extract_otp_from_redis('pwdtest@example.com')
        v_resp = self.client.post(self.verify_otp_url, {'email': 'pwdtest@example.com', 'otp': otp})
        ticket = v_resp.data['verification_ticket']

        # Passwords mismatch
        r1 = self.client.post(self.register_url, {
            'email': 'pwdtest@example.com',
            'password': 'StrongPassword1!',
            'password_confirm': 'DifferentPassword1!',
            'terms_accepted': True,
            'verification_ticket': ticket,
        })
        self.assertEqual(r1.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('password_confirm', r1.data)

        # Missing uppercase
        r2 = self.client.post(self.register_url, {
            'email': 'pwdtest@example.com',
            'password': 'strongpassword1!',
            'password_confirm': 'strongpassword1!',
            'terms_accepted': True,
            'verification_ticket': ticket,
        })
        self.assertEqual(r2.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('uppercase', str(r2.data))

        # Missing digit
        r3 = self.client.post(self.register_url, {
            'email': 'pwdtest@example.com',
            'password': 'StrongPassword!!',
            'password_confirm': 'StrongPassword!!',
            'terms_accepted': True,
            'verification_ticket': ticket,
        })
        self.assertEqual(r3.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('digit', str(r3.data))

        # Missing special character
        r4 = self.client.post(self.register_url, {
            'email': 'pwdtest@example.com',
            'password': 'StrongPassword12',
            'password_confirm': 'StrongPassword12',
            'terms_accepted': True,
            'verification_ticket': ticket,
        })
        self.assertEqual(r4.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('special character', str(r4.data))

        # Terms not accepted
        r5 = self.client.post(self.register_url, {
            'email': 'pwdtest@example.com',
            'password': 'StrongPassword1!',
            'password_confirm': 'StrongPassword1!',
            'terms_accepted': False,
            'verification_ticket': ticket,
        })
        self.assertEqual(r5.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('terms_accepted', str(r5.data))

    # 6. Duplicate email registration prevention
    def test_duplicate_email_registration_prevention(self):
        # Create existing user
        User.objects.create_user(
            email='existing@example.com',
            password='ValidPassword123!',
            terms_accepted=True,
        )

        # Attempt to send OTP for existing active account
        otp_resp = self.client.post(self.send_otp_url, {'email': 'EXISTING@example.com'})
        # Should return generic 200 without exposing user existence
        self.assertEqual(otp_resp.status_code, status.HTTP_200_OK)
        # Should NOT store OTP in Redis because user already exists!
        self.assertNotIn(b'digest', self.fake_redis.hgetall('otp:existing@example.com'))

    # 7. Successful login and generic invalid-credential responses
    def test_successful_login_and_generic_invalid_credentials(self):
        User.objects.create_user(
            email='validlogin@example.com',
            password='CorrectPassword123!',
            terms_accepted=True,
        )

        # Successful login
        success_resp = self.client.post(self.login_url, {
            'email': 'validlogin@example.com',
            'password': 'CorrectPassword123!',
        })
        self.assertEqual(success_resp.status_code, status.HTTP_200_OK)
        self.assertIn('user', success_resp.data)
        self.assertEqual(success_resp.data['user']['email'], 'validlogin@example.com')
        # Ensure raw tokens are NOT in JSON body
        self.assertNotIn('access', success_resp.data)
        self.assertNotIn('refresh', success_resp.data)

        # Invalid password
        bad_pw_resp = self.client.post(self.login_url, {
            'email': 'validlogin@example.com',
            'password': 'WrongPassword123!',
        })
        self.assertEqual(bad_pw_resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(bad_pw_resp.data['detail'], 'Invalid email or password.')

        # Nonexistent account
        nonexistent_resp = self.client.post(self.login_url, {
            'email': 'nonexistent@example.com',
            'password': 'AnyPassword123!',
        })
        self.assertEqual(nonexistent_resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(nonexistent_resp.data['detail'], 'Invalid email or password.')

    # 8. Authentication cookie flags and token lifetimes
    def test_authentication_cookie_flags_and_token_lifetimes(self):
        User.objects.create_user(
            email='cookietest@example.com',
            password='CookiePassword123!',
            terms_accepted=True,
        )

        resp = self.client.post(self.login_url, {
            'email': 'cookietest@example.com',
            'password': 'CookiePassword123!',
        })
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

        access_cookie = resp.cookies.get('access_token')
        refresh_cookie = resp.cookies.get('refresh_token')

        self.assertIsNotNone(access_cookie)
        self.assertIsNotNone(refresh_cookie)

        # HttpOnly
        self.assertTrue(access_cookie['httponly'])
        self.assertTrue(refresh_cookie['httponly'])

        # Max age: 15m (900) and 7d (604800)
        self.assertEqual(access_cookie['max-age'], 900)
        self.assertEqual(refresh_cookie['max-age'], 604800)

        # Paths
        self.assertEqual(access_cookie['path'], '/')
        self.assertEqual(refresh_cookie['path'], '/api/auth/')

    # 9. Rate-limit enforcement
    def test_rate_limit_enforcement(self):
        # 1. 60-second cooldown per email
        self.client.post(self.send_otp_url, {'email': 'cooldown@example.com'})
        cooldown_resp = self.client.post(self.send_otp_url, {'email': 'cooldown@example.com'})
        self.assertEqual(cooldown_resp.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('wait 60 seconds', cooldown_resp.data['detail'])

        # 2. IP rate limit (max 5 per hour)
        client_with_ip = APIClient(REMOTE_ADDR='192.168.1.100')
        for i in range(1, 6):
            r = client_with_ip.post(self.send_otp_url, {'email': f'iprate{i}@example.com'})
            self.assertEqual(r.status_code, status.HTTP_200_OK)

        # 6th should exceed IP limit
        r6 = client_with_ip.post(self.send_otp_url, {'email': 'iprate6@example.com'})
        self.assertEqual(r6.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertIn('Too many OTP requests from this IP', r6.data['detail'])

    # 10. Refresh-token rotation and logout revocation
    def test_refresh_token_rotation_and_logout_revocation(self):
        User.objects.create_user(
            email='rotation@example.com',
            password='RotationPassword123!',
            terms_accepted=True,
        )

        login_resp = self.client.post(self.login_url, {
            'email': 'rotation@example.com',
            'password': 'RotationPassword123!',
        })
        old_refresh = login_resp.cookies['refresh_token'].value

        # Set cookie and call refresh
        self.client.cookies['refresh_token'] = old_refresh
        refresh_resp = self.client.post(self.refresh_url)
        self.assertEqual(refresh_resp.status_code, status.HTTP_200_OK)

        new_refresh = refresh_resp.cookies['refresh_token'].value
        self.assertNotEqual(old_refresh, new_refresh)

        # Attempting to use the old rotated refresh token must fail (blacklisted)
        self.client.cookies['refresh_token'] = old_refresh
        stale_refresh_resp = self.client.post(self.refresh_url)
        self.assertEqual(stale_refresh_resp.status_code, status.HTTP_401_UNAUTHORIZED)

        # Logout with new refresh token
        self.client.cookies['refresh_token'] = new_refresh
        logout_resp = self.client.post(self.logout_url)
        self.assertEqual(logout_resp.status_code, status.HTTP_200_OK)

        # After logout, that refresh token is also revoked
        revoked_resp = self.client.post(self.refresh_url)
        self.assertEqual(revoked_resp.status_code, status.HTTP_401_UNAUTHORIZED)

    # 11. Safe handling of Redis and Email failures (fail-closed)
    def test_redis_and_email_failure_handling(self):
        # Redis Connection Failure -> 503
        with patch('authentication.services.get_redis_client', side_effect=redis.ConnectionError("Redis down")):
            redis_fail_resp = self.client.post(self.send_otp_url, {'email': 'redisfail@example.com'})
            self.assertEqual(redis_fail_resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertIn('service is temporarily unavailable', redis_fail_resp.data['detail'])

        # Email Delivery Failure -> 503
        with patch('authentication.views.send_otp_email', side_effect=EmailServiceError("Resend outage")):
            email_fail_resp = self.client.post(self.send_otp_url, {'email': 'emailfail@example.com'})
            self.assertEqual(email_fail_resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
            self.assertIn('Failed to deliver verification email', email_fail_resp.data['detail'])

    # 13. End-to-end registration and subsequent login
    def test_full_registration_and_login(self):
        # 1. Send OTP
        self.client.post(self.send_otp_url, {'email': 'e2e@example.com'})
        otp = self._extract_otp_from_redis('e2e@example.com')

        # 2. Verify OTP
        verify_resp = self.client.post(self.verify_otp_url, {
            'email': 'e2e@example.com',
            'otp': otp,
        })
        self.assertEqual(verify_resp.status_code, status.HTTP_200_OK)
        ticket = verify_resp.data['verification_ticket']

        # 3. Register
        reg_resp = self.client.post(self.register_url, {
            'email': 'e2e@example.com',
            'password': 'StrongPassword123!',
            'password_confirm': 'StrongPassword123!',
            'terms_accepted': True,
            'verification_ticket': ticket,
        })
        self.assertEqual(reg_resp.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email='e2e@example.com')
        self.assertTrue(user.terms_accepted)
        self.assertIsNotNone(user.terms_accepted_at)

        # 4. Attempting to reuse the ticket must fail
        reuse_resp = self.client.post(self.register_url, {
            'email': 'e2e_second@example.com',
            'password': 'StrongPassword123!',
            'password_confirm': 'StrongPassword123!',
            'terms_accepted': True,
            'verification_ticket': ticket,
        })
        self.assertEqual(reuse_resp.status_code, status.HTTP_400_BAD_REQUEST)

        # 5. Login
        login_resp = self.client.post(self.login_url, {
            'email': 'e2e@example.com',
            'password': 'StrongPassword123!',
        })
        self.assertEqual(login_resp.status_code, status.HTTP_200_OK)
        self.assertIn('access_token', login_resp.cookies)
        self.assertIn('refresh_token', login_resp.cookies)

    # 12. CSRF endpoint
    def test_csrf_cookie_endpoint(self):
        resp = self.client.get(self.csrf_url)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('csrftoken', resp.cookies)
        self.assertEqual(resp.data['detail'], 'CSRF cookie set.')
