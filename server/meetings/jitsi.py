import uuid
from datetime import timedelta
from typing import Any, Dict, Optional
from django.conf import settings
from django.utils import timezone
import jwt


def generate_room_name(prefix: str = "Meeting") -> str:
    """
    Generates a clean CamelCase / alphanumeric identifier for Prosody rooms.
    Example: MeetingA1b2C3d4E5f6
    """
    cleaned_prefix = "".join(c for c in prefix if c.isalnum()).capitalize() or "Meeting"
    short_hash = uuid.uuid4().hex[:12].capitalize()
    return f"{cleaned_prefix}{short_hash}"


def generate_jitsi_token(
    user_id: str,
    name: str,
    email: Optional[str],
    room_name: str,
    is_moderator: bool = False,
    expiration_hours: int = 2,
    features: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Constructs and signs a standard Jitsi Prosody JWT according to mod_auth_token specifications.

    Payload Structure:
    {
      "context": {
        "user": {
          "id": "<user_uuid_or_guest_id>",
          "name": "<display_name>",
          "email": "<email_if_available>"
        },
        "features": {
          "livestreaming": false,
          "recording": false
        }
      },
      "aud": "jitsi_meet",
      "iss": "django_backend",
      "sub": "<jitsi_domain>",
      "room": "<jitsi_room_name>",
      "moderator": <true_if_host_or_moderator_else_false>,
      "exp": <expiration_timestamp>
    }
    """
    exp_time = timezone.now() + timedelta(hours=expiration_hours)
    exp_timestamp = int(exp_time.timestamp())

    user_context = {
        "id": str(user_id),
        "name": name or "Guest",
        "email": email or "",
    }

    token_features = features or {
        "livestreaming": False,
        "recording": False,
    }

    jitsi_domain = getattr(settings, 'JITSI_DOMAIN', 'meet.example.com')
    jitsi_issuer = getattr(settings, 'JITSI_APP_ISSUER', 'django_backend')
    jitsi_audience = getattr(settings, 'JITSI_APP_AUDIENCE', 'jitsi_meet')
    jitsi_app_id = getattr(settings, 'JITSI_APP_ID', 'django_app')
    jitsi_secret = getattr(settings, 'JITSI_APP_SECRET', 'your_secure_shared_jwt_secret_change_me')

    payload = {
        "context": {
            "user": user_context,
            "features": token_features,
        },
        "aud": jitsi_audience,
        "iss": jitsi_issuer,
        "sub": jitsi_domain,
        "room": room_name,
        "moderator": bool(is_moderator),
        "exp": exp_timestamp,
    }

    headers = {
        "kid": jitsi_app_id,
        "typ": "JWT",
        "alg": "HS256",
    }

    token = jwt.encode(
        payload,
        jitsi_secret,
        algorithm="HS256",
        headers=headers,
    )

    return token


def decode_jitsi_token(token: str, verify_exp: bool = True) -> Dict[str, Any]:
    """
    Decodes and verifies a Jitsi JWT using the configured JITSI_APP_SECRET.
    """
    jitsi_secret = getattr(settings, 'JITSI_APP_SECRET', 'your_secure_shared_jwt_secret_change_me')
    jitsi_audience = getattr(settings, 'JITSI_APP_AUDIENCE', 'jitsi_meet')

    return jwt.decode(
        token,
        jitsi_secret,
        algorithms=["HS256"],
        audience=jitsi_audience,
        options={"verify_exp": verify_exp},
    )
