import uuid
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.db.models.functions import Lower
from django.utils.translation import gettext_lazy as _

from .managers import CustomUserManager


class User(AbstractBaseUser, PermissionsMixin):
    """
    Custom user model using UUID as primary key and email as the unique login identifier.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text=_('Unique identifier for this user.'),
    )
    email = models.EmailField(
        _('email address'),
        unique=True,
        max_length=255,
        help_text=_('Primary email address used for login and notifications.'),
    )
    first_name = models.CharField(
        _('first name'),
        max_length=64,
        blank=True,
        default="",
        help_text=_('User first name.'),
    )
    last_name = models.CharField(
        _('last name'),
        max_length=64,
        blank=True,
        default="",
        help_text=_('User last name.'),
    )
    terms_accepted = models.BooleanField(
        _('terms accepted'),
        default=False,
        help_text=_('Designates whether the user accepted the terms of service.'),
    )
    terms_accepted_at = models.DateTimeField(
        _('terms accepted at'),
        null=True,
        blank=True,
        help_text=_('Timestamp recording when terms were explicitly accepted.'),
    )
    is_active = models.BooleanField(
        _('active'),
        default=True,
        help_text=_('Designates whether this user should be treated as active.'),
    )
    is_staff = models.BooleanField(
        _('staff status'),
        default=False,
        help_text=_('Designates whether the user can log into this admin site.'),
    )
    is_superuser = models.BooleanField(
        _('superuser status'),
        default=False,
        help_text=_('Designates whether this user has all permissions without explicitly assigning them.'),
    )
    created_at = models.DateTimeField(
        _('created at'),
        auto_now_add=True,
        help_text=_('Timestamp when the user account was created.'),
    )
    updated_at = models.DateTimeField(
        _('updated at'),
        auto_now=True,
        help_text=_('Timestamp when the user record was last modified.'),
    )

    objects = CustomUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = _('user')
        verbose_name_plural = _('users')
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                Lower('email'),
                name='unique_lower_email',
                violation_error_message=_('A user with that email already exists.'),
            )
        ]

    def __str__(self) -> str:
        return self.email
