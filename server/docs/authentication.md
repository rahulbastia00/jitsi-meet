# Authentication System Specification & Design

## 1. Overview and Architecture

The authentication backend is built using Django and Django REST Framework (DRF) with custom security layers for email OTP verification, password hashing, and HttpOnly cookie-based JWT sessions.

### Key Architectural Decisions

1. **HttpOnly Cookie Delivery**: Access and refresh tokens are delivered as secure, `HttpOnly`, `SameSite=Lax` cookies rather than exposed in response JSON bodies. This shields tokens from cross-site scripting (XSS) extraction.
2. **Dual-Factor Registration Verification**: Users cannot register without first proving email ownership via a cryptographically random 6-digit OTP. Once verified, a temporary 15-minute verification ticket is issued.
3. **Storage Security**:
   - Plaintext OTPs are **never stored** in the database or cache.
   - Redis stores only the **SHA-256 digest** of the OTP.
   - Password hashes use Django's PBKDF2 with SHA-256 (industry-standard key-stretching).
4. **Timing Attack & Enumeration Resistance**:
   - OTP requests for existing accounts return generic success responses without revealing whether the account exists.
   - Login attempts for non-existent users perform a dummy password hash computation to normalize response latency.
5. **Fail-Closed Resilience**:
   - If Redis is unavailable, rate-limiting and verification endpoints fail closed (HTTP 503) rather than bypassing checks.

---

## 2. Token Lifetimes & Cookie Policies

| Cookie Name | Scope / Path | Lifetime | HttpOnly | SameSite | Secure |
|---|---|---|---|---|---|
| `access_token` | `/` | 15 minutes | `True` | `Lax` (configurable) | `True` in prod |
| `refresh_token` | `/api/auth/` | 7 days | `True` | `Lax` (configurable) | `True` in prod |
| `csrftoken` | `/` | Session / 1 year | `False` (frontend must read) | `Lax` | `True` in prod |

- **Refresh Token Rotation**: Each call to `/api/auth/refresh/` invalidates (blacklists) the previous refresh token and issues a new access and refresh token pair.
- **Refresh Path Isolation**: The `refresh_token` cookie is scoped to `/api/auth/`, ensuring it is not sent with general API requests.

---

## 3. Rate Limits and Abuse Prevention

| Target | Window / Threshold | Key Pattern | Action on Breach |
|---|---|---|---|
| OTP Request Cooldown | 60 seconds per email | `otp_throttle:{normalized_email}` | HTTP 429 Too Many Requests |
| OTP Requests by IP | 5 per hour per IP | `ratelimit:ip:{client_ip}` | HTTP 429 Too Many Requests |
| OTP Failed Attempts | Max 3 attempts per code | `otp:{normalized_email}` -> `attempts` | OTP deleted, HTTP 400 |
| Login Attempts by IP | Max 10 failed per 15 min | `ratelimit:login:ip:{client_ip}` | HTTP 429 Too Many Requests |
| Login Attempts by Account | Max 5 failed per 15 min | `ratelimit:login:email:{email}` | HTTP 429 Too Many Requests |

---

## 4. API Endpoints

### 1. `GET /api/auth/csrf/`
Obtains the CSRF token cookie required for unsafe HTTP methods (`POST`, `PUT`, `DELETE`).

**Response (`200 OK`)**:
```json
{
  "detail": "CSRF cookie set."
}
```
*Sets `csrftoken` cookie.*

---

### 2. `POST /api/auth/send-otp/`
Requests a 6-digit registration verification code sent to the specified email address.

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response (`200 OK`)**:
```json
{
  "detail": "If the email is eligible, a verification code has been sent."
}
```

**Error Responses**:
- `400 Bad Request`: Invalid email format.
- `429 Too Many Requests`: 60-second cooldown active or IP rate limit exceeded.
- `503 Service Unavailable`: Redis or Resend email delivery outage.

---

### 3. `POST /api/auth/verify-otp/`
Verifies the 6-digit code against the SHA-256 digest stored in Redis and issues a single-use registration ticket.

**Request Body**:
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (`200 OK`)**:
```json
{
  "detail": "Email verified successfully.",
  "verification_ticket": "mK7bW9_xExampleTicketUrlSafeToken32BytesLong"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid code (`"Invalid verification code. 2 attempt(s) remaining."`), expired code, or maximum attempts exceeded.
- `503 Service Unavailable`: Redis service failure.

---

### 4. `POST /api/auth/register/`
Creates a new user account using a valid `verification_ticket`.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "password_confirm": "SecurePassword123!",
  "terms_accepted": true,
  "verification_ticket": "mK7bW9_xExampleTicketUrlSafeToken32BytesLong"
}
```

**Password Requirements**:
- 8 to 128 characters.
- At least one uppercase letter (`A-Z`).
- At least one lowercase letter (`a-z`).
- At least one digit (`0-9`).
- At least one special character (`!@#$%^&*()_+-=[]{};':"|,.<>/?`).
- Passwords must match and satisfy Django's standard common-password checks.

**Response (`201 Created`)**:
```json
{
  "detail": "Account registered successfully."
}
```

---

### 5. `POST /api/auth/login/`
Authenticates a user, resets failed login counters, and sets HttpOnly JWT cookies.

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (`200 OK`)**:
```json
{
  "detail": "Login successful.",
  "user": {
    "id": "e3b0c442-98fc-1c14-9afb-4c8996fb9242",
    "email": "user@example.com"
  }
}
```
*Sets `access_token` and `refresh_token` cookies.*

**Error Responses**:
- `401 Unauthorized`: `"Invalid email or password."` (Generic failure).
- `429 Too Many Requests`: Too many failed login attempts.

---

### 6. `POST /api/auth/refresh/`
Rotates the refresh token and issues a new access token.

**Request**:
No body required; browser automatically sends the `refresh_token` cookie.

**Response (`200 OK`)**:
```json
{
  "detail": "Token refreshed successfully."
}
```
*Updates `access_token` and `refresh_token` cookies.*

**Error Responses**:
- `401 Unauthorized`: Missing, expired, or already-rotated/blacklisted refresh token.

---

### 7. `POST /api/auth/logout/`
Blacklists the current refresh token and deletes both auth cookies.

**Request**:
No body required; sends `refresh_token` cookie.

**Response (`200 OK`)**:
```json
{
  "detail": "Logout successful."
}
```
*Deletes `access_token` and `refresh_token` cookies.*

---

## 5. Frontend Integration Notes

1. **CORS & Credentials**:
   The frontend (e.g. Next.js on `http://localhost:3000`) must make requests with `credentials: 'include'` (fetch) or `withCredentials: true` (axios).
2. **CSRF Protection**:
   Before making state-changing requests (`POST`), call `GET /api/auth/csrf/` once. Read the `csrftoken` cookie and include it in request headers as `X-CSRFToken`.
