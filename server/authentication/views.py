import logging
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.db import transaction
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from .serializers import (
    SendOTPSerializer,
    VerifyOTPSerializer,
    RegisterSerializer,
    LoginSerializer,
    UserSerializer,
    UpdateProfileSerializer,
)
from .services import (
    RedisServiceUnavailableError,
    EmailServiceError,
    get_client_ip,
    check_and_increment_ip_otp_ratelimit,
    is_otp_cooldown_active,
    generate_and_store_otp,
    verify_otp_digest,
    consume_verification_ticket,
    check_and_increment_login_ratelimit,
    record_failed_login,
    reset_failed_login,
    send_otp_email,
    set_auth_cookies,
    delete_auth_cookies,
)

logger = logging.getLogger(__name__)
User = get_user_model()

# Pre-computed dummy password hash for timing attack mitigation on login
DUMMY_PASSWORD_HASH = (
    'pbkdf2_sha256$870000$dummySaltPlaceholder$dummyHashedPasswordStringWithHighWorkFactor0000000000='
)


class SendOTPView(APIView):
    """
    POST /api/auth/send-otp/
    Request a registration OTP to be sent to the given email address.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        client_ip = get_client_ip(request)

        try:
            # 1. Enforce IP rate limiting (max 5 per hour)
            if not check_and_increment_ip_otp_ratelimit(client_ip):
                return Response(
                    {'detail': 'Too many OTP requests from this IP address. Please try again later.'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            # 2. Enforce 60-second cooldown per normalized email
            if is_otp_cooldown_active(email):
                return Response(
                    {'detail': 'Please wait 60 seconds before requesting another verification code.'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            # 3. Check if user already exists (generic response to prevent account enumeration)
            if User.objects.filter(email__iexact=email, is_active=True).exists():
                return Response(
                    {'detail': 'If the email is eligible, a verification code has been sent.'},
                    status=status.HTTP_200_OK,
                )

            # 4. Generate OTP, store digest in Redis, and dispatch email
            otp = generate_and_store_otp(email)
            send_otp_email(email, otp)

            return Response(
                {'detail': 'If the email is eligible, a verification code has been sent.'},
                status=status.HTTP_200_OK,
            )

        except RedisServiceUnavailableError:
            return Response(
                {'detail': 'Authentication service is temporarily unavailable. Please try again later.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except EmailServiceError:
            return Response(
                {'detail': 'Failed to deliver verification email. Please try again later.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class VerifyOTPView(APIView):
    """
    POST /api/auth/verify-otp/
    Verify OTP with atomic attempt tracking and issue a temporary registration verification ticket.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        otp = serializer.validated_data['otp']

        try:
            success, message, ticket = verify_otp_digest(email, otp)
            if not success:
                return Response({'detail': message}, status=status.HTTP_400_BAD_REQUEST)

            return Response(
                {
                    'detail': message,
                    'verification_ticket': ticket,
                },
                status=status.HTTP_200_OK,
            )
        except RedisServiceUnavailableError:
            return Response(
                {'detail': 'Verification service is temporarily unavailable. Please try again later.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class RegisterView(APIView):
    """
    POST /api/auth/register/
    Create a new user account verifying ticket, password policy, and email uniqueness.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        ticket = serializer.validated_data['verification_ticket']

        try:
            # 1. Atomically consume the verification ticket
            if not consume_verification_ticket(email, ticket):
                return Response(
                    {'detail': 'Invalid or expired registration verification ticket.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # 2. Create the user inside a database transaction to prevent concurrent duplicate creation
            with transaction.atomic():
                if User.objects.filter(email__iexact=email).exists():
                    return Response(
                        {'detail': 'An account with this email address already exists.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                first_name = serializer.validated_data.get('first_name', '').strip()
                last_name = serializer.validated_data.get('last_name', '').strip()
                User.objects.create_user(
                    email=email,
                    password=password,
                    first_name=first_name,
                    last_name=last_name,
                    terms_accepted=True,
                    terms_accepted_at=timezone.now(),
                )

            return Response(
                {'detail': 'Account registered successfully.'},
                status=status.HTTP_201_CREATED,
            )

        except RedisServiceUnavailableError:
            return Response(
                {'detail': 'Registration service is temporarily unavailable. Please try again later.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class LoginView(APIView):
    """
    POST /api/auth/login/
    Authenticate user, enforce rate limits, and set HttpOnly JWT access/refresh cookies.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        client_ip = get_client_ip(request)

        try:
            # 1. Enforce login rate limits (IP and account)
            if not check_and_increment_login_ratelimit(client_ip, email):
                return Response(
                    {'detail': 'Too many failed login attempts. Please try again later.'},
                    status=status.HTTP_429_TOO_MANY_REQUESTS,
                )

            # 2. Look up user; perform dummy hashing if user does not exist to mitigate timing attacks
            try:
                user = User.objects.get(email__iexact=email)
            except User.DoesNotExist:
                user = None

            if user is None or not user.is_active or not user.check_password(password):
                if user is None:
                    # Constant-time mitigation
                    User().set_password(password)
                record_failed_login(client_ip, email)
                return Response(
                    {'detail': 'Invalid email or password.'},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # 3. Successful authentication: reset rate limits and update last login
            reset_failed_login(client_ip, email)
            update_last_login(None, user)

            # 4. Generate Simple JWT tokens
            refresh = RefreshToken.for_user(user)
            access = refresh.access_token

            response = Response(
                {
                    'detail': 'Login successful.',
                    'user': {
                        'id': str(user.id),
                        'email': user.email,
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                    },
                },
                status=status.HTTP_200_OK,
            )

            # 5. Set HttpOnly secure cookies (do not expose raw JWT in JSON body)
            set_auth_cookies(response, str(access), str(refresh))
            return response

        except RedisServiceUnavailableError:
            return Response(
                {'detail': 'Login service is temporarily unavailable. Please try again later.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


class RefreshTokenView(APIView):
    """
    POST /api/auth/refresh/
    Reads refresh token from HttpOnly cookie, performs rotation and revocation,
    and updates the cookies with the new token pair.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_cookie_name = getattr(settings, 'AUTH_COOKIE_REFRESH_NAME', 'refresh_token')
        raw_refresh = request.COOKIES.get(refresh_cookie_name)

        if not raw_refresh:
            return Response(
                {'detail': 'Refresh token cookie is missing.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            refresh = RefreshToken(raw_refresh)

            # If token rotation is enabled, blacklist old and generate new JTI
            if api_settings.ROTATE_REFRESH_TOKENS:
                if api_settings.BLACKLIST_AFTER_ROTATION:
                    try:
                        refresh.blacklist()
                    except AttributeError:
                        pass
                refresh.set_jti()
                refresh.set_exp()
                refresh.set_iat()

            new_access = str(refresh.access_token)
            new_refresh = str(refresh)

            response = Response(
                {'detail': 'Token refreshed successfully.'},
                status=status.HTTP_200_OK,
            )

            set_auth_cookies(response, new_access, new_refresh)
            return response

        except TokenError as exc:
            # Clear invalid/blacklisted cookies
            response = Response(
                {'detail': 'Invalid, expired, or revoked refresh token.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            delete_auth_cookies(response)
            return response


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Revokes the refresh token and clears the authentication cookies.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_cookie_name = getattr(settings, 'AUTH_COOKIE_REFRESH_NAME', 'refresh_token')
        raw_refresh = request.COOKIES.get(refresh_cookie_name)

        if raw_refresh:
            try:
                token = RefreshToken(raw_refresh)
                token.blacklist()
            except Exception:
                # Even if token is already expired/blacklisted, proceed with deleting cookies
                pass

        response = Response(
            {'detail': 'Logout successful.'},
            status=status.HTTP_200_OK,
        )
        delete_auth_cookies(response)
        return response


class CSRFTokenView(APIView):
    """
    GET /api/auth/csrf/
    Ensures a CSRF cookie is set on the client for safe interaction with state-changing endpoints.
    """
    permission_classes = [AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        return Response(
            {'detail': 'CSRF cookie set.'},
            status=status.HTTP_200_OK,
        )


class MeProfileView(APIView):
    """
    GET /api/auth/me/
    PATCH /api/auth/me/
    Retrieve and update profile details for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request):
        serializer = UpdateProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if 'first_name' in serializer.validated_data:
            user.first_name = serializer.validated_data['first_name'].strip()
        if 'last_name' in serializer.validated_data:
            user.last_name = serializer.validated_data['last_name'].strip()
        user.save(update_fields=['first_name', 'last_name'])
        return Response(UserSerializer(user).data, status=status.HTTP_200_OK)

