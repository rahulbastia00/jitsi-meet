from datetime import timedelta
import uuid
from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from teams.models import Organization, OrganizationMember, OrganizationTeam
from .jitsi import decode_jitsi_token, generate_jitsi_token, generate_room_name
from .models import Meeting, MeetingAttendee

User = get_user_model()


class JitsiJWTUnitTests(TestCase):
    def test_generate_room_name(self):
        """Room name should be CamelCase alphanumeric with prefix."""
        room = generate_room_name("Instant")
        self.assertTrue(room.startswith("Instant"))
        self.assertTrue(room.isalnum())

    def test_jitsi_token_payload_structure(self):
        """Validates payload keys and values matching Prosody mod_auth_token requirements."""
        user_id = str(uuid.uuid4())
        email = "testuser@example.com"
        name = "Test User"
        room = "MeetingAlpha123"

        token = generate_jitsi_token(
            user_id=user_id,
            name=name,
            email=email,
            room_name=room,
            is_moderator=True,
            expiration_hours=2,
        )

        decoded = decode_jitsi_token(token)
        self.assertEqual(decoded["aud"], getattr(settings, 'JITSI_APP_AUDIENCE', 'jitsi_meet'))
        self.assertEqual(decoded["iss"], getattr(settings, 'JITSI_APP_ISSUER', 'django_backend'))
        self.assertEqual(decoded["sub"], getattr(settings, 'JITSI_DOMAIN', 'meet.example.com'))
        self.assertEqual(decoded["room"], room)
        self.assertTrue(decoded["moderator"])

        # Context
        context = decoded["context"]
        self.assertEqual(context["user"]["id"], user_id)
        self.assertEqual(context["user"]["name"], name)
        self.assertEqual(context["user"]["email"], email)
        self.assertFalse(context["features"]["livestreaming"])
        self.assertFalse(context["features"]["recording"])

        # Expiration
        now_ts = timezone.now().timestamp()
        self.assertGreater(decoded["exp"], now_ts)
        self.assertLessEqual(decoded["exp"], now_ts + 7210)


class MeetingAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.owner_user = User.objects.create_user(email="owner@org.com", password="Password123!")
        self.host_user = User.objects.create_user(email="host@org.com", password="Password123!")
        self.member_user = User.objects.create_user(email="member@org.com", password="Password123!")
        self.no_perm_user = User.objects.create_user(email="noperm@org.com", password="Password123!")

        # Organization
        self.org = Organization.objects.create(name="TechCorp", owner=self.owner_user)

        # Owner Member
        self.owner_member = OrganizationMember.objects.create(
            org=self.org,
            user=self.owner_user,
            is_owner=True,
            can_create_meeting=True,
            can_delete_meeting=True,
            can_use_ai=True,
            status='active',
        )

        # Host Member
        self.host_member = OrganizationMember.objects.create(
            org=self.org,
            user=self.host_user,
            is_owner=False,
            can_create_meeting=True,
            can_delete_meeting=False,
            can_use_ai=True,
            status='active',
        )

        # Member with delete permission
        self.deleter_user = User.objects.create_user(email="deleter@org.com", password="Password123!")
        self.deleter_member = OrganizationMember.objects.create(
            org=self.org,
            user=self.deleter_user,
            is_owner=False,
            can_create_meeting=True,
            can_delete_meeting=True,
            can_use_ai=True,
            status='active',
        )

        # Member with no meeting creation rights
        self.no_perm_member = OrganizationMember.objects.create(
            org=self.org,
            user=self.no_perm_user,
            is_owner=False,
            can_create_meeting=False,
            can_delete_meeting=False,
            can_use_ai=False,
            status='active',
        )

        # Team
        self.team = OrganizationTeam.objects.create(org=self.org, name="Engineering", color_tag="#3B82F6")

    def test_create_instant_meeting_success(self):
        """POST /api/meetings/instant/ creates active meeting, host attendee, and returns JWT."""
        self.client.force_authenticate(user=self.host_user)
        url = reverse('meetings:meeting-instant')
        response = self.client.post(url, {"title": "Quick Standup", "allow_guests": True}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertIn("meeting", data)
        self.assertIn("room_name", data)
        self.assertIn("token", data)
        self.assertIn("domain", data)

        # Validate token
        decoded = decode_jitsi_token(data["token"])
        self.assertTrue(decoded["moderator"])
        self.assertEqual(decoded["room"], data["room_name"])

        # Check DB state
        meeting = Meeting.objects.get(jitsi_room_name=data["room_name"])
        self.assertEqual(meeting.status, 'active')
        self.assertEqual(meeting.meeting_type, 'instant')
        self.assertEqual(meeting.host, self.host_user)
        self.assertTrue(MeetingAttendee.objects.filter(meeting=meeting, user=self.host_user, role='host').exists())

    def test_create_instant_meeting_no_permission_forbidden(self):
        """User with can_create_meeting=False cannot start an instant meeting."""
        self.client.force_authenticate(user=self.no_perm_user)
        url = reverse('meetings:meeting-instant')
        response = self.client.post(url, {"title": "Unauthorized"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_scheduled_meeting_success(self):
        """POST /api/meetings/scheduled/ validates UTC timestamps and links teams."""
        self.client.force_authenticate(user=self.host_user)
        url = reverse('meetings:meeting-scheduled')

        start = timezone.now() + timedelta(days=1)
        end = start + timedelta(hours=1)

        payload = {
            "title": "Sprint Planning",
            "description": "Bi-weekly sprint planning",
            "scheduled_start": start.isoformat(),
            "scheduled_end": end.isoformat(),
            "team_ids": [str(self.team.id)],
            "allow_guests": True,
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.json()
        self.assertEqual(data["status"], "created")
        self.assertEqual(data["meeting_type"], "scheduled")

        meeting = Meeting.objects.get(id=data["id"])
        self.assertIn(self.team, meeting.invited_teams.all())

    def test_create_scheduled_meeting_invalid_timestamps_rejected(self):
        """scheduled_start >= scheduled_end must return HTTP 400 Bad Request."""
        self.client.force_authenticate(user=self.host_user)
        url = reverse('meetings:meeting-scheduled')

        start = timezone.now() + timedelta(days=1)
        end = start - timedelta(hours=1)  # invalid

        payload = {
            "title": "Invalid Meeting",
            "scheduled_start": start.isoformat(),
            "scheduled_end": end.isoformat(),
        }

        response = self.client.post(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_join_meeting_authenticated_host_and_member(self):
        """POST /api/meetings/{room_name}/join/ sets moderator=True for host/owner, False for others."""
        # Create meeting
        meeting = Meeting.objects.create(
            org=self.org,
            host=self.host_user,
            title="Design Review",
            meeting_type="instant",
            status="active",
            jitsi_room_name="ReviewRoom123",
            actual_started_at=timezone.now(),
        )

        url = reverse('meetings:meeting-join', kwargs={'room_name': meeting.jitsi_room_name})

        # Host joins -> moderator: True
        self.client.force_authenticate(user=self.host_user)
        res_host = self.client.post(url, format='json')
        self.assertEqual(res_host.status_code, status.HTTP_200_OK)
        token_host = decode_jitsi_token(res_host.json()["token"])
        self.assertTrue(token_host["moderator"])

        # Org Owner joins -> moderator: True
        self.client.force_authenticate(user=self.owner_user)
        res_owner = self.client.post(url, format='json')
        self.assertEqual(res_owner.status_code, status.HTTP_200_OK)
        token_owner = decode_jitsi_token(res_owner.json()["token"])
        self.assertTrue(token_owner["moderator"])

        # Deleter joins (not host, not owner) -> moderator: False
        self.client.force_authenticate(user=self.deleter_user)
        res_deleter = self.client.post(url, format='json')
        self.assertEqual(res_deleter.status_code, status.HTTP_200_OK)
        token_deleter = decode_jitsi_token(res_deleter.json()["token"])
        self.assertFalse(token_deleter["moderator"])

    def test_join_meeting_guest_flow(self):
        """Guest join requires guest_name and receives moderator=False."""
        meeting = Meeting.objects.create(
            org=self.org,
            host=self.host_user,
            title="Public Webinar",
            allow_guests=True,
            status="active",
            jitsi_room_name="PublicWebinar123",
            actual_started_at=timezone.now(),
        )

        url = reverse('meetings:meeting-join', kwargs={'room_name': meeting.jitsi_room_name})
        self.client.force_authenticate(user=None)  # unauthenticated guest

        # Missing guest_name -> 400
        res_fail = self.client.post(url, {}, format='json')
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Successful guest join
        res_ok = self.client.post(url, {"guest_name": "Jane Doe", "guest_email": "jane@example.com"}, format='json')
        self.assertEqual(res_ok.status_code, status.HTTP_200_OK)
        token = decode_jitsi_token(res_ok.json()["token"])
        self.assertFalse(token["moderator"])
        self.assertEqual(token["context"]["user"]["name"], "Jane Doe")
        self.assertTrue(
            MeetingAttendee.objects.filter(meeting=meeting, guest_name="Jane Doe", role='attendee').exists()
        )

    def test_join_meeting_guest_forbidden_when_allow_guests_false(self):
        """Guest join returns HTTP 403 Forbidden when allow_guests=False."""
        meeting = Meeting.objects.create(
            org=self.org,
            host=self.host_user,
            title="Private Exec Sync",
            allow_guests=False,
            status="active",
            jitsi_room_name="PrivateSync123",
            actual_started_at=timezone.now(),
        )

        url = reverse('meetings:meeting-join', kwargs={'room_name': meeting.jitsi_room_name})
        self.client.force_authenticate(user=None)

        res = self.client.post(url, {"guest_name": "Intruder"}, format='json')
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_concluded_meeting_lockdown_returns_410_gone(self):
        """Enforce Concluded Meeting Lockdown: If meeting status == 'ended', return HTTP 410 Gone."""
        meeting = Meeting.objects.create(
            org=self.org,
            host=self.host_user,
            title="Finished Sync",
            status="ended",
            jitsi_room_name="FinishedSync123",
            actual_started_at=timezone.now() - timedelta(hours=1),
            actual_ended_at=timezone.now(),
            total_duration_secs=3600,
        )

        url = reverse('meetings:meeting-join', kwargs={'room_name': meeting.jitsi_room_name})
        self.client.force_authenticate(user=self.host_user)

        res = self.client.post(url, format='json')
        self.assertEqual(res.status_code, status.HTTP_410_GONE)
        self.assertEqual(res.json()["error"], "This meeting has already ended.")

    def test_end_meeting_lifecycle_and_duration_calculation(self):
        """POST /api/meetings/{room_name}/end/ updates status, actual_ended_at, and calculates durations."""
        start_time = timezone.now() - timedelta(minutes=45)
        meeting = Meeting.objects.create(
            org=self.org,
            host=self.host_user,
            title="Sprint Review",
            status="active",
            jitsi_room_name="SprintReview123",
            actual_started_at=start_time,
        )

        # Create active attendee and explicitly backdate joined_at (since auto_now_add sets to now)
        attendee = MeetingAttendee.objects.create(
            meeting=meeting,
            user=self.deleter_user,
            role='attendee',
        )
        MeetingAttendee.objects.filter(id=attendee.id).update(joined_at=start_time + timedelta(minutes=5))


        url = reverse('meetings:meeting-end', kwargs={'room_name': meeting.jitsi_room_name})

        # Unauthorized user (no delete permission) cannot end
        self.client.force_authenticate(user=self.no_perm_user)
        res_unauth = self.client.post(url, format='json')
        self.assertEqual(res_unauth.status_code, status.HTTP_403_FORBIDDEN)

        # Host ends meeting
        self.client.force_authenticate(user=self.host_user)
        res_end = self.client.post(url, format='json')
        self.assertEqual(res_end.status_code, status.HTTP_200_OK)

        meeting.refresh_from_db()
        attendee.refresh_from_db()

        self.assertEqual(meeting.status, 'ended')
        self.assertIsNotNone(meeting.actual_ended_at)
        self.assertGreaterEqual(meeting.total_duration_secs, 2690)

        # Attendee leave time recorded
        self.assertIsNotNone(attendee.left_at)
        self.assertGreaterEqual(attendee.duration_seconds, 2390)

    def test_calendar_endpoint_aggregation(self):
        """GET /api/meetings/calendar/?year=YYYY&month=MM aggregates daily meetings."""
        now = timezone.now()
        meeting = Meeting.objects.create(
            org=self.org,
            host=self.host_user,
            title="Daily Calendar Meeting",
            meeting_type="scheduled",
            status="ended",
            jitsi_room_name="CalendarTest123",
            actual_started_at=now,
            actual_ended_at=now + timedelta(minutes=30),
            total_duration_secs=1800,
        )
        MeetingAttendee.objects.create(
            meeting=meeting,
            user=self.host_user,
            role='host',
            duration_seconds=1800,
        )

        self.client.force_authenticate(user=self.host_user)
        url = reverse('meetings:meeting-calendar')
        response = self.client.get(f"{url}?year={now.year}&month={now.month}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["year"], now.year)
        self.assertEqual(data["month"], now.month)
        self.assertGreaterEqual(len(data["days"]), 1)

        day = data["days"][0]
        self.assertIn("meeting_count", day)
        self.assertIn("total_duration_seconds", day)
        self.assertIn("meetings", day)
        self.assertEqual(day["meetings"][0]["title"], "Daily Calendar Meeting")
        self.assertEqual(day["meetings"][0]["attendees"][0]["name"], self.host_user.email)

    def test_overview_kpis_endpoint(self):
        """GET /api/meetings/overview-kpis/ returns workspace-level aggregates."""
        # 1 active meeting, 1 ended meeting
        Meeting.objects.create(
            org=self.org,
            host=self.host_user,
            title="Active Meeting",
            status="active",
            jitsi_room_name="ActiveKpiRoom",
        )
        Meeting.objects.create(
            org=self.org,
            host=self.host_user,
            title="Concluded Meeting",
            status="ended",
            jitsi_room_name="ConcludedKpiRoom",
            total_duration_secs=3600,
        )

        self.client.force_authenticate(user=self.host_user)
        url = reverse('meetings:meeting-overview-kpis')
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(data["total_meetings_conducted"], 1)
        self.assertEqual(data["total_meeting_minutes"], 60)
        self.assertEqual(data["active_rooms_count"], 1)
