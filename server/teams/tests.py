import uuid
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from .models import Organization, OrganizationMember, OrganizationTeam

User = get_user_model()


class TeamsModelsAndAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Users
        self.owner_user = User.objects.create_user(email="owner@example.com", password="Password123!")
        self.admin_user = User.objects.create_user(email="admin@example.com", password="Password123!")
        self.regular_user = User.objects.create_user(email="regular@example.com", password="Password123!")
        self.outsider_user = User.objects.create_user(email="outsider@example.com", password="Password123!")

        # Organization
        self.org = Organization.objects.create(name="Acme Corp", owner=self.owner_user)

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

        # Teams
        self.team_backend = OrganizationTeam.objects.create(
            org=self.org,
            name="Backend",
            color_tag="#10B981",
        )
        self.team_frontend = OrganizationTeam.objects.create(
            org=self.org,
            name="Frontend",
            color_tag="#3B82F6",
        )

        # Regular Member
        self.regular_member = OrganizationMember.objects.create(
            org=self.org,
            user=self.regular_user,
            team=self.team_backend,
            is_owner=False,
            can_create_meeting=True,
            can_delete_meeting=False,
            can_use_ai=True,
            status='active',
        )

    def test_owner_protection_model_constraints(self):
        """Owner membership cannot be suspended or have delete/meeting rights revoked."""
        with self.assertRaises(ValidationError):
            self.owner_member.status = 'suspended'
            self.owner_member.clean()

        with self.assertRaises(ValidationError):
            self.owner_member.delete()

    def test_get_organization_members(self):
        """GET /api/organizations/{org_id}/members/ returns full member list with user and team details."""
        self.client.force_authenticate(user=self.owner_user)
        url = reverse('teams:org-members', kwargs={'org_id': self.org.id})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertEqual(len(data), 2)
        # Verify structure
        emails = [m['user']['email'] for m in data]
        self.assertIn('owner@example.com', emails)
        self.assertIn('regular@example.com', emails)

        # Verify team info
        reg_member_data = next(m for m in data if m['user']['email'] == 'regular@example.com')
        self.assertIsNotNone(reg_member_data['team'])
        self.assertEqual(reg_member_data['team']['name'], 'Backend')

    def test_get_organization_members_outsider_forbidden(self):
        """Users not belonging to an org cannot view its members."""
        self.client.force_authenticate(user=self.outsider_user)
        url = reverse('teams:org-members', kwargs={'org_id': self.org.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_update_member_permissions_success(self):
        """PATCH /api/organizations/{org_id}/members/{member_id}/permissions/ modifies toggles."""
        self.client.force_authenticate(user=self.owner_user)
        url = reverse(
            'teams:member-permissions',
            kwargs={'org_id': self.org.id, 'member_id': self.regular_member.id},
        )
        payload = {
            "can_delete_meeting": True,
            "can_use_ai": False,
        }
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        self.regular_member.refresh_from_db()
        self.assertTrue(self.regular_member.can_delete_meeting)
        self.assertFalse(self.regular_member.can_use_ai)

    def test_update_permissions_owner_protection_rejection(self):
        """Rejects attempts to revoke permissions from the organization owner (is_owner=True)."""
        self.client.force_authenticate(user=self.owner_user)
        url = reverse(
            'teams:member-permissions',
            kwargs={'org_id': self.org.id, 'member_id': self.owner_member.id},
        )
        payload = {
            "can_create_meeting": False,
        }
        response = self.client.patch(url, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Cannot revoke permissions from the organization owner", response.json()["error"])

        self.owner_member.refresh_from_db()
        self.assertTrue(self.owner_member.can_create_meeting)

    def test_move_member_team(self):
        """PATCH /api/organizations/{org_id}/members/{member_id}/move-team/ moves member or unassigns."""
        self.client.force_authenticate(user=self.owner_user)
        url = reverse(
            'teams:member-move-team',
            kwargs={'org_id': self.org.id, 'member_id': self.regular_member.id},
        )

        # Move to frontend
        response = self.client.patch(url, {'team_id': str(self.team_frontend.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.regular_member.refresh_from_db()
        self.assertEqual(self.regular_member.team, self.team_frontend)

        # Unassign team
        response = self.client.patch(url, {'team_id': None}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.regular_member.refresh_from_db()
        self.assertIsNone(self.regular_member.team)

    def test_move_member_team_invalid_org_team(self):
        """Rejects assigning a team belonging to a different organization."""
        other_org = Organization.objects.create(name="Other Org", owner=self.owner_user)
        other_team = OrganizationTeam.objects.create(org=other_org, name="Security")

        self.client.force_authenticate(user=self.owner_user)
        url = reverse(
            'teams:member-move-team',
            kwargs={'org_id': self.org.id, 'member_id': self.regular_member.id},
        )
        response = self.client.patch(url, {'team_id': str(other_team.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invite_team_instant_creates_meeting_and_attendees(self):
        """POST /api/organizations/{org_id}/teams/{team_id}/invite-instant/ batch invites team members."""
        self.client.force_authenticate(user=self.owner_user)
        url = reverse(
            'teams:team-invite-instant',
            kwargs={'org_id': self.org.id, 'team_id': self.team_backend.id},
        )
        response = self.client.post(url, {"title": "Emergency Backend Sync"}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn("meeting_id", data)
        self.assertIn("room_name", data)
        self.assertEqual(data["invited_count"], 1)

    def test_organization_crud_endpoints(self):
        """Test listing and creating organizations."""
        self.client.force_authenticate(user=self.owner_user)
        url = reverse('teams:org-list-create')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(url, {'name': 'New Venture Corp'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_org_id = response.json()['id']
        self.assertTrue(
            OrganizationMember.objects.filter(org_id=new_org_id, user=self.owner_user, is_owner=True).exists()
        )
