import uuid
from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class Meeting(models.Model):
    """
    Representation of an instant or scheduled conference room.
    """
    MEETING_TYPE_CHOICES = [
        ('instant', 'Instant'),
        ('scheduled', 'Scheduled'),
    ]

    STATUS_CHOICES = [
        ('created', 'Created'),
        ('active', 'Active'),
        ('ended', 'Ended'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    org = models.ForeignKey(
        'teams.Organization',
        on_delete=models.CASCADE,
        related_name="meetings",
    )
    host = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="hosted_meetings",
    )
    title = models.CharField(max_length=255, default="Instant Meeting")
    description = models.TextField(blank=True, null=True)
    meeting_type = models.CharField(
        max_length=16,
        choices=MEETING_TYPE_CHOICES,
        default='instant',
    )
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default='created',
        db_index=True,
    )
    allow_guests = models.BooleanField(default=True)
    jitsi_room_name = models.CharField(
        max_length=64,
        unique=True,
        db_index=True,
        help_text=_("Clean alphanumeric/CamelCase identifier for Prosody room."),
    )
    scheduled_start = models.DateTimeField(null=True, blank=True, db_index=True)
    scheduled_end = models.DateTimeField(null=True, blank=True)
    actual_started_at = models.DateTimeField(null=True, blank=True)
    actual_ended_at = models.DateTimeField(null=True, blank=True)
    total_duration_secs = models.IntegerField(default=0)
    invited_teams = models.ManyToManyField(
        'teams.OrganizationTeam',
        blank=True,
        related_name="scheduled_meetings",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = _("meeting")
        verbose_name_plural = _("meetings")
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=['org', 'status']),
            models.Index(fields=['scheduled_start']),
            models.Index(fields=['actual_started_at']),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.jitsi_room_name})"


class MeetingAttendee(models.Model):
    """
    Tracking record for an authenticated user or guest participant in a meeting.
    """
    ROLE_CHOICES = [
        ('host', 'Host'),
        ('moderator', 'Moderator'),
        ('attendee', 'Attendee'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    meeting = models.ForeignKey(
        Meeting,
        on_delete=models.CASCADE,
        related_name="attendees",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="meeting_attendances",
    )
    guest_name = models.CharField(max_length=100, null=True, blank=True)
    guest_email = models.EmailField(null=True, blank=True)
    role = models.CharField(
        max_length=16,
        choices=ROLE_CHOICES,
        default='attendee',
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    left_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.IntegerField(default=0)

    class Meta:
        verbose_name = _("meeting attendee")
        verbose_name_plural = _("meeting attendees")
        ordering = ["joined_at"]
        indexes = [
            models.Index(fields=['meeting', 'user']),
        ]

    def __str__(self) -> str:
        participant = self.user.email if self.user else (self.guest_name or "Guest")
        return f"{participant} in {self.meeting.jitsi_room_name} ({self.role})"
