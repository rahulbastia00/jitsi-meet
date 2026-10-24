from django.contrib import admin
from .models import Organization, OrganizationMember, OrganizationTeam


class OrganizationMemberInline(admin.TabularInline):
    model = OrganizationMember
    extra = 0
    fields = [
        'user',
        'team',
        'is_owner',
        'can_create_meeting',
        'can_delete_meeting',
        'can_use_ai',
        'status',
        'joined_at',
    ]
    readonly_fields = ['joined_at']


class OrganizationTeamInline(admin.TabularInline):
    model = OrganizationTeam
    extra = 0
    fields = ['name', 'color_tag', 'created_at']
    readonly_fields = ['created_at']


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'owner', 'created_at']
    search_fields = ['name', 'owner__email']
    list_filter = ['created_at']
    readonly_fields = ['id', 'created_at']
    inlines = [OrganizationTeamInline, OrganizationMemberInline]


@admin.register(OrganizationTeam)
class OrganizationTeamAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'org', 'color_tag', 'created_at']
    search_fields = ['name', 'org__name']
    list_filter = ['org', 'created_at']
    readonly_fields = ['id', 'created_at']


@admin.register(OrganizationMember)
class OrganizationMemberAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'user',
        'org',
        'team',
        'is_owner',
        'can_create_meeting',
        'can_delete_meeting',
        'can_use_ai',
        'status',
        'joined_at',
    ]
    search_fields = ['user__email', 'org__name', 'team__name']
    list_filter = ['status', 'is_owner', 'can_create_meeting', 'can_delete_meeting', 'can_use_ai', 'org']
    readonly_fields = ['id', 'joined_at']
