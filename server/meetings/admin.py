from django.contrib import admin
from .models import Meeting, MeetingAttendee


class MeetingAttendeeInline(admin.TabularInline):
    model = MeetingAttendee
    extra = 0
    fields = [
        'user',
        'guest_name',
        'guest_email',
        'role',
        'joined_at',
        'left_at',
        'duration_seconds',
    ]
    readonly_fields = ['joined_at', 'left_at', 'duration_seconds']


@admin.register(Meeting)
class MeetingAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'title',
        'jitsi_room_name',
        'meeting_type',
        'status',
        'org',
        'host',
        'scheduled_start',
        'actual_started_at',
        'actual_ended_at',
        'total_duration_secs',
        'created_at',
    ]
    search_fields = ['title', 'jitsi_room_name', 'host__email', 'org__name']
    list_filter = ['meeting_type', 'status', 'allow_guests', 'org', 'created_at']
    readonly_fields = [
        'id',
        'jitsi_room_name',
        'actual_started_at',
        'actual_ended_at',
        'total_duration_secs',
        'created_at',
    ]
    filter_horizontal = ['invited_teams']
    inlines = [MeetingAttendeeInline]


@admin.register(MeetingAttendee)
class MeetingAttendeeAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'meeting',
        'user',
        'guest_name',
        'guest_email',
        'role',
        'joined_at',
        'left_at',
        'duration_seconds',
    ]
    search_fields = [
        'meeting__title',
        'meeting__jitsi_room_name',
        'user__email',
        'guest_name',
        'guest_email',
    ]
    list_filter = ['role', 'joined_at']
    readonly_fields = ['id', 'joined_at', 'left_at', 'duration_seconds']
