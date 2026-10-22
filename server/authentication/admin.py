from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    """
    Admin representation for the custom User model.
    """

    ordering = ['email']
    list_display = ['email', 'is_active', 'is_staff', 'is_superuser', 'terms_accepted', 'created_at']
    list_filter = ['is_active', 'is_staff', 'is_superuser', 'terms_accepted']
    search_fields = ['email']
    readonly_fields = ['id', 'created_at', 'updated_at', 'terms_accepted_at']

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Terms'), {'fields': ('terms_accepted', 'terms_accepted_at')}),
        (
            _('Permissions'),
            {
                'fields': (
                    'is_active',
                    'is_staff',
                    'is_superuser',
                    'groups',
                    'user_permissions',
                ),
            },
        ),
        (_('Important dates'), {'fields': ('last_login', 'created_at', 'updated_at')}),
    )

    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'password', 'is_active', 'is_staff', 'is_superuser'),
            },
        ),
    )
