from django.urls import path
from .views import (
    CalendarView,
    EndMeetingView,
    InstantMeetingCreateView,
    JoinMeetingView,
    OverviewKPIsView,
    ScheduledMeetingCreateView,
)

app_name = 'meetings'

urlpatterns = [
    path('instant/', InstantMeetingCreateView.as_view(), name='meeting-instant'),
    path('scheduled/', ScheduledMeetingCreateView.as_view(), name='meeting-scheduled'),
    path('<str:room_name>/join/', JoinMeetingView.as_view(), name='meeting-join'),
    path('<str:room_name>/end/', EndMeetingView.as_view(), name='meeting-end'),
    path('calendar/', CalendarView.as_view(), name='meeting-calendar'),
    path('overview-kpis/', OverviewKPIsView.as_view(), name='meeting-overview-kpis'),
]
