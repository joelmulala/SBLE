# SBLE — Local Setup Guide (No Docker)

This guide runs SBLE on your machine without Docker: JWT auth, PostgreSQL, course workspace, gradebook, calendar, and **LiveKit** live classes.

---

## What You Need

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| PostgreSQL | 14+ | Default port `5432` |
| Redis | 7+ (optional) | Memurai on Windows, or skip for in-memory sessions |
| LiveKit | Cloud or self-hosted | Required for live video rooms |

---

## Step 1 — PostgreSQL

Create the database and apply the schema:

```bash
psql -U postgres
```

```sql
CREATE DATABASE sble;
\q
```

```bash
psql -U postgres -d sble -f server/db/init.sql
```

Set `DB_*` in `server/.env` to match your Postgres user and password.

---

## Step 2 — Redis (optional)

**Windows:** [Memurai](https://www.memurai.com) as a service.

**Linux / Mac / WSL:**

```bash
redis-server
redis-cli ping   # expect PONG
```

If Redis is not running, leave `REDIS_HOST` unset — sessions use in-memory storage (fine for local dev).

---

## Step 3 — Environment

Create `server/.env` (minimum):

```env
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sble
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=any_random_string_at_least_32_chars
ENCRYPTION_KEY=exactly_32_characters_here!

TEMP_LECTURER_PASSWORD=lecturer123
TEMP_STUDENT_PASSWORD=student123
TEMP_ADMIN_PASSWORD=admin123

# Dev login is blocked in production unless you set:
# ALLOW_DEV_LOGIN=true

CLIENT_URL=http://localhost:3000
```

### Email & password reset (Brevo)

Password recovery sends real emails via [Brevo](https://www.brevo.com/) (free SMTP tier). Create a Brevo account, verify your sender domain or address, then generate an **SMTP key** under *SMTP & API → SMTP*.

Add to `server/.env`:

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your-brevo-smtp-login@smtp-brevo.com
SMTP_PASS=your-brevo-smtp-key
MAIL_FROM_NAME=SBLE
MAIL_FROM_ADDRESS=no-reply@your-verified-domain.com
CLIENT_URL=http://localhost:3000
```

| Variable | Purpose |
|---|---|
| `SMTP_HOST` / `SMTP_PORT` | Brevo relay (`smtp-relay.brevo.com`, `587`) |
| `SMTP_USER` / `SMTP_PASS` | Brevo SMTP credentials |
| `MAIL_FROM_NAME` / `MAIL_FROM_ADDRESS` | Branded sender (must be verified in Brevo) |
| `CLIENT_URL` | Base URL for reset links (`/reset-password?token=...`) |
| `PASSWORD_RESET_EXPIRY_MINUTES` | Token lifetime (15–30, default `30`) |

**Local testing without Brevo:** omit `SMTP_*` and set `EMAIL_MODE=dev` — Nodemailer uses Ethereal; check the API server log for an `Ethereal preview URL` after requesting a reset.

**Flows:** `/forgot-password` → email link → `/reset-password?token=...` → sign in with the new password.

Create `client/.env`:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

### LiveKit (live classes)

Add to `server/.env`:

```env
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_WS_URL=wss://your-project.livekit.cloud
```

Get keys from [LiveKit Cloud](https://cloud.livekit.io/) or your self-hosted server. Without these, the API runs but `POST /api/rooms/:roomToken/livekit-token` returns `503`.

---

## Step 4 — Install and run

```bash
cd server
npm install
npm run dev
```

New terminal:

```bash
cd client
npm install
npm start
```

- API: http://localhost:5000  
- App: http://localhost:3000  

---

## Step 5 — Log in and verify

1. Open http://localhost:3000 — use the **SBLE login** page (not an external IdP).
2. Sign in with seeded users (passwords from `TEMP_*_PASSWORD` in `server/.env`) or register at `/register`.
3. Open a course from **My courses** — materials, assignments, quizzes, exams, gradebook, and communication are **course-scoped**.
4. Create a live room and join — allow camera/microphone when prompted.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Database connection failed | Check Postgres is running and `DB_*` in `server/.env` |
| 401 on API calls | Log in again; token is stored as `sbleToken` in `localStorage` |
| Live class has no video | Set `LIVEKIT_*` in `server/.env` and restart the API |
| Redis errors | Unset `REDIS_HOST` for in-memory sessions |
| Password reset email not received | Verify Brevo sender, `SMTP_*`, and `CLIENT_URL`; check server logs |
| Emails not sent (grades, login alerts) | Set `EMAIL_ENABLED=true` and SMTP vars, or use `EMAIL_MODE=dev` for Ethereal previews |

---

## Optional services

| Service | If missing |
|---|---|
| Redis | In-memory sessions; lost on API restart |
| SMTP / Brevo | Password reset and notifications skipped |
| MinIO | Files stored under `server/uploads/` |
| `ENABLE_LEGACY_WEBRTC=true` | Enables old peer WebRTC signaling (not used by default; classroom is LiveKit) |
