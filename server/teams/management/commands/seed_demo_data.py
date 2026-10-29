import uuid
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from teams.models import Organization, OrganizationTeam, OrganizationMember
from meetings.models import Meeting, MeetingAttendee

User = get_user_model()

class Command(BaseCommand):
    help = "Seeds database with enterprise workspace, teams, Linear backlog roster, and calendar meetings."

    def handle(self, *args, **options):
        self.stdout.write("Seeding enterprise meeting platform demo data...")

        # 1. Primary User / Owner
        admin_user, _ = User.objects.get_or_create(
            email="admin@hrnbyl.com",
            defaults={
                "first_name": "Rahul",
                "last_name": "Bastia",
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
                "terms_accepted": True,
                "terms_accepted_at": timezone.now(),
            },
        )
        admin_user.first_name = "Rahul"
        admin_user.last_name = "Bastia"
        admin_user.set_password("Admin123!@#")
        admin_user.save()

        # 2. Organization
        org, _ = Organization.objects.get_or_create(
            name="Acme Inc - Enterprise",
            defaults={"owner": admin_user},
        )
        org.owner = admin_user
        org.save()

        # 3. Owner Membership
        owner_member, _ = OrganizationMember.objects.get_or_create(
            org=org,
            user=admin_user,
            defaults={
                "is_owner": True,
                "can_create_meeting": True,
                "can_delete_meeting": True,
                "can_use_ai": True,
                "status": "active",
            },
        )
        owner_member.is_owner = True
        owner_member.save()

        # 4. Teams
        team_defs = [
            ("Backend", "#3B82F6"),
            ("Frontend", "#10B981"),
            ("DevOps", "#F59E0B"),
            ("Design", "#8B5CF6"),
        ]
        teams_map = {}
        for name, color in team_defs:
            t, _ = OrganizationTeam.objects.get_or_create(
                org=org,
                name=name,
                defaults={"color_tag": color},
            )
            t.color_tag = color
            t.save()
            teams_map[name] = t

        owner_member.team = teams_map["Backend"]
        owner_member.save(update_fields=["team"])

        # 5. Members roster (Linear sprint backlog UI)
        member_roster = [
            ("leo.grant@company.com", "Leo", "Grant", "Backend", "active", True, False, True),
            ("sana.qureshi@company.com", "Sana", "Qureshi", "DevOps", "active", True, False, True),
            ("alex.johnson@company.com", "Alex", "Johnson", "Frontend", "active", True, True, True),
            ("david.kim@company.com", "David", "Kim", "Design", "invited", False, False, False),
            ("mira.stone@company.com", "Mira", "Stone", "Frontend", "active", True, False, True),
            ("theo.park@company.com", "Theo", "Park", "Backend", "active", True, False, True),
            ("ravi.menon@company.com", "Ravi", "Menon", "DevOps", "suspended", False, False, False),
        ]

        created_users = [admin_user]
        for email, fn, ln, team_name, status, can_create, can_delete, can_ai in member_roster:
            u, _ = User.objects.get_or_create(
                email=email,
                defaults={
                    "first_name": fn,
                    "last_name": ln,
                    "is_active": True,
                    "terms_accepted": True,
                    "terms_accepted_at": timezone.now(),
                },
            )
            u.first_name = fn
            u.last_name = ln
            u.set_password("Member123!@#")
            u.save()
            created_users.append(u)

            mem, _ = OrganizationMember.objects.get_or_create(
                org=org,
                user=u,
                defaults={
                    "team": teams_map[team_name],
                    "status": status,
                    "can_create_meeting": can_create,
                    "can_delete_meeting": can_delete,
                    "can_use_ai": can_ai,
                    "is_owner": False,
                },
            )
            mem.team = teams_map[team_name]
            mem.status = status
            mem.can_create_meeting = can_create
            mem.can_delete_meeting = can_delete
            mem.can_use_ai = can_ai
            mem.save()

        # 6. Seed Meetings
        now = timezone.now()
        today_midnight = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # 6a. Active Live Instant Meeting
        live_room = "InstantCollaborationSync"
        live_meeting, _ = Meeting.objects.get_or_create(
            jitsi_room_name=live_room,
            defaults={
                "org": org,
                "host": admin_user,
                "title": "Realtime Presence Sync",
                "meeting_type": "instant",
                "status": "active",
                "allow_guests": True,
                "actual_started_at": now - timedelta(minutes=18),
            },
        )
        live_meeting.invited_teams.add(teams_map["Backend"], teams_map["Frontend"])
        MeetingAttendee.objects.get_or_create(
            meeting=live_meeting,
            user=admin_user,
            defaults={"role": "host", "joined_at": now - timedelta(minutes=18)},
        )
        MeetingAttendee.objects.get_or_create(
            meeting=live_meeting,
            user=created_users[1],
            defaults={"role": "attendee", "joined_at": now - timedelta(minutes=15)},
        )

        # 6b. Scheduled meetings for today
        schedule_slots = [
            ("SSO Enforcement Strategy", 9, 30, 45, "DevOps", admin_user, "scheduled"),
            ("Webhook Retries & Dead Letters", 11, 0, 45, "Backend", created_users[1], "scheduled"),
            ("Sprint Backlog Grooming", 14, 0, 60, "Frontend", created_users[3], "scheduled"),
            ("Design Token Token Rotation", 16, 0, 45, "Design", created_users[4], "scheduled"),
        ]

        for title, hour, minute, dur_min, t_name, host_u, m_status in schedule_slots:
            s_start = today_midnight + timedelta(hours=hour, minutes=minute)
            s_end = s_start + timedelta(minutes=dur_min)
            r_name = f"Scheduled{t_name}{hour}{minute}"

            m, _ = Meeting.objects.get_or_create(
                jitsi_room_name=r_name,
                defaults={
                    "org": org,
                    "host": host_u,
                    "title": title,
                    "meeting_type": "scheduled",
                    "status": m_status,
                    "allow_guests": True,
                    "scheduled_start": s_start,
                    "scheduled_end": s_end,
                },
            )
            m.invited_teams.add(teams_map[t_name])
            MeetingAttendee.objects.get_or_create(
                meeting=m,
                user=host_u,
                defaults={"role": "host", "joined_at": s_start},
            )

        # 6c. Completed meetings earlier in the month
        for day_offset in [1, 2, 4, 7, 10]:
            past_date = now - timedelta(days=day_offset, hours=2)
            past_end = past_date + timedelta(minutes=35)
            p_room = f"ConductedRoomPast{day_offset}"
            pm, _ = Meeting.objects.get_or_create(
                jitsi_room_name=p_room,
                defaults={
                    "org": org,
                    "host": admin_user,
                    "title": f"Sprint Review Day -{day_offset}",
                    "meeting_type": "scheduled",
                    "status": "ended",
                    "allow_guests": True,
                    "actual_started_at": past_date,
                    "actual_ended_at": past_end,
                    "total_duration_secs": 2100,
                },
            )
            pm.invited_teams.add(teams_map["Backend"])
            MeetingAttendee.objects.get_or_create(
                meeting=pm,
                user=admin_user,
                defaults={"role": "host", "joined_at": past_date, "left_at": past_end, "duration_seconds": 2100},
            )

        self.stdout.write(self.style.SUCCESS("Demo seed data created successfully!"))
        self.stdout.write(f"  Owner: admin@hrnbyl.com / Admin123!@#")
        self.stdout.write(f"  Workspace: Acme Inc - Enterprise ({org.id})")
        self.stdout.write(f"  Members: {len(member_roster) + 1} roster members")
        self.stdout.write(f"  Active meeting: {live_room}")
