import re
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.translation import gettext_lazy as _
from rest_framework import serializers

SPECIAL_CHARACTERS_REGEX = re.compile(r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?]")


class SendOTPSerializer(serializers.Serializer):
    """
    Validates email address for sending registration OTP.
    """
    email = serializers.EmailField()

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class VerifyOTPSerializer(serializers.Serializer):
    """
    Validates email address and 6-digit OTP for verification.
    """
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_otp(self, value: str) -> str:
        if not value.isdigit():
            raise serializers.ValidationError(_('Verification code must contain digits only.'))
        return value


class RegisterSerializer(serializers.Serializer):
    """
    Validates complete registration payload including strong password criteria,
    confirmation match, explicit terms acceptance, and verification ticket.
    """
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    password_confirm = serializers.CharField(write_only=True, min_length=8, max_length=128)
    terms_accepted = serializers.BooleanField(required=True)
    verification_ticket = serializers.CharField(required=True, write_only=True)

    def validate_email(self, value: str) -> str:
        return value.strip().lower()

    def validate_terms_accepted(self, value: bool) -> bool:
        if value is not True:
            raise serializers.ValidationError(_('You must explicitly accept the terms of service to register.'))
        return value

    def validate(self, attrs):
        password = attrs.get('password')
        password_confirm = attrs.get('password_confirm')

        if password != password_confirm:
            raise serializers.ValidationError({'password_confirm': _('Passwords do not match.')})

        # Strong password requirements
        if not any(c.isupper() for c in password):
            raise serializers.ValidationError(
                {'password': _('Password must contain at least one uppercase letter.')}
            )
        if not any(c.islower() for c in password):
            raise serializers.ValidationError(
                {'password': _('Password must contain at least one lowercase letter.')}
            )
        if not any(c.isdigit() for c in password):
            raise serializers.ValidationError(
                {'password': _('Password must contain at least one digit.')}
            )
        if not SPECIAL_CHARACTERS_REGEX.search(password):
            raise serializers.ValidationError(
                {'password': _('Password must contain at least one special character.')}
            )

        # Built-in Django password validation (e.g. common passwords, similarity, etc.)
        try:
            validate_password(password)
        except DjangoValidationError as err:
            raise serializers.ValidationError({'password': list(err.messages)})

        return attrs


class LoginSerializer(serializers.Serializer):
    """
    Validates login credentials.
    """
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate_email(self, value: str) -> str:
        return value.strip().lower()


class UserSerializer(serializers.ModelSerializer):
    """
    Full user profile representation.
    """
    class Meta:
        from django.contrib.auth import get_user_model
        model = get_user_model()
        fields = ['id', 'email', 'first_name', 'last_name', 'created_at', 'terms_accepted']
        read_only_fields = ['id', 'email', 'created_at', 'terms_accepted']


class UpdateProfileSerializer(serializers.Serializer):
    """
    Validates profile updates (first_name, last_name).
    """
    first_name = serializers.CharField(max_length=64, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=64, required=False, allow_blank=True)

