import hashlib
import logging
import secrets
from typing import Tuple
from django.conf import settings
from django.http import HttpRequest, HttpResponse
import redis
import resend

logger = logging.getLogger(__name__)

# Constants
OTP_EXPIRATION_SECONDS = 300       # 5 minutes
OTP_THROTTLE_SECONDS = 60          # 60-second cooldown
OTP_MAX_ATTEMPTS = 3               # Maximum failed attempts
TICKET_EXPIRATION_SECONDS = 900    # 15 minutes
IP_OTP_LIMIT = 5                   # Max 5 OTP requests per hour per IP
IP_OTP_WINDOW_SECONDS = 3600       # 1 hour
LOGIN_FAIL_LIMIT_IP = 10           # Max 10 failed logins per 15 min per IP
LOGIN_FAIL_LIMIT_ACCOUNT = 5       # Max 5 failed logins per 15 min per email
LOGIN_WINDOW_SECONDS = 900         # 15 minutes


class RedisServiceUnavailableError(Exception):
    """Raised when Redis cannot be reached or fails to execute a command."""
    pass


class EmailServiceError(Exception):
    """Raised when the email provider fails to send an email."""
    pass


def get_redis_client() -> redis.Redis:
    """
    Returns a configured Redis client instance.
    """
    redis_url = getattr(settings, 'REDIS_URL', 'redis://127.0.0.1:6379/0')
    return redis.Redis.from_url(redis_url)


def get_client_ip(request: HttpRequest) -> str:
    """
    Safely extract the client IP address.
    Only trusts X-Forwarded-For if NUM_PROXIES is greater than 0.
    """
    num_proxies = getattr(settings, 'NUM_PROXIES', 0)
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')

    if num_proxies > 0 and x_forwarded_for:
        parts = [p.strip() for p in x_forwarded_for.split(',') if p.strip()]
        if len(parts) >= num_proxies:
            return parts[-num_proxies]

    return request.META.get('REMOTE_ADDR', '127.0.0.1')


def check_and_increment_ip_otp_ratelimit(client_ip: str) -> bool:
    """
    Rate limits OTP requests by client IP (max 5 per hour).
    Returns True if allowed, False if rate limited.
    """
    try:
        r = get_redis_client()
        key = f"ratelimit:ip:{client_ip}"
        current = r.incr(key)
        if current == 1:
            r.expire(key, IP_OTP_WINDOW_SECONDS)
        return current <= IP_OTP_LIMIT
    except redis.RedisError as exc:
        logger.error("Redis error checking IP rate limit: %s", exc)
        raise RedisServiceUnavailableError("Rate limit service unavailable.") from exc


def is_otp_cooldown_active(normalized_email: str) -> bool:
    """
    Check if a 60-second OTP cooldown is currently active for this email.
    """
    try:
        r = get_redis_client()
        throttle_key = f"otp_throttle:{normalized_email}"
        return bool(r.exists(throttle_key))
    except redis.RedisError as exc:
        logger.error("Redis error checking OTP throttle: %s", exc)
        raise RedisServiceUnavailableError("Authentication service unavailable.") from exc


def generate_and_store_otp(normalized_email: str) -> str:
    """
    Generates a cryptographically secure 6-digit OTP, stores its SHA-256 digest in Redis,
    sets a 5-minute expiration and 60-second resend cooldown. Plaintext OTP is returned
    for dispatch only and is never stored or logged.
    """
    # 6-digit random number between 100000 and 999999
    otp = str(secrets.randbelow(900000) + 100000)
    otp_digest = hashlib.sha256(otp.encode('utf-8')).hexdigest()

    try:
        r = get_redis_client()
        otp_key = f"otp:{normalized_email}"
        throttle_key = f"otp_throttle:{normalized_email}"

        pipeline = r.pipeline()
        pipeline.hset(otp_key, mapping={'digest': otp_digest, 'attempts': 0})
        pipeline.expire(otp_key, OTP_EXPIRATION_SECONDS)
        pipeline.set(throttle_key, '1', ex=OTP_THROTTLE_SECONDS)
        pipeline.execute()
        return otp
    except redis.RedisError as exc:
        logger.error("Redis error storing OTP digest: %s", exc)
        raise RedisServiceUnavailableError("Failed to store verification state.") from exc


def verify_otp_digest(normalized_email: str, input_otp: str) -> Tuple[bool, str, str | None]:
    """
    Verifies input OTP against stored SHA-256 digest in Redis with atomic attempt tracking.
    Returns (success, reason_or_message, verification_ticket_if_successful).
    """
    input_digest = hashlib.sha256(input_otp.encode('utf-8')).hexdigest()
    otp_key = f"otp:{normalized_email}"

    try:
        r = get_redis_client()
        pipe = r.pipeline()

        while True:
            try:
                pipe.watch(otp_key)
                data = pipe.hgetall(otp_key)

                if not data:
                    pipe.unwatch()
                    return False, "Invalid or expired verification code.", None

                stored_digest = data.get(b'digest', b'').decode('utf-8')
                attempts = int(data.get(b'attempts', 0))

                if attempts >= OTP_MAX_ATTEMPTS:
                    pipe.multi()
                    pipe.delete(otp_key)
                    pipe.execute()
                    return False, "Maximum verification attempts exceeded. Please request a new code.", None

                # Constant-time comparison
                matches = secrets.compare_digest(stored_digest, input_digest)

                pipe.multi()
                if matches:
                    pipe.delete(otp_key)
                    # Generate temporary registration ticket valid for 15 minutes
                    ticket = secrets.token_urlsafe(32)
                    ticket_key = f"email_verified:{normalized_email}"
                    pipe.set(ticket_key, ticket, ex=TICKET_EXPIRATION_SECONDS)
                    pipe.execute()
                    return True, "Email verified successfully.", ticket
                else:
                    new_attempts = attempts + 1
                    if new_attempts >= OTP_MAX_ATTEMPTS:
                        pipe.delete(otp_key)
                    else:
                        pipe.hset(otp_key, 'attempts', new_attempts)
                    pipe.execute()
                    remaining = max(0, OTP_MAX_ATTEMPTS - new_attempts)
                    if remaining == 0:
                        return False, "Maximum verification attempts exceeded. Please request a new code.", None
                    return False, f"Invalid verification code. {remaining} attempt(s) remaining.", None
            except redis.WatchError:
                continue

    except redis.RedisError as exc:
        logger.error("Redis error during OTP verification: %s", exc)
        raise RedisServiceUnavailableError("Verification service unavailable.") from exc


def consume_verification_ticket(normalized_email: str, provided_ticket: str) -> bool:
    """
    Atomically validates and consumes the registration verification ticket.
    Returns True if valid and consumed, False otherwise.
    """
    ticket_key = f"email_verified:{normalized_email}"

    try:
        r = get_redis_client()
        pipe = r.pipeline()

        while True:
            try:
                pipe.watch(ticket_key)
                stored_ticket = pipe.get(ticket_key)
                if not stored_ticket:
                    pipe.unwatch()
                    return False

                stored_ticket_str = stored_ticket.decode('utf-8')
                if not secrets.compare_digest(stored_ticket_str, provided_ticket):
                    pipe.unwatch()
                    return False

                pipe.multi()
                pipe.delete(ticket_key)
                pipe.execute()
                return True
            except redis.WatchError:
                continue

    except redis.RedisError as exc:
        logger.error("Redis error consuming verification ticket: %s", exc)
        raise RedisServiceUnavailableError("Registration verification service unavailable.") from exc


def check_and_increment_login_ratelimit(client_ip: str, normalized_email: str) -> bool:
    """
    Checks per-IP and per-account failed login rate limits.
    Returns True if allowed, False if rate-limited.
    """
    try:
        r = get_redis_client()
        ip_key = f"ratelimit:login:ip:{client_ip}"
        email_key = f"ratelimit:login:email:{normalized_email}"

        ip_count = r.get(ip_key)
        if ip_count and int(ip_count) >= LOGIN_FAIL_LIMIT_IP:
            return False

        email_count = r.get(email_key)
        if email_count and int(email_count) >= LOGIN_FAIL_LIMIT_ACCOUNT:
            return False

        return True
    except redis.RedisError as exc:
        logger.error("Redis error checking login rate limit: %s", exc)
        raise RedisServiceUnavailableError("Login rate limit service unavailable.") from exc


def record_failed_login(client_ip: str, normalized_email: str) -> None:
    """
    Records a failed login attempt for the IP and account.
    """
    try:
        r = get_redis_client()
        ip_key = f"ratelimit:login:ip:{client_ip}"
        email_key = f"ratelimit:login:email:{normalized_email}"

        pipe = r.pipeline()
        pipe.incr(ip_key)
        pipe.expire(ip_key, LOGIN_WINDOW_SECONDS)
        pipe.incr(email_key)
        pipe.expire(email_key, LOGIN_WINDOW_SECONDS)
        pipe.execute()
    except redis.RedisError as exc:
        logger.error("Redis error recording failed login: %s", exc)


def reset_failed_login(client_ip: str, normalized_email: str) -> None:
    """
    Resets failed login counters on successful authentication.
    """
    try:
        r = get_redis_client()
        email_key = f"ratelimit:login:email:{normalized_email}"
        r.delete(email_key)
    except redis.RedisError as exc:
        logger.warning("Redis error resetting login rate limit: %s", exc)


def send_otp_email(email: str, otp: str) -> None:
    """
    Dispatches the OTP to the recipient email address using Resend.
    If no API key is set (e.g. local dev / tests), logs simulated delivery.
    """
    api_key = getattr(settings, 'RESEND_API_KEY', None)
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com')

    if not api_key:
        logger.info("RESEND_API_KEY is not configured; simulated email delivery for %s", email)
        return

    try:
        resend.api_key = api_key
        resend.Emails.send({
            'from': from_email,
            'to': [email],
            'subject': 'Your Verification Code',
            'html': (
                f'<p>Your verification code is: <strong>{otp}</strong>.</p>'
                f'<p>This code will expire in 5 minutes. Do not share it with anyone.</p>'
            ),
        })
    except Exception as exc:
        logger.error("Failed to send OTP email via Resend: %s", exc)
        raise EmailServiceError("Failed to deliver verification code.") from exc


def set_auth_cookies(response: HttpResponse, access_token: str, refresh_token: str) -> None:
    """
    Sets secure HttpOnly cookies for access and refresh JWT tokens.
    """
    access_cookie_name = getattr(settings, 'AUTH_COOKIE_ACCESS_NAME', 'access_token')
    refresh_cookie_name = getattr(settings, 'AUTH_COOKIE_REFRESH_NAME', 'refresh_token')
    secure = getattr(settings, 'AUTH_COOKIE_SECURE', True)
    samesite = getattr(settings, 'AUTH_COOKIE_SAMESITE', 'Lax')
    domain = getattr(settings, 'AUTH_COOKIE_DOMAIN', None)
    path_access = getattr(settings, 'AUTH_COOKIE_PATH_ACCESS', '/')
    path_refresh = getattr(settings, 'AUTH_COOKIE_PATH_REFRESH', '/api/auth/')

    # 15 minutes access token cookie
    response.set_cookie(
        key=access_cookie_name,
        value=str(access_token),
        max_age=15 * 60,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path=path_access,
        domain=domain,
    )

    # 7 days refresh token cookie (restricted to /api/auth/ path)
    response.set_cookie(
        key=refresh_cookie_name,
        value=str(refresh_token),
        max_age=7 * 24 * 60 * 60,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path=path_refresh,
        domain=domain,
    )


def delete_auth_cookies(response: HttpResponse) -> None:
    """
    Deletes the access and refresh token cookies upon logout.
    """
    access_cookie_name = getattr(settings, 'AUTH_COOKIE_ACCESS_NAME', 'access_token')
    refresh_cookie_name = getattr(settings, 'AUTH_COOKIE_REFRESH_NAME', 'refresh_token')
    domain = getattr(settings, 'AUTH_COOKIE_DOMAIN', None)
    path_access = getattr(settings, 'AUTH_COOKIE_PATH_ACCESS', '/')
    path_refresh = getattr(settings, 'AUTH_COOKIE_PATH_REFRESH', '/api/auth/')

    response.delete_cookie(access_cookie_name, path=path_access, domain=domain)
    response.delete_cookie(refresh_cookie_name, path=path_refresh, domain=domain)
