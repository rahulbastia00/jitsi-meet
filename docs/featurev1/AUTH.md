
# Feature Specification: Secure Authentication & Session Management

Author : Rahul Bastia
Date : 21 Oct 2026
Version : 1.0.0

This document outlines the architecture, threat modeling, database schema, and operational lifecycle for the backend authentication system built with Django REST Framework, Neon DB (PostgreSQL), Redis, and Next.js.

---

## 1. System Architecture & Component Roles

```
+-------------------------------------------------------------------------------+
|                                Next.js Frontend                               |
|                  (Client-side state, Form guards, Edge Auth)                   |
+------------------------------------+------------------------------------------+
                                     |
                          HTTPS / JSON (REST)
                        HttpOnly Cookies (JWT)
                                     |
                                     v
+-------------------------------------------------------------------------------+
|                             Django API Gateway                                |
|   - Request Validation (Serializers)     - Password Hashing (PBKDF2 / Argon2) |
|   - Rate Limiting Middleware             - JWT Minting & Verification         |
|   - Constant-time Comparators            - Auth Routing                       |
+--------------------+-----------------------------------+----------------------+
                     |                                   |
           Ephemeral State / Cache                 Persistent ACID Store
          (OTPs, Rate Limits, JTI)               (Users, Roles, Metadata)
                     v                                   v
+------------------------------------+   +--------------------------------------+
|               Redis                |   |          Neon DB (Postgres)          |
| - Key-value with native TTL        |   | - Connection-pooled via PgBouncer    |
| - Sub-millisecond lookups          |   | - UUID Primary Keys                  |
| - Atomic counters (`INCR`)         |   | - Strict integrity & constraints     |
+------------------------------------+   +--------------------------------------+
                     ^
                     | Async Events
+--------------------+--------------------+
|  Email Service Worker (SES / Resend)   |
+-----------------------------------------+

```

### Technology Breakdown & Trade-Offs

| Component                           | Choice                                      | Operational Rationale                                                                          | Trade-Off / Alternative Considered                                                                               |
| ----------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **API Framework**             | Django + DRF                                | Mature ORM, battle-tested cryptographic auth helpers, built-in CSRF/timing attack mitigations. | FastAPI is faster asynchronously, but requires hand-rolling session, model, and auth scaffolding.                |
| **Relational Database**       | Neon DB (PostgreSQL)                        | Serverless, auto-scaling storage, native branching for dev environments.                       | SQLite / Raw Postgres: Neon requires connection pooling (PgBouncer) to prevent connection drops on cold starts.  |
| **Caching & Ephemeral Store** | Redis                                       | In-memory key expiration (TTL) for OTPs, atomic operations for throttling.                     | PostgreSQL tables for OTPs: Causes write-amplification, index fragmentation, and requires vacuuming dead tuples. |
| **Migration Engine**          | Native Django ORM                           | Seamless integration with Django models and internal admin.                                    | Alembic: Powerful with SQLAlchemy, but introduces a dual-schema maintenance nightmare inside Django.             |
| **Token Management**          | JWT (`simplejwt`) in `HttpOnly` Cookies | Zero frontend exposure to raw tokens (XSS immune), smooth Next.js API/middleware verification. | `localStorage` JWTs: Trivially exploitable via client-side script injection.                                   |

---

## 2. Core System Design Principles & Threat Defense

### 2.1. Cryptographic Entropy & OTP Hardening

* **Vulnerability:** Standard pseudo-random number generators (`random.randint`) use deterministic mathematical algorithms seeded by system clocks. If an attacker determines or bounds the server timestamp, they can predict OTP sequences.
* **Mitigation:** The system uses the OS-level CSPRNG (`secrets` module), sourcing entropy from kernel interrupts and hardware noise.
* **Zero-Knowledge OTP Cache:** OTPs are never stored in plaintext within Redis. The server hashes incoming OTPs using SHA-256 before caching. Even an internal cache compromise or Redis snapshot leak will not expose usable authentication codes.

### 2.2. Timing Attack Mitigation

* **Vulnerability:** Standard string comparisons (`a == b`) short-circuit on the first mismatched byte, taking variable CPU cycles. Similarly, verifying an existing user's password takes ~100ms (key derivation), while rejecting a non-existent email takes ~2ms (DB lookup failure). Attackers analyze this latency delta to map registered accounts.
* **Mitigation:**

1. Constant-time byte comparisons (`secrets.compare_digest`) for all token and signature checks.
2. Dummy hash evaluation: If an email lookup returns empty, the authentication pipeline runs a full password derivation cycle against a statically configured dummy hash before emitting an HTTP 401 response.

### 2.3. Distributed Abuse Prevention & Rate Limiting

* **Denial-of-Wallet & Mailbox Spamming:** Attackers trigger repeated OTP generation calls to inflate operational costs and burn sender domain reputation.
* **Defense Strategy:** Multi-tier Redis sliding-window limiters:
* Max 1 OTP generation request per email per 60 seconds.
* Max 5 OTP requests per IP per hour.
* Max 3 verification failures per OTP before the key is discarded from Redis.

---

## 3. Database Schema Specification

### Table: `users`

Custom user model replacing Django's default `auth_user` table.

```
+--------------------+--------------------------+--------------------------------------------------+
| Column Name        | Type                     | Constraints & Attributes                         |
+--------------------+--------------------------+--------------------------------------------------+
| id                 | UUID                     | PRIMARY KEY, DEFAULT gen_random_uuid()           |
| email              | VARCHAR(255)             | UNIQUE, NOT NULL, INDEX (LOWER)                  |
| password           | VARCHAR(255)             | NOT NULL (Encoded: algo$iters$salt$hash)         |
| terms_accepted     | BOOLEAN                  | NOT NULL, DEFAULT FALSE                          |
| terms_accepted_at  | TIMESTAMP WITH TIME ZONE | NULLABLE                                         |
| is_active          | BOOLEAN                  | NOT NULL, DEFAULT TRUE                           |
| is_staff           | BOOLEAN                  | NOT NULL, DEFAULT FALSE                          |
| is_superuser       | BOOLEAN                  | NOT NULL, DEFAULT FALSE                          |
| created_at         | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT CURRENT_TIMESTAMP              |
| updated_at         | TIMESTAMP WITH TIME ZONE | NOT NULL, DEFAULT CURRENT_TIMESTAMP              |
+--------------------+--------------------------+--------------------------------------------------+

```

### Redis Key-Value Store Topology

| Key Pattern                | Data Structure      | TTL        | Purpose                                                  |
| -------------------------- | ------------------- | ---------- | -------------------------------------------------------- |
| `otp:{email}`            | Hash / JSON         | 300s (5m)  | Stores `{"hash": "<sha256>", "attempts": 0}`           |
| `otp_throttle:{email}`   | String              | 60s (1m)   | Cooldown guard against rapid re-sends                    |
| `email_verified:{email}` | String (`"true"`) | 900s (15m) | Grants temporary ticket to complete registration         |
| `ratelimit:ip:{ip}`      | Integer             | 3600s (1h) | Tracks hourly request rate per IP                        |
| `jwt_blocklist:{jti}`    | String              | Dynamic    | Stores invalidated refresh token IDs until native expiry |

---

## 4. End-to-End Authentication Flows

### Flow 1: Pre-Registration Email Verification

```
User (Next.js)                 Django API Gateway                  Redis Store               Email Service
      |                                |                                |                          |
      | 1. POST /auth/send-otp/        |                                |                          |
      |    { email }                   |                                |                          |
      |------------------------------->|                                |                          |
      |                                |-- 2. Check throttle ---------->|                          |
      |                                |<-- [Throttle OK / Passed] -----|                          |
      |                                |-- 3. Check DB for duplicate -->|                          |
      |                                |                                |                          |
      |                                |-- 4. Generate CSPRNG OTP       |                          |
      |                                |      Hash OTP via SHA-256      |                          |
      |                                |                                |                          |
      |                                |-- 5. Save Hash + TTL (300s) -->|                          |
      |                                |-- 6. Dispatch async task -------------------------------->|
      |<-- 200 OK (OTP Sent) ----------|                                                           |-- 7. Send Email
      |                                                                                            |   to user
      |                                                                                            v
      | 8. POST /auth/verify-otp/      |                              
      |    { email, otp }              |                              
      |------------------------------->|                              
      |                                |-- 9. Fetch stored hash ------->|
      |                                |<-- Return cached payload ------|
      |                                |
      |                                |-- 10. Check attempts count
      |                                |       Compare hashes (constant-time)
      |                                |
      |                                |-- 11. Evict `otp:{email}` ---->|
      |                                |-- 12. Set `email_verified` --->|
      |                                |       TTL: 900s                |
      |<-- 200 OK (Verified) ----------|

```

### Flow 2: User Final Registration & Account Provisioning

```
User (Next.js)                 Django API Gateway                  Redis Store             Neon DB (Postgres)
      |                                |                                |                          |
      | 1. POST /auth/register/        |                                |                          |
      |    { email, password,          |                                |                          |
      |      confirm_password, terms } |                                |                          |
      |------------------------------->|                                |                          |
      |                                |-- 2. Check `email_verified` -->|                          |
      |                                |<-- [Status: Valid] ------------|                          |
      |                                |                                |                          |
      |                                |-- 3. Validate Rules:           |                          |
      |                                |      - terms == true           |                          |
      |                                |      - password == confirm     |                          |
      |                                |      - Complexity RegEx        |                          |
      |                                |                                |                          |
      |                                |-- 4. Salt & Hash Password      |                          |
      |                                |      (PBKDF2-SHA256)           |                          |
      |                                |                                |                          |
      |                                |-- 5. Insert Record -------------------------------------->|
      |                                |<-- Record Committed (UUID) -------------------------------|
      |                                |                                |                          |
      |                                |-- 6. Invalidate verified key ->|                          |
      |                                |                                |                          |
      |                                |-- 7. Generate JWT Keypair      |                          |
      |                                |      Access Token (15m)        |                          |
      |                                |      Refresh Token (7d)        |                          |
      |                                |                                |                          |
      |<-- 201 Created ----------------|                                |                          |
      |    Set-Cookie: access_token    |                                |                          |
      |    Set-Cookie: refresh_token   |                                |                          |

```

### Flow 3: Login & Session State Management

```
User (Next.js)                 Django API Gateway             Neon DB (Postgres)
      |                                |                              |
      | 1. POST /auth/login/           |                              |
      |    { email, password }         |                              |
      |------------------------------->|                              |
      |                                |-- 2. Query user by email --->|
      |                                |<-- Return record / null -----|
      |                                |
      |                                |-- 3. Run Authenticate:
      |                                |      - If user: verify hash
      |                                |      - If null: run dummy hash (prevent timing leak)
      |                                |
      |                                |-- 4. Generate JWTs (access + refresh)
      |<-- 200 OK ---------------------|
      |    Set-Cookie: access_token (HttpOnly, Secure, SameSite=Lax, 15m)
      |    Set-Cookie: refresh_token (HttpOnly, Secure, SameSite=Lax, 7d)

```

---

## 5. Security & Validation Rules Engine

### 5.1. Password Policy Specification

Incoming registration payloads must pass all conditions before any database or hashing transaction occurs:

* **Length:** Min 8, Max 128 characters.
* **Character Diversity:**
* Lowercase: at least one character matching `[a-z]`
* Uppercase: at least one character matching `[A-Z]`
* Numeric: at least one digit matching `[0-9]`
* Special Characters: at least one symbol matching `[!@#$%^&*(),.?":{}|<>]`
* **Common Dictionary Rejection:** Evaluation against Django's `CommonPasswordValidator` to deny common sequences (e.g., `Password123!`).

### 5.2. Cookie Delivery Directives

Authentication tokens are delivered strictly via response headers using the following configuration flags:

```http
Set-Cookie: access_token=<JWT>; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Lax
Set-Cookie: refresh_token=<JWT>; Max-Age=604800; Path=/api/auth/; HttpOnly; Secure; SameSite=Lax

```

* `HttpOnly`: Prevents client-side scripts (`document.cookie`) from accessing the token, eliminating XSS token theft.
* `Secure`: Enforces transmission exclusively over TLS/HTTPS channels (disabled during local development).
* `SameSite=Lax`: Defends against Cross-Site Request Forgery (CSRF) on cross-origin navigation while maintaining standard top-level browsing ergonomics.
* `Path Restriction`: The `refresh_token` cookie is restricted to `/api/auth/`, ensuring it is only transmitted to authentication management endpoints.

---

## 6. Failure Modes & Edge Case Matrix

s

| Fault / Failure Scenario             | Immediate System Behavior                                                | Recovery / Fallback Mechanism                                                                                                                   |
| ------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Neon DB Cold Start / Drop**  | Connection pool times out or drops open socket.                          | Configure `CONN_MAX_AGE=0` or keep connections managed through Neon's PgBouncer pooler (`-pooler` endpoint) with automatic reconnect flags. |
| **Redis Cache Outage**         | OTP validation and rate-limiting calls fail.                             | Health check intercepts the failure. Endpoints degrade gracefully, returning HTTP 503 rather than falling back to un-throttled DB lookups.      |
| **Email Worker Failure**       | OTP is hashed in Redis, but third-party API (SES/Resend) fails delivery. | Asynchronous worker logs the retry queue. If dead-letter limit is reached, user triggers the 60-second cooldown retry.                          |
| **Concurrent OTP Submissions** | Attacker issues race-condition requests to brute-force a 6-digit OTP.    | Verification view performs an atomic `INCR` on `attempts`. If `attempts > 3`, the key is immediately dropped from Redis.                  |
| **Abandoned Registrations**    | User verifies OTP but closes the browser before setting a password.      | No orphaned record exists in PostgreSQL. The `email_verified` key in Redis naturally expires after 15 minutes.                                |
