# Django Authentication Backend

This is the backend service for the application, built with Django, Django REST Framework, Simple JWT, PostgreSQL (Neon), and Redis.

---

## 1. Directory Structure

```text
server/
├── venv/                         # Python virtual environment
├── manage.py                     # Django management script
├── requirements.txt              # Pinned dependencies
├── .env                          # Local secrets (never committed)
├── .env.example                  # Template configuration
├── .gitignore                    # Git exclusions
├── README.md                     # Backend guide
├── docs/
│   └── authentication.md         # Detailed authentication architecture & API specs
│
├── config/                       # Project configuration
│   ├── __init__.py
│   ├── settings.py               # Django, database, CORS, CSRF, JWT, and Redis settings
│   ├── urls.py                   # Root URL routing (mounts /api/auth/)
│   ├── asgi.py                   # ASGI entrypoint
│   └── wsgi.py                   # WSGI entrypoint
│
└── authentication/               # Dedicated authentication application
    ├── __init__.py
    ├── apps.py                   # App configuration
    ├── admin.py                  # User model admin configuration
    ├── models.py                 # Custom User model (UUID pk, terms accepted, etc.)
    ├── managers.py               # Custom UserManager with normalized emails
    ├── serializers.py            # DRF serializers & password validation
    ├── views.py                  # API views for OTP, register, login, refresh, logout
    ├── urls.py                   # Authentication endpoint routes
    ├── services.py               # Redis atomic operations, OTP digest & email services
    ├── authentication.py         # HttpOnly cookie-based JWT authentication class
    ├── tests.py                  # Test suite covering all 11+ critical cases
    └── migrations/
        ├── __init__.py
        └── 0001_initial.py       # Initial migration for custom User model
```

---

## 2. Technology Stack & Responsibilities

| Component | Technology | Responsibility |
|---|---|---|
| **Web Framework** | Django 5.2 | Request routing, ORM, settings, security middleware |
| **REST API** | Django REST Framework 3.18 | Serializers, permissions, JSON responses |
| **Tokens & Sessions** | Simple JWT 5.5 | Access & refresh tokens, rotation, token blacklisting |
| **Database** | Neon PostgreSQL (or SQLite locally) | User persistence, case-insensitive uniqueness constraints |
| **Cache & OTP State** | Redis 5.3 | Rate limiting, OTP SHA-256 digests, verification tickets |
| **Email Delivery** | Resend | OTP delivery to users |
| **Environment Config** | Python-dotenv 1.2 | Safe environment variable management |
| **Testing** | Django Test Framework | Isolated testing with in-memory Redis and mocked services |

---

## 3. Quick Start & Local Setup

### Step 1: Navigate to the `server/` directory and activate the virtual environment

```bash
cd server
source venv/bin/activate
```

Verify your Python interpreter and version:
```bash
which python
python --version
```

### Step 2: Install dependencies (if needed)

```bash
python -m pip install -r requirements.txt
```

### Step 3: Configure Environment Variables

Copy the template `.env.example` to create your local `.env` file:

```bash
cp .env.example .env
```

Default settings in `.env` are configured for local development:
- `DEBUG=True`
- `DATABASE_URL` is commented out (defaults to local `db.sqlite3` for zero-configuration testing).
- `REDIS_URL=redis://127.0.0.1:6379/0`
- `RESEND_API_KEY` can be left blank for simulated local email output.

---

## 4. Database & External Services

### Configuring Neon PostgreSQL
1. Create a project at [Neon](https://neon.tech).
2. Copy the **Pooled** connection string.
3. In `server/.env`, set:
   ```env
   DATABASE_URL=postgresql://user:password@ep-sample-pooler.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Run migrations:
   ```bash
   python manage.py migrate
   ```

### Configuring Redis
Redis is used for rate limits, OTP digest verification, and temporary verification tickets.
- **Local Redis**: Ensure Redis server is running locally (`redis-server`), or use Docker:
  ```bash
  docker run -d -p 6379:6379 redis:alpine
  ```
- **Remote / Upstash Redis**: In `.env`, set:
  ```env
  REDIS_URL=rediss://default:your-token@your-instance.upstash.io:6379
  ```

### Configuring Resend for Email
1. Sign up at [Resend](https://resend.com) and create an API key.
2. In `server/.env`, set:
   ```env
   RESEND_API_KEY=re_your_api_key_here
   DEFAULT_FROM_EMAIL=Auth <noreply@yourdomain.com>
   ```
*If `RESEND_API_KEY` is not provided, the backend logs simulated OTP delivery in development.*

---

## 5. Running Checks, Migrations, and Development Server

### Run system checks
```bash
python manage.py check
```

### Run migrations
```bash
python manage.py migrate
```

### Start the development server
```bash
python manage.py runserver
```
The API is available at `http://127.0.0.1:8000/`.

---

## 6. Authentication Endpoints Summary

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/auth/csrf/` | Obtain CSRF token cookie (`csrftoken`) | None |
| `POST` | `/api/auth/send-otp/` | Request 6-digit registration OTP via email | None |
| `POST` | `/api/auth/verify-otp/` | Verify OTP and obtain temporary registration ticket | None |
| `POST` | `/api/auth/register/` | Register account using ticket & strong password | None |
| `POST` | `/api/auth/login/` | Authenticate user & set `access_token` and `refresh_token` cookies | None |
| `POST` | `/api/auth/refresh/` | Rotate refresh token & issue new access token cookie | None (Cookie) |
| `POST` | `/api/auth/logout/` | Revoke refresh token & delete auth cookies | None (Cookie) |

For exact request/response schemas, see [`docs/authentication.md`](file:///home/rahul-bastia/Desktop/Hrnbyl.com/jitsi-meet/server/docs/authentication.md).

---

## 7. Running Tests

The test suite runs with fully isolated settings, in-memory mock Redis storage, and mocked email delivery.

Execute the test suite with:
```bash
source venv/bin/activate
python manage.py test
```

### Covered Test Cases:
1. OTP generation and successful verification.
2. Expired and incorrect OTP rejection.
3. Maximum OTP attempts (locks out after 3 failed attempts).
4. Registration rejection without a valid email verification ticket.
5. Password-policy and confirmation validation.
6. Duplicate email registration prevention (case-insensitive).
7. Successful login and generic invalid-credential responses (timing-attack resistant).
8. Authentication cookie flags (`HttpOnly`, `SameSite`, `max-age`, paths).
9. Rate-limit enforcement (IP limits, 60s cooldown, login limits).
10. Refresh-token rotation and logout revocation.
11. Safe handling of Redis and Email provider failures (fail-closed HTTP 503).
12. CSRF cookie setting.
13. End-to-end registration flow and subsequent login.

---

## 8. Known Limitations & Production Checklist

1. **Production HTTPS**: Set `DEBUG=False` and ensure cookies use `Secure=True` over HTTPS.
2. **Reverse Proxies**: Set `NUM_PROXIES=1` (or matching your architecture) when behind Nginx, AWS ALB, or Cloudflare to safely extract client IPs for rate limiting.
3. **Database Migration**: Remote Neon migrations must be applied explicitly after configuring `DATABASE_URL` via `python manage.py migrate`.
