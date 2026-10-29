import json
import logging
from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from authentication.services import get_redis_client
from .models import Organization, OrganizationMember, OrganizationTeam
from .serializers import (
    InviteMemberSerializer,
    InviteTeamInstantSerializer,
    MoveMemberTeamSerializer,
    OrganizationMemberSerializer,
    OrganizationSerializer,
    OrganizationTeamSerializer,
    UpdateMemberPermissionsSerializer,
)

logger = logging.getLogger(__name__)


class OrganizationListCreateView(APIView):
    """
    List organizations the authenticated user belongs to, or create a new organization.
    When created, the user automatically becomes the owner with full privileges.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        memberships = OrganizationMember.objects.filter(
            user=request.user,
            status='active',
        ).select_related('org', 'org__owner')
        orgs = [m.org for m in memberships]
        serializer = OrganizationSerializer(orgs, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        name = request.data.get('name', '').strip()
        if not name:
            return Response(
                {"error": "Organization name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            org = Organization.objects.create(name=name, owner=request.user)
            OrganizationMember.objects.create(
                org=org,
                user=request.user,
                is_owner=True,
                can_create_meeting=True,
                can_delete_meeting=True,
                can_use_ai=True,
                status='active',
            )

        serializer = OrganizationSerializer(org)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class OrganizationDetailView(APIView):
    """
    Retrieve details of an organization if the user is a member.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, org_id):
        org = get_object_or_404(Organization, id=org_id)
        is_member = OrganizationMember.objects.filter(
            org=org,
            user=request.user,
            status='active',
        ).exists()

        if not is_member and not request.user.is_superuser:
            return Response(
                {"error": "You do not have access to this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = OrganizationSerializer(org)
        return Response(serializer.data, status=status.HTTP_200_OK)


class TeamListCreateView(APIView):
    """
    List or create teams within an organization.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, org_id):
        org = get_object_or_404(Organization, id=org_id)
        is_member = OrganizationMember.objects.filter(
            org=org,
            user=request.user,
            status='active',
        ).exists()

        if not is_member and not request.user.is_superuser:
            return Response(
                {"error": "You do not have access to this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        teams = OrganizationTeam.objects.filter(org=org).order_by('name')
        serializer = OrganizationTeamSerializer(teams, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, org_id):
        org = get_object_or_404(Organization, id=org_id)
        membership = OrganizationMember.objects.filter(
            org=org,
            user=request.user,
            status='active',
        ).first()

        if (not membership or not membership.is_owner) and not request.user.is_superuser:
            return Response(
                {"error": "Only organization owners can create teams."},
                status=status.HTTP_403_FORBIDDEN,
            )

        name = request.data.get('name', '').strip()
        color_tag = request.data.get('color_tag', '#3B82F6').strip()
        if not name:
            return Response(
                {"error": "Team name is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        team, created = OrganizationTeam.objects.get_or_create(
            org=org,
            name=name,
            defaults={'color_tag': color_tag},
        )
        serializer = OrganizationTeamSerializer(team)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class OrganizationMembersView(APIView):
    """
    GET /api/organizations/{org_id}/members/
    Returns members list with user details, team assignment, status, and permission flags.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, org_id):
        org = get_object_or_404(Organization, id=org_id)

        # Check membership
        is_member = OrganizationMember.objects.filter(
            org=org,
            user=request.user,
            status='active',
        ).exists()

        if not is_member and not request.user.is_superuser:
            return Response(
                {"error": "You do not have access to this organization's members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        members = (
            OrganizationMember.objects.filter(org=org)
            .select_related('user', 'team')
            .order_by('-is_owner', 'joined_at')
        )
        serializer = OrganizationMemberSerializer(members, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class MemberPermissionsView(APIView):
    """
    PATCH /api/organizations/{org_id}/members/{member_id}/permissions/
    Allows updating can_create_meeting, can_delete_meeting, and can_use_ai.
    Rejects attempts to revoke permissions from the organization owner (is_owner=True).
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, org_id, member_id):
        org = get_object_or_404(Organization, id=org_id)

        # Check that caller has admin/owner permissions
        caller_membership = OrganizationMember.objects.filter(
            org=org,
            user=request.user,
            status='active',
        ).first()

        if (not caller_membership or not caller_membership.is_owner) and not request.user.is_superuser:
            return Response(
                {"error": "Only organization owners can modify member permissions."},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_member = get_object_or_404(OrganizationMember, id=member_id, org=org)

        serializer = UpdateMemberPermissionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data

        # Explicit Owner Protection: Reject attempts to revoke permissions from the organization owner
        if target_member.is_owner:
            revocation_attempted = False
            for field in ('can_create_meeting', 'can_delete_meeting', 'can_use_ai'):
                if field in validated_data and validated_data[field] is False:
                    revocation_attempted = True
                    break

            if revocation_attempted:
                return Response(
                    {"error": "Cannot revoke permissions from the organization owner."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Apply updates
        for field in ('can_create_meeting', 'can_delete_meeting', 'can_use_ai'):
            if field in validated_data:
                setattr(target_member, field, validated_data[field])

        target_member.save()

        response_serializer = OrganizationMemberSerializer(target_member)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class MemberMoveTeamView(APIView):
    """
    PATCH /api/organizations/{org_id}/members/{member_id}/move-team/
    Reallocates a member to a new team_id (or null to unassign).
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, org_id, member_id):
        org = get_object_or_404(Organization, id=org_id)

        # Caller must be a member of the organization
        caller_membership = OrganizationMember.objects.filter(
            org=org,
            user=request.user,
            status='active',
        ).first()

        if (not caller_membership or not caller_membership.is_owner) and not request.user.is_superuser:
            return Response(
                {"error": "Only organization owners can reallocate member teams."},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_member = get_object_or_404(OrganizationMember, id=member_id, org=org)

        serializer = MoveMemberTeamSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        team_id = serializer.validated_data.get('team_id')

        if team_id is None:
            target_member.team = None
        else:
            team = OrganizationTeam.objects.filter(id=team_id, org=org).first()
            if not team:
                return Response(
                    {"error": "Team does not belong to this organization or does not exist."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            target_member.team = team

        target_member.save(update_fields=['team'])

        response_serializer = OrganizationMemberSerializer(target_member)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class TeamInviteInstantView(APIView):
    """
    POST /api/organizations/{org_id}/teams/{team_id}/invite-instant/
    Batch invites all members of a team to an active or newly generated instant meeting.
    Dispatches notifications via Redis / WebSockets if configured.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, org_id, team_id):
        org = get_object_or_404(Organization, id=org_id)
        team = get_object_or_404(OrganizationTeam, id=team_id, org=org)

        caller_membership = OrganizationMember.objects.filter(
            org=org,
            user=request.user,
            status='active',
        ).first()

        if not caller_membership and not request.user.is_superuser:
            return Response(
                {"error": "You do not have access to this organization."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if not caller_membership.can_create_meeting and not request.user.is_superuser:
            return Response(
                {"error": "You do not have permission to initiate meetings."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = InviteTeamInstantSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        meeting_id = serializer.validated_data.get('meeting_id')
        title = serializer.validated_data.get('title') or f"{team.name} Sync"

        from meetings.models import Meeting, MeetingAttendee
        from meetings.jitsi import generate_room_name

        with transaction.atomic():
            if meeting_id:
                meeting = Meeting.objects.filter(id=meeting_id, org=org).first()
                if not meeting:
                    return Response(
                        {"error": "Specified meeting not found in this organization."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                if meeting.status == 'ended':
                    return Response(
                        {"error": "Cannot invite members to an ended meeting."},
                        status=status.HTTP_410_GONE,
                    )
            else:
                room_name = generate_room_name("Instant")
                meeting = Meeting.objects.create(
                    org=org,
                    host=request.user,
                    title=title,
                    meeting_type='instant',
                    status='active',
                    allow_guests=True,
                    jitsi_room_name=room_name,
                    actual_started_at=timezone.now(),
                )
                MeetingAttendee.objects.get_or_create(
                    meeting=meeting,
                    user=request.user,
                    defaults={'role': 'host'},
                )

            meeting.invited_teams.add(team)

            # Retrieve active members belonging to this team
            team_members = (
                OrganizationMember.objects.filter(org=org, team=team, status='active')
                .select_related('user')
            )

            invited_users = []
            for tm in team_members:
                invited_users.append(str(tm.user.id))
                if tm.user != request.user:
                    MeetingAttendee.objects.get_or_create(
                        meeting=meeting,
                        user=tm.user,
                        defaults={'role': 'attendee'},
                    )

        # Dispatch notifications via Redis
        try:
            r = get_redis_client()
            notification_payload = json.dumps({
                "event": "team_instant_invite",
                "org_id": str(org.id),
                "team_id": str(team.id),
                "team_name": team.name,
                "meeting_id": str(meeting.id),
                "room_name": meeting.jitsi_room_name,
                "title": meeting.title,
                "host_email": request.user.email,
                "invited_users": invited_users,
                "timestamp": timezone.now().isoformat(),
            })
            channel = f"org:{org.id}:team:{team.id}"
            r.publish(channel, notification_payload)
            r.publish("meetings:global", notification_payload)
        except Exception as exc:
            logger.warning("Redis notification dispatch failed: %s", exc)

        return Response(
            {
                "message": f"Successfully invited members of {team.name} to instant meeting.",
                "meeting_id": str(meeting.id),
                "room_name": meeting.jitsi_room_name,
                "invited_count": len(invited_users),
            },
            status=status.HTTP_200_OK,
        )


class InviteMemberView(APIView):
    """
    POST /api/organizations/{org_id}/invite-member/
    Invites a member to the organization:
    Accepts: { "email": "...", "first_name": "...", "last_name": "...", "team_id": "..." }
    Sets membership status to 'invited' and dispatches invitation link via Resend or logs to console.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, org_id):
        org = get_object_or_404(Organization, id=org_id)
        caller_membership = OrganizationMember.objects.filter(
            org=org,
            user=request.user,
            status='active',
        ).first()

        if (not caller_membership or not caller_membership.is_owner) and not request.user.is_superuser:
            return Response(
                {"error": "Only organization owners can invite members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = InviteMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        email = data['email'].strip().lower()
        first_name = data.get('first_name', '').strip()
        last_name = data.get('last_name', '').strip()
        team_id = data.get('team_id')

        team = None
        if team_id:
            team = OrganizationTeam.objects.filter(id=team_id, org=org).first()
            if not team:
                return Response(
                    {"error": "Team does not belong to this organization or does not exist."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        from django.contrib.auth import get_user_model
        User = get_user_model()

        with transaction.atomic():
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first_name,
                    'last_name': last_name,
                    'is_active': True,
                }
            )
            if not created:
                updated_fields = []
                if first_name and not user.first_name:
                    user.first_name = first_name
                    updated_fields.append('first_name')
                if last_name and not user.last_name:
                    user.last_name = last_name
                    updated_fields.append('last_name')
                if updated_fields:
                    user.save(update_fields=updated_fields)

            member, member_created = OrganizationMember.objects.get_or_create(
                org=org,
                user=user,
                defaults={
                    'team': team,
                    'status': 'invited',
                    'can_create_meeting': True,
                    'can_delete_meeting': False,
                    'can_use_ai': True,
                }
            )
            if not member_created:
                if team and member.team != team:
                    member.team = team
                    member.save(update_fields=['team'])

        # Dispatch invitation email via Resend or log to console
        invite_url = f"{getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')}/signup?email={email}&org_id={org.id}"
        logger.info("[INVITATION DISPATCH] Organization invitation sent to %s for workspace %s. Link: %s", email, org.name, invite_url)
        print(f"[INVITATION DISPATCH] Email: {email} | Org: {org.name} | Link: {invite_url}")

        resend_api_key = getattr(settings, 'RESEND_API_KEY', None)
        if resend_api_key:
            try:
                import resend
                resend.api_key = resend_api_key
                resend.Emails.send({
                    "from": getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com'),
                    "to": [email],
                    "subject": f"You're invited to join {org.name}",
                    "html": f"<p>Hello {first_name or email},</p><p>You have been invited to join <strong>{org.name}</strong> on the AI Meeting Platform.</p><p><a href='{invite_url}'>Click here to join</a></p>",
                })
            except Exception as e:
                logger.warning("Failed to send invitation via Resend: %s", e)

        response_serializer = OrganizationMemberSerializer(member)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class MemberDeleteView(APIView):
    """
    DELETE /api/organizations/{org_id}/members/{member_id}/
    Removes a member from the organization (disabled for owner).
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, org_id, member_id):
        org = get_object_or_404(Organization, id=org_id)
        caller_membership = OrganizationMember.objects.filter(
            org=org,
            user=request.user,
            status='active',
        ).first()

        if (not caller_membership or not caller_membership.is_owner) and not request.user.is_superuser:
            return Response(
                {"error": "Only organization owners can remove members."},
                status=status.HTTP_403_FORBIDDEN,
            )

        target_member = get_object_or_404(OrganizationMember, id=member_id, org=org)
        if target_member.is_owner:
            return Response(
                {"error": "Cannot remove the organization owner."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_member.delete()
        return Response({"message": "Member removed successfully."}, status=status.HTTP_200_OK)

