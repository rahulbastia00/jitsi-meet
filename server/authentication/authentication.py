from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, AuthenticationFailed


class CookieJWTAuthentication(JWTAuthentication):
    """
    Extends Simple JWT authentication to read access tokens from HttpOnly cookies.
    Falls back to standard Authorization header if no cookie is present.
    """

    def authenticate(self, request):
        cookie_name = getattr(settings, 'AUTH_COOKIE_ACCESS_NAME', 'access_token')
        raw_token = request.COOKIES.get(cookie_name)

        if raw_token:
            try:
                validated_token = self.get_validated_token(raw_token)
                return self.get_user(validated_token), validated_token
            except InvalidToken as exc:
                raise AuthenticationFailed(detail=exc.args[0])

        # Fallback to header authentication (e.g. Bearer <token>)
        return super().authenticate(request)
