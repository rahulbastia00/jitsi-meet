from django.contrib.auth import get_user_model
from rest_framework import serializers
from .models import Organization, OrganizationMember, OrganizationTeam

User = get_user_model()


class UserBasicSerializer(serializers.ModelSerializer):
    """
    Lightweight user representation for member and attendee listings.
    """
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name']
        read_only_fields = ['id', 'email', 'first_name', 'last_name']


class InviteMemberSerializer(serializers.Serializer):
    """
    Validates organization member invitation payload.
    """
    email = serializers.EmailField()
    first_name = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    last_name = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    team_id = serializers.UUIDField(required=False, allow_null=True, default=None)


class OrganizationTeamSerializer(serializers.ModelSerializer):
    """
    Serializer for department or sub-team inside an organization.
    """
    class Meta:
        model = OrganizationTeam
        fields = ['id', 'org', 'name', 'color_tag', 'created_at']
        read_only_fields = ['id', 'org', 'created_at']


class OrganizationMemberSerializer(serializers.ModelSerializer):
    """
    Serializer for organization members, with nested user and team information.
    """
    user = UserBasicSerializer(read_only=True)
    team = OrganizationTeamSerializer(read_only=True)

    class Meta:
        model = OrganizationMember
        fields = [
            'id',
            'user',
            'team',
            'is_owner',
            'can_create_meeting',
            'can_delete_meeting',
            'can_use_ai',
            'status',
            'joined_at',
        ]
        read_only_fields = ['id', 'user', 'team', 'is_owner', 'joined_at']


class UpdateMemberPermissionsSerializer(serializers.Serializer):
    """
    Validates granular AWS IAM-style permission updates for an organization member.
    """
    can_create_meeting = serializers.BooleanField(required=False)
    can_delete_meeting = serializers.BooleanField(required=False)
    can_use_ai = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("At least one permission field must be provided.")
        return attrs


class MoveMemberTeamSerializer(serializers.Serializer):
    """
    Validates moving a member to a new team or unassigning them.
    """
    team_id = serializers.UUIDField(required=False, allow_null=True)


class InviteTeamInstantSerializer(serializers.Serializer):
    """
    Validates instant meeting batch invitation payload for a team.
    """
    meeting_id = serializers.UUIDField(required=False, allow_null=True)
    title = serializers.CharField(required=False, allow_blank=True, max_length=255, default="Instant Meeting")


class OrganizationSerializer(serializers.ModelSerializer):
    """
    Serializer for organizations.
    """
    owner = UserBasicSerializer(read_only=True)

    class Meta:
        model = Organization
        fields = ['id', 'name', 'owner', 'created_at']
        read_only_fields = ['id', 'owner', 'created_at']
