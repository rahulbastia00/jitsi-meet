from django.utils import timezone
from rest_framework import serializers

from teams.serializers import OrganizationTeamSerializer, UserBasicSerializer
from .models import Meeting, MeetingAttendee


class MeetingAttendeeSerializer(serializers.ModelSerializer):
    """
    Serializer for meeting participants/attendees.
    """
    user = UserBasicSerializer(read_only=True)

    class Meta:
        model = MeetingAttendee
        fields = [
            'id',
            'user',
            'guest_name',
            'guest_email',
            'role',
            'joined_at',
            'left_at',
            'duration_seconds',
        ]
        read_only_fields = ['id', 'user', 'joined_at', 'left_at', 'duration_seconds']


class MeetingSerializer(serializers.ModelSerializer):
    """
    Full serializer for meetings including host details, invited teams, and attendees.
    """
    host = UserBasicSerializer(read_only=True)
    invited_teams = OrganizationTeamSerializer(many=True, read_only=True)
    attendees = MeetingAttendeeSerializer(many=True, read_only=True)

    class Meta:
        model = Meeting
        fields = [
            'id',
            'org',
            'host',
            'title',
            'description',
            'meeting_type',
            'status',
            'allow_guests',
            'jitsi_room_name',
            'scheduled_start',
            'scheduled_end',
            'actual_started_at',
            'actual_ended_at',
            'total_duration_secs',
            'invited_teams',
            'created_at',
            'attendees',
        ]
        read_only_fields = [
            'id',
            'host',
            'status',
            'jitsi_room_name',
            'actual_started_at',
            'actual_ended_at',
            'total_duration_secs',
            'created_at',
            'attendees',
        ]


class CreateInstantMeetingSerializer(serializers.Serializer):
    """
    Validates creation parameters for an instant meeting.
    """
    title = serializers.CharField(required=False, allow_blank=True, max_length=255, default="Instant Meeting")
    allow_guests = serializers.BooleanField(required=False, default=True)
    org_id = serializers.UUIDField(required=False, allow_null=True)


class CreateScheduledMeetingSerializer(serializers.Serializer):
    """
    Validates creation parameters for a scheduled meeting, ensuring strict UTC order.
    """
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    scheduled_start = serializers.DateTimeField()
    scheduled_end = serializers.DateTimeField()
    team_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )
    allow_guests = serializers.BooleanField(required=False, default=True)
    org_id = serializers.UUIDField(required=False, allow_null=True)

    def validate(self, attrs):
        start = attrs.get('scheduled_start')
        end = attrs.get('scheduled_end')

        if start and end:
            if timezone.is_naive(start) or timezone.is_naive(end):
                raise serializers.ValidationError("Timestamps must be timezone-aware UTC timestamps.")
            if start >= end:
                raise serializers.ValidationError({"scheduled_end": "scheduled_start must be before scheduled_end."})

        return attrs


class JoinMeetingSerializer(serializers.Serializer):
    """
    Validates payload when joining a meeting (optional for authenticated, required for guests).
    """
    guest_name = serializers.CharField(required=False, allow_blank=True, max_length=100)
    guest_email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)


class KPIOverviewSerializer(serializers.Serializer):
    """
    Serializer for workspace-level meeting analytics and KPIs.
    """
    total_meetings_conducted = serializers.IntegerField()
    total_meeting_minutes = serializers.IntegerField()
    active_rooms_count = serializers.IntegerField()
