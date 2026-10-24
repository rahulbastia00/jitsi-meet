from django.urls import path
from .views import (
    MemberMoveTeamView,
    MemberPermissionsView,
    OrganizationDetailView,
    OrganizationListCreateView,
    OrganizationMembersView,
    TeamInviteInstantView,
    TeamListCreateView,
)

app_name = 'teams'

urlpatterns = [
    path('', OrganizationListCreateView.as_view(), name='org-list-create'),
    path('<uuid:org_id>/', OrganizationDetailView.as_view(), name='org-detail'),
    path('<uuid:org_id>/teams/', TeamListCreateView.as_view(), name='team-list-create'),
    path('<uuid:org_id>/members/', OrganizationMembersView.as_view(), name='org-members'),
    path(
        '<uuid:org_id>/members/<uuid:member_id>/permissions/',
        MemberPermissionsView.as_view(),
        name='member-permissions',
    ),
    path(
        '<uuid:org_id>/members/<uuid:member_id>/move-team/',
        MemberMoveTeamView.as_view(),
        name='member-move-team',
    ),
    path(
        '<uuid:org_id>/teams/<uuid:team_id>/invite-instant/',
        TeamInviteInstantView.as_view(),
        name='team-invite-instant',
    ),
]
