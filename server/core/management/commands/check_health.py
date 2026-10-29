from django.core.management.base import BaseCommand
from core.health import run_startup_health_checks


class Command(BaseCommand):
    help = "Tests and logs connectivity and health of Database, Redis, Resend Email, and Jitsi Meet services."

    def add_arguments(self, parser):
        parser.add_argument(
            '--fail-fast',
            action='store_true',
            help='Raise an exception and exit with code 1 if any service check fails.',
        )

    def handle(self, *args, **options):
        run_startup_health_checks(raise_on_failure=options.get('fail_fast', False))
