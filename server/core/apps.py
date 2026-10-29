import logging
import os
import sys
from django.apps import AppConfig

logger = logging.getLogger(__name__)


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        """
        Executed on Django application initialization.
        Runs startup connectivity tests and logs health status when starting the web server.
        """
        # Skip during non-server CLI commands
        non_server_commands = {
            'migrate',
            'makemigrations',
            'test',
            'collectstatic',
            'showmigrations',
            'squashmigrations',
            'seed_demo_data',
            'shell',
            'createsuperuser',
            'check',
            'check_health',
        }

        # Check if running a non-server CLI management command
        if len(sys.argv) > 1 and sys.argv[1] in non_server_commands:
            return

        # In runserver, Django spawns a parent watcher and a child worker (RUN_MAIN='true').
        # Only run health checks in the active worker process (or when --noreload is passed).
        is_runserver = any('runserver' in arg for arg in sys.argv)
        is_reloader_child = os.environ.get('RUN_MAIN') == 'true'

        if is_runserver and not is_reloader_child and '--noreload' not in sys.argv:
            return

        # Run startup connectivity diagnostics in a background thread
        # This prevents blocking app loading and avoids the Django DB access during ready() warning.
        import threading
        from core.health import run_startup_health_checks

        thread = threading.Thread(
            target=run_startup_health_checks,
            name="HRNBYLStartupHealthCheck",
            daemon=True,
        )
        thread.start()
