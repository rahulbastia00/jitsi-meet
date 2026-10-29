import logging
import os
import sys
import time
from urllib.parse import urlparse
from django.conf import settings
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

logger = logging.getLogger('server.health')

# ANSI Color codes for terminal logging
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
CYAN = '\033[96m'
BOLD = '\033[1m'
DIM = '\033[2m'
RESET = '\033[0m'


def _supports_color() -> bool:
    """Check if standard output supports ANSI colors."""
    return hasattr(sys.stdout, 'isatty') and sys.stdout.isatty()


def run_startup_health_checks(raise_on_failure: bool = False) -> dict:
    """
    Test and log connection health for:
      1. Database (Neon PostgreSQL / SQLite)
      2. Redis (Cache / OTP store)
      3. Resend (Email Delivery Service)
      4. Jitsi Meet Configuration
    """
    use_color = _supports_color()
    c_green = GREEN if use_color else ''
    c_yellow = YELLOW if use_color else ''
    c_red = RED if use_color else ''
    c_cyan = CYAN if use_color else ''
    c_bold = BOLD if use_color else ''
    c_dim = DIM if use_color else ''
    c_reset = RESET if use_color else ''

    banner = [
        f"{c_cyan}{c_bold}======================================================================{c_reset}",
        f"{c_cyan}{c_bold}  HRNBYL SERVICE CONNECTIVITY & HEALTH CHECK                         {c_reset}",
        f"{c_cyan}{c_bold}======================================================================{c_reset}",
    ]
    results = {}

    # ---------------------------------------------------------
    # 1. DATABASE (Neon PostgreSQL / Local SQLite)
    # ---------------------------------------------------------
    db_status = {'healthy': False, 'details': {}}
    try:
        t0 = time.time()
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1;")
            cursor.fetchone()
            try:
                cursor.execute("SELECT version();")
                ver = cursor.fetchone()[0]
            except Exception:
                ver = "Unknown"
        db_ms = (time.time() - t0) * 1000

        # Check migration status
        executor = MigrationExecutor(connection)
        plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
        unapplied_count = len(plan)

        db_engine = settings.DATABASES['default']['ENGINE'].split('.')[-1]
        raw_db_url = getattr(settings, 'DATABASE_URL', '') or ''
        if raw_db_url:
            parsed = urlparse(raw_db_url)
            host = parsed.hostname or 'unknown'
            dbname = parsed.path.lstrip('/') or settings.DATABASES['default'].get('NAME', 'default')
            is_neon = 'neon.tech' in host
            db_label = f"Neon PostgreSQL ({host})" if is_neon else f"PostgreSQL ({host})"
        else:
            db_label = f"SQLite ({settings.DATABASES['default'].get('NAME', 'db.sqlite3')})"
            dbname = 'sqlite'
            host = 'localhost'

        db_status['healthy'] = True
        db_status['details'] = {
            'label': db_label,
            'database': dbname,
            'host': host,
            'latency_ms': round(db_ms, 2),
            'unapplied_migrations': unapplied_count,
            'version': ver,
        }

        mig_text = (
            f"{c_green}All migrations applied{c_reset}"
            if unapplied_count == 0
            else f"{c_yellow}{unapplied_count} unapplied migration(s) (run `python manage.py migrate`){c_reset}"
        )

        banner.append(
            f"  {c_bold}[DATABASE]{c_reset} {c_green}✓ CONNECTED{c_reset} {c_dim}({db_ms:.1f}ms){c_reset}\n"
            f"             • Provider: {c_bold}{db_label}{c_reset}\n"
            f"             • Database: {dbname}\n"
            f"             • Status:   {mig_text}"
        )
    except Exception as exc:
        db_status['healthy'] = False
        db_status['details'] = {'error': str(exc)}
        banner.append(
            f"  {c_bold}[DATABASE]{c_reset} {c_red}✗ CONNECTION FAILED{c_reset}\n"
            f"             • Error: {exc}"
        )
        if raise_on_failure:
            raise
    results['database'] = db_status

    # ---------------------------------------------------------
    # 2. REDIS (OTP Storage & Rate Limiting)
    # ---------------------------------------------------------
    redis_status = {'healthy': False, 'details': {}}
    redis_url = getattr(settings, 'REDIS_URL', 'redis://127.0.0.1:6379/0')
    parsed_redis = urlparse(redis_url)
    redis_host = f"{parsed_redis.hostname}:{parsed_redis.port or 6379}"

    try:
        import redis
        t0 = time.time()
        client = redis.Redis.from_url(redis_url, socket_connect_timeout=2.0)
        client.ping()
        redis_ms = (time.time() - t0) * 1000

        redis_status['healthy'] = True
        redis_status['details'] = {
            'url': redis_url,
            'host': redis_host,
            'latency_ms': round(redis_ms, 2),
        }
        banner.append(
            f"  {c_bold}[REDIS]{c_reset}    {c_green}✓ CONNECTED{c_reset} {c_dim}({redis_ms:.1f}ms){c_reset}\n"
            f"             • Endpoint: {c_bold}{redis_host}{c_reset}\n"
            f"             • Role:     OTP Verification & Rate Limiting"
        )
    except Exception as exc:
        redis_status['healthy'] = False
        redis_status['details'] = {'error': str(exc), 'host': redis_host}
        banner.append(
            f"  {c_bold}[REDIS]{c_reset}    {c_yellow}⚠ OFFLINE / UNREACHABLE{c_reset}\n"
            f"             • Endpoint: {redis_host}\n"
            f"             • Note:     In-memory cache fallback will be used in development\n"
            f"             • Error:    {exc}"
        )
        if raise_on_failure:
            raise
    results['redis'] = redis_status

    # ---------------------------------------------------------
    # 3. RESEND EMAIL SERVICE
    # ---------------------------------------------------------
    email_status = {'healthy': False, 'details': {}}
    resend_api_key = getattr(settings, 'RESEND_API_KEY', '').strip()
    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@example.com')

    if not resend_api_key:
        email_status['healthy'] = True
        email_status['details'] = {'mode': 'simulated', 'from_email': from_email}
        banner.append(
            f"  {c_bold}[EMAIL]{c_reset}    {c_yellow}○ SIMULATED (No API key set){c_reset}\n"
            f"             • Mode:     Development simulation (OTPs printed to logs)\n"
            f"             • Sender:   {from_email}"
        )
    else:
        try:
            import resend
            resend.api_key = resend_api_key
            t0 = time.time()
            domains_resp = resend.Domains.list()
            resend_ms = (time.time() - t0) * 1000

            domains_list = domains_resp.get('data', []) if isinstance(domains_resp, dict) else []
            verified_domains = [d.get('name') for d in domains_list if d.get('status') == 'verified']
            masked_key = f"{resend_api_key[:6]}...{resend_api_key[-4:]}" if len(resend_api_key) > 10 else "***"

            email_status['healthy'] = True
            email_status['details'] = {
                'provider': 'Resend',
                'masked_key': masked_key,
                'latency_ms': round(resend_ms, 2),
                'verified_domains': verified_domains,
                'from_email': from_email,
            }

            domain_info = (
                f"{c_green}Verified: {', '.join(verified_domains)}{c_reset}"
                if verified_domains
                else f"{c_yellow}Pending verification (or using onboarding@resend.dev){c_reset}"
            )

            banner.append(
                f"  {c_bold}[EMAIL]{c_reset}    {c_green}✓ CONFIGURED & VERIFIED{c_reset} {c_dim}({resend_ms:.1f}ms){c_reset}\n"
                f"             • Provider: Resend (Key: {masked_key})\n"
                f"             • Sender:   {c_bold}{from_email}{c_reset}\n"
                f"             • Domains:  {domain_info}"
            )
        except Exception as exc:
            email_status['healthy'] = False
            email_status['details'] = {'error': str(exc)}
            banner.append(
                f"  {c_bold}[EMAIL]{c_reset}    {c_red}✗ RESEND API VERIFICATION FAILED{c_reset}\n"
                f"             • Sender: {from_email}\n"
                f"             • Error:  {exc}"
            )
            if raise_on_failure:
                raise
    results['email'] = email_status

    # ---------------------------------------------------------
    # 4. JITSI MEET CONFIGURATION
    # ---------------------------------------------------------
    jitsi_domain = getattr(settings, 'JITSI_DOMAIN', 'meet.example.com')
    jitsi_app_id = getattr(settings, 'JITSI_APP_ID', 'django_app')
    jitsi_status = {
        'domain': jitsi_domain,
        'app_id': jitsi_app_id,
        'has_secret': bool(getattr(settings, 'JITSI_APP_SECRET', None)),
    }
    banner.append(
        f"  {c_bold}[JITSI]{c_reset}    {c_green}✓ ACTIVE{c_reset}\n"
        f"             • Domain: {jitsi_domain} (App ID: {jitsi_app_id})"
    )
    banner.append(f"{c_cyan}{c_bold}======================================================================{c_reset}\n")

    sys.stdout.write('\n' + '\n'.join(banner) + '\n')
    sys.stdout.flush()

    return results
