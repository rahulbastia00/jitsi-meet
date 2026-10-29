import calendar
from datetime import datetime
from datetime import timezone as dt_timezone
import logging
from django.conf import settings
from django.db import transaction
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from teams.models import Organization, OrganizationMember, OrganizationTeam
from .jitsi import generate_jitsi_token, generate_room_name
from .models import Meeting, MeetingAttendee
from .serializers import (
    CreateInstantMeetingSerializer,
    CreateScheduledMeetingSerializer,
    JoinMeetingSerializer,
    KPIOverviewSerializer,
    MeetingSerializer,
)

logger = logging.getLogger(__name__)


class InstantMeetingCreateView(APIView):
    """
    POST /api/meetings/instant/
    Creates an instant meeting session, assigns host, sets active state,
    and returns meeting metadata, room slug, and the Host's signed Jitsi JWT.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateInstantMeetingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        org_id = validated_data.get('org_id')
        if org_id:
            membership = OrganizationMember.objects.filter(
                org_id=org_id,
                user=request.user,
                status='active',
            ).select_related('org').first()
        else:
            membership = OrganizationMember.objects.filter(
                user=request.user,
                status='active',
                can_create_meeting=True,
            ).select_related('org').first()
            if not membership:
                # Fallback to any active membership to check permission explicitly
                membership = OrganizationMember.objects.filter(
                    user=request.user,
                    status='active',
                ).select_related('org').first()

        if not membership and not request.user.is_superuser:
            return Response(
                {"error": "User does not belong to any active organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not request.user.is_superuser and (not membership or not membership.can_create_meeting):
            return Response(
                {"error": "User does not have permission to create meetings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        org = membership.org if membership else Organization.objects.first()
        title = validated_data.get('title') or "Instant Meeting"
        allow_guests = validated_data.get('allow_guests', True)

        # Generate unique clean CamelCase Prosody room name
        room_name = generate_room_name("Instant")
        while Meeting.objects.filter(jitsi_room_name=room_name).exists():
            room_name = generate_room_name("Instant")

        now = timezone.now()

        with transaction.atomic():
            meeting = Meeting.objects.create(
                org=org,
                host=request.user,
                title=title,
                meeting_type='instant',
                status='active',
                allow_guests=allow_guests,
                jitsi_room_name=room_name,
                actual_started_at=now,
            )

            # Record host as meeting attendee
            MeetingAttendee.objects.create(
                meeting=meeting,
                user=request.user,
                role='host',
                joined_at=now,
            )

        # Generate Host's signed Jitsi JWT (is_moderator=True)
        host_token = generate_jitsi_token(
            user_id=str(request.user.id),
            name=request.user.email,
            email=request.user.email,
            room_name=meeting.jitsi_room_name,
            is_moderator=True,
            expiration_hours=2,
        )

        response_data = {
            "meeting": MeetingSerializer(meeting).data,
            "room_name": meeting.jitsi_room_name,
            "token": host_token,
            "domain": getattr(settings, 'JITSI_DOMAIN', 'meet.example.com'),
        }

        return Response(response_data, status=status.HTTP_201_CREATED)


class ScheduledMeetingCreateView(APIView):
    """
    POST /api/meetings/scheduled/
    Validates UTC timestamps, ensures scheduled_start < scheduled_end, and links selected teams.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateScheduledMeetingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        org_id = validated_data.get('org_id')
        if org_id:
            membership = OrganizationMember.objects.filter(
                org_id=org_id,
                user=request.user,
                status='active',
            ).select_related('org').first()
        else:
            membership = OrganizationMember.objects.filter(
                user=request.user,
                status='active',
                can_create_meeting=True,
            ).select_related('org').first()
            if not membership:
                membership = OrganizationMember.objects.filter(
                    user=request.user,
                    status='active',
                ).select_related('org').first()

        if not membership and not request.user.is_superuser:
            return Response(
                {"error": "User does not belong to any active organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not request.user.is_superuser and (not membership or not membership.can_create_meeting):
            return Response(
                {"error": "User does not have permission to create meetings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        org = membership.org if membership else Organization.objects.first()

        team_ids = validated_data.get('team_ids', [])
        teams = []
        if team_ids:
            teams = list(OrganizationTeam.objects.filter(org=org, id__in=team_ids))
            if len(teams) != len(team_ids):
                return Response(
                    {"error": "One or more invited teams do not belong to this organization."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        room_name = generate_room_name("Scheduled")
        while Meeting.objects.filter(jitsi_room_name=room_name).exists():
            room_name = generate_room_name("Scheduled")

        with transaction.atomic():
            meeting = Meeting.objects.create(
                org=org,
                host=request.user,
                title=validated_data['title'],
                description=validated_data.get('description', ''),
                meeting_type='scheduled',
                status='created',
                allow_guests=validated_data.get('allow_guests', True),
                jitsi_room_name=room_name,
                scheduled_start=validated_data['scheduled_start'],
                scheduled_end=validated_data['scheduled_end'],
            )

            if teams:
                meeting.invited_teams.set(teams)

        return Response(MeetingSerializer(meeting).data, status=status.HTTP_201_CREATED)


class JoinMeetingView(APIView):
    """
    POST /api/meetings/{room_name}/join/
    Handles both authenticated users and guests:
    - Authenticated: Reads user profile, checks org membership, sets moderator=True if host or owner.
    - Guest: Requires { "guest_name": "Jane Doe" }. Checks allow_guests flag. If False, returns 403.
    - Enforce Concluded Meeting Lockdown: If meeting status == 'ended', returns HTTP 410 Gone.
    - Concurrency Safe: Uses select_for_update() inside a transaction.
    """
    permission_classes = [AllowAny]

    def post(self, request, room_name):
        serializer = JoinMeetingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        with transaction.atomic():
            # Concurrency safeguard: select_for_update locks the meeting row
            meeting = (
                Meeting.objects.select_for_update()
                .filter(jitsi_room_name=room_name)
                .select_related('org', 'host')
                .first()
            )

            if not meeting:
                return Response(
                    {"error": "Meeting room not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            # Concluded Meeting Lockdown: If status == 'ended', return 410 Gone
            if meeting.status == 'ended':
                return Response(
                    {"error": "This meeting has already ended."},
                    status=status.HTTP_410_GONE,
                )

            now = timezone.now()

            # Handle Authenticated User vs Guest
            if request.user.is_authenticated:
                user = request.user
                is_host = (meeting.host_id == user.id)

                membership = OrganizationMember.objects.filter(
                    org=meeting.org,
                    user=user,
                    status='active',
                ).first()

                is_org_owner = bool(membership and membership.is_owner)
                is_moderator = is_host or is_org_owner

                if is_host:
                    role = 'host'
                elif is_org_owner:
                    role = 'moderator'
                else:
                    role = 'attendee'

                # If scheduled/created meeting and host joins, mark active
                if meeting.status == 'created' and is_host:
                    meeting.status = 'active'
                    if not meeting.actual_started_at:
                        meeting.actual_started_at = now
                    meeting.save(update_fields=['status', 'actual_started_at'])

                # Record or update attendee
                attendee = MeetingAttendee.objects.filter(
                    meeting=meeting,
                    user=user,
                    left_at__isnull=True,
                ).first()

                if not attendee:
                    attendee = MeetingAttendee.objects.create(
                        meeting=meeting,
                        user=user,
                        role=role,
                        joined_at=now,
                    )

                display_name = user.email
                email_val = user.email
                user_id_val = str(user.id)

            else:
                # Guest Participant
                if not meeting.allow_guests:
                    return Response(
                        {"error": "Guest access is disabled for this meeting."},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                guest_name = validated_data.get('guest_name', '').strip()
                if not guest_name:
                    return Response(
                        {"error": "guest_name is required for guest attendees."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                guest_email = validated_data.get('guest_email', '').strip()
                is_moderator = False
                role = 'attendee'
                display_name = guest_name
                email_val = guest_email
                user_id_val = f"guest-{timezone.now().timestamp()}"

                MeetingAttendee.objects.create(
                    meeting=meeting,
                    user=None,
                    guest_name=guest_name,
                    guest_email=guest_email or None,
                    role=role,
                    joined_at=now,
                )

            # Generate short-lived Jitsi JWT (2 hours)
            token = generate_jitsi_token(
                user_id=user_id_val,
                name=display_name,
                email=email_val,
                room_name=meeting.jitsi_room_name,
                is_moderator=is_moderator,
                expiration_hours=2,
            )

        return Response(
            {
                "token": token,
                "room_name": meeting.jitsi_room_name,
                "domain": getattr(settings, 'JITSI_DOMAIN', 'meet.example.com'),
            },
            status=status.HTTP_200_OK,
        )


class EndMeetingView(APIView):
    """
    POST /api/meetings/{room_name}/end/
    Only the host or a member with can_delete_meeting=True can trigger this.
    Updates status = 'ended', sets actual_ended_at = now(), calculates total_duration_secs.
    Records attendee leave_time for all active sessions.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, room_name):
        with transaction.atomic():
            meeting = (
                Meeting.objects.select_for_update()
                .filter(jitsi_room_name=room_name)
                .select_related('org', 'host')
                .first()
            )

            if not meeting:
                return Response(
                    {"error": "Meeting room not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if meeting.status == 'ended':
                return Response(
                    {"error": "This meeting has already ended."},
                    status=status.HTTP_410_GONE,
                )

            is_host = (meeting.host_id == request.user.id)
            membership = OrganizationMember.objects.filter(
                org=meeting.org,
                user=request.user,
                status='active',
            ).first()

            has_delete_perm = bool(
                membership and (membership.can_delete_meeting or membership.is_owner)
            )

            if not is_host and not has_delete_perm and not request.user.is_superuser:
                return Response(
                    {"error": "You do not have permission to end this meeting."},
                    status=status.HTTP_403_FORBIDDEN,
                )

            now = timezone.now()
            meeting.status = 'ended'
            meeting.actual_ended_at = now

            if meeting.actual_started_at:
                meeting.total_duration_secs = max(
                    0, int((now - meeting.actual_started_at).total_seconds())
                )
            else:
                meeting.total_duration_secs = 0

            meeting.save(update_fields=['status', 'actual_ended_at', 'total_duration_secs'])

            # Record attendee leave times and individual durations
            active_attendees = meeting.attendees.filter(left_at__isnull=True)
            for att in active_attendees:
                att.left_at = now
                att.duration_seconds = max(0, int((now - att.joined_at).total_seconds()))
                att.save(update_fields=['left_at', 'duration_seconds'])

        return Response(
            {
                "message": "Meeting ended successfully.",
                "total_duration_secs": meeting.total_duration_secs,
            },
            status=status.HTTP_200_OK,
        )


class CalendarView(APIView):
    """
    GET /api/meetings/calendar/?year=YYYY&month=MM
    Aggregates all meetings within the requested month.
    Returns daily breakdown: date string, meeting_count, total_duration_seconds,
    and sessions with title, type, host name, duration, and attendee list.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()
        try:
            year = int(request.query_params.get('year', now.year))
            month = int(request.query_params.get('month', now.month))
            if month < 1 or month > 12:
                raise ValueError
        except (TypeError, ValueError):
            return Response(
                {"error": "Invalid year or month format. Provide year=YYYY&month=MM."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org_id = request.query_params.get('org_id')

        # Find accessible organizations
        user_memberships = OrganizationMember.objects.filter(
            user=request.user,
            status='active',
        ).values_list('org_id', flat=True)

        if org_id:
            if not request.user.is_superuser and org_id not in [str(o) for o in user_memberships]:
                return Response(
                    {"error": "You do not have access to this organization."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            org_filter = Q(org_id=org_id)
        else:
            if not request.user.is_superuser:
                org_filter = Q(org_id__in=user_memberships)
            else:
                org_filter = Q()

        # Month boundaries in UTC
        start_date = datetime(year, month, 1, 0, 0, 0, tzinfo=dt_timezone.utc)
        last_day = calendar.monthrange(year, month)[1]
        end_date = datetime(year, month, last_day, 23, 59, 59, 999999, tzinfo=dt_timezone.utc)

        date_condition = (
            Q(scheduled_start__gte=start_date, scheduled_start__lte=end_date)
            | Q(actual_started_at__gte=start_date, actual_started_at__lte=end_date)
            | (Q(scheduled_start__isnull=True, actual_started_at__isnull=True) & Q(created_at__gte=start_date, created_at__lte=end_date))
        )

        meetings = (
            Meeting.objects.filter(org_filter & date_condition)
            .select_related('host', 'org')
            .prefetch_related('attendees__user')
            .order_by('created_at')
        )

        # Group meetings by day (YYYY-MM-DD)
        days_map = {}

        for m in meetings:
            # Determine the key date
            dt = m.scheduled_start or m.actual_started_at or m.created_at
            day_str = dt.strftime('%Y-%m-%d')

            if day_str not in days_map:
                days_map[day_str] = {
                    "date": day_str,
                    "meeting_count": 0,
                    "total_duration_seconds": 0,
                    "meetings": [],
                }

            attendee_list = []
            for att in m.attendees.all():
                att_name = att.user.email if att.user else (att.guest_name or "Guest")
                attendee_list.append({
                    "name": att_name,
                    "role": att.role,
                })

            days_map[day_str]["meeting_count"] += 1
            days_map[day_str]["total_duration_seconds"] += m.total_duration_secs
            days_map[day_str]["meetings"].append({
                "id": str(m.id),
                "title": m.title,
                "type": m.meeting_type,
                "status": m.status,
                "host_id": str(m.host.id),
                "host_name": f"{m.host.first_name} {m.host.last_name}".strip() or m.host.email,
                "jitsi_room_name": m.jitsi_room_name,
                "scheduled_start": m.scheduled_start.isoformat() if m.scheduled_start else None,
                "scheduled_end": m.scheduled_end.isoformat() if m.scheduled_end else None,
                "actual_started_at": m.actual_started_at.isoformat() if m.actual_started_at else None,
                "actual_ended_at": m.actual_ended_at.isoformat() if m.actual_ended_at else None,
                "duration_seconds": m.total_duration_secs,
                "attendees": attendee_list,
            })

        sorted_days = sorted(days_map.values(), key=lambda d: d["date"])

        return Response(
            {
                "year": year,
                "month": month,
                "days": sorted_days,
                "meetings": MeetingSerializer(meetings, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class OverviewKPIsView(APIView):
    """
    GET /api/meetings/overview-kpis/
    Returns workspace-level aggregates:
    total_meetings_conducted, total_meeting_minutes, active_rooms_count.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org_id = request.query_params.get('org_id')

        user_memberships = OrganizationMember.objects.filter(
            user=request.user,
            status='active',
        ).values_list('org_id', flat=True)

        if org_id:
            if not request.user.is_superuser and org_id not in [str(o) for o in user_memberships]:
                return Response(
                    {"error": "You do not have access to this organization."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            queryset = Meeting.objects.filter(org_id=org_id)
        else:
            if not request.user.is_superuser:
                queryset = Meeting.objects.filter(org_id__in=user_memberships)
            else:
                queryset = Meeting.objects.all()

        total_conducted = queryset.filter(status='ended').count()
        total_seconds = queryset.aggregate(total=Sum('total_duration_secs'))['total'] or 0
        total_minutes = int(total_seconds // 60)
        active_rooms = queryset.filter(status='active').count()

        kpis = {
            "total_meetings_conducted": total_conducted,
            "total_meeting_minutes": total_minutes,
            "active_rooms_count": active_rooms,
        }

        serializer = KPIOverviewSerializer(kpis)
        return Response(serializer.data, status=status.HTTP_200_OK)
