# SBLE — Secure Blended Learning Environment

A full-stack Learning Management System with end-to-end file encryption, Keycloak authentication, WebRTC video rooms, and real-time notifications.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + React Router 6 |
| Backend | Node.js + Express |
| Database | MySQL 8 |
| Auth | Keycloak 23 (OAuth2 / OIDC) |
| Real-time | WebRTC + WebSocket signaling |
| Encryption | AES-256-CBC (all stored files) |
| Notifications | Server-Sent Events (SSE) |
| Sessions | Redis (falls back to in-memory) |
| Storage | Local disk (MinIO-ready) |
| Deployment | Docker Compose or local (see guides) |

---

## Running the Project

### Local (No Docker) — Recommended for development and demos
See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for the full step-by-step guide.

Quick summary:
1. Install MySQL 8, Redis, Keycloak 23, Node.js 18+
2. Create the database and import `server/db/init.sql`
3. Import `keycloak/sble-realm.json` into your local Keycloak
4. Configure `server/.env` with your DB password and secrets
5. `npm install` + `npm run dev` in `server/`
6. `npm install` + `npm start` in `client/`

### Docker (Production)
```bash
cp .env.example .env
# Edit .env with your secrets
# Add SSL certs to nginx/ssl/
docker-compose up --build
```

---

## Features

### Authentication
- Keycloak OIDC login with role-based access (student / lecturer / admin)
- Automatic user sync to local database on first login
- Token refresh handled transparently

### Courses
- Lecturers create and manage courses
- Students enroll in courses
- Role-based views throughout

### Learning Materials
- Lecturers upload files (PDF, Word, images)
- All files encrypted at rest with AES-256-CBC
- Students download and decrypt on the fly

### Assignments
- Lecturers create assignments with due dates
- Students submit files (typed, scanned, or handwritten)
- Lecturers grade submissions with feedback
- Students notified via email + real-time notification on grade

### Quizzes
- Lecturers create MCQ, True/False, and Short Answer quizzes
- Time limit enforced server-side (auto-submit via cron job)
- Auto-grading for MCQ and True/False
- Students see results immediately after submission

### Exams
- Lecturers upload encrypted exam papers (locked until released)
- Lecturers release exams manually
- Enrolled students notified instantly via SSE + email on release
- Students download decrypted exam paper

### WebRTC Rooms
- Lecturers create live video collaboration rooms
- Peer-to-peer video/audio via WebRTC
- In-room text chat
- Mute / stop video controls

### Real-time Notifications
- Bell icon in top bar with unread count
- Grade notifications pushed to student instantly
- Exam release notifications broadcast to all enrolled students
- Powered by Server-Sent Events (no polling)

---

## Security Features

- AES-256-CBC encryption for all stored files
- Keycloak OIDC with RBAC (role-based access control)
- HTTPS enforced in production via Nginx (TLS 1.2/1.3)
- HTTP security headers via Helmet (HSTS, CSP, X-Frame-Options)
- Rate limiting on all API endpoints (100 req / 15 min)
- Audit log for all sensitive actions (uploads, downloads, submissions)
- Exam papers locked until explicitly released by lecturer
- File type and size validation on all uploads (50MB max)
- Session backed by Redis in production

---

## Project Structure

```
sble/
├── client/                  # React frontend
│   ├── src/
│   │   ├── components/      # Layout, shared UI
│   │   ├── config/          # Keycloak + Axios config
│   │   ├── hooks/           # useAuthSync, useNotifications
│   │   └── pages/           # Dashboard, Courses, Materials, Assignments, Quizzes, Exams, Room
│   └── .env                 # Frontend env vars
│
├── server/                  # Node.js backend
│   ├── src/
│   │   ├── config/          # DB, Keycloak, logger, auth
│   │   ├── middleware/       # Auth guard, RBAC, audit
│   │   ├── models/          # Sequelize models
│   │   ├── routes/          # API route handlers
│   │   └── services/
│   │       ├── email/       # Nodemailer email service
│   │       ├── encryption/  # AES-256 file encryption
│   │       ├── notifications/ # SSE service
│   │       ├── scheduler/   # Quiz timer cron job
│   │       ├── storage/     # File upload (disk + MinIO)
│   │       └── webrtc/      # WebSocket signaling server
│   ├── db/init.sql          # MySQL schema
│   └── .env                 # Server env vars
│
├── keycloak/
│   └── sble-realm.json      # Keycloak realm config (import this)
│
├── nginx/                   # Nginx reverse proxy config
├── docker-compose.yml       # Full Docker stack
├── LOCAL_SETUP.md           # Local dev setup guide
├── INTEGRATIONS.md          # Integration tools reference
└── README.md
```

---

## API Reference

| Method | Endpoint | Role | Description |
|---|---|---|---|
| POST | /api/auth/sync | any | Sync Keycloak user to DB |
| GET | /api/auth/me | any | Get current user |
| GET | /api/courses | any | List courses |
| POST | /api/courses | lecturer | Create course |
| POST | /api/courses/:id/enroll | student | Enroll in course |
| POST | /api/materials/upload | lecturer | Upload encrypted material |
| GET | /api/materials/course/:id | any | List materials |
| GET | /api/materials/:id/download | any | Download decrypted material |
| POST | /api/assignments | lecturer | Create assignment |
| GET | /api/assignments/course/:id | any | List assignments |
| POST | /api/assignments/:id/submit | student | Submit assignment |
| PATCH | /api/assignments/submissions/:id/grade | lecturer | Grade submission |
| GET | /api/quizzes/course/:id | any | List quizzes |
| POST | /api/quizzes | lecturer | Create quiz |
| PATCH | /api/quizzes/:id/publish | lecturer | Publish quiz |
| GET | /api/quizzes/:id | any | Get quiz with questions |
| POST | /api/quizzes/:id/attempt | student | Submit quiz attempt |
| GET | /api/exams/course/:id | any | List exams |
| POST | /api/exams/upload | lecturer | Upload encrypted exam |
| PATCH | /api/exams/:id/release | lecturer | Release exam to students |
| GET | /api/exams/:id/download | any | Download exam (if released) |
| POST | /api/rooms | lecturer | Create WebRTC room |
| GET | /api/rooms/course/:id | any | List active rooms |
| PATCH | /api/rooms/:id/close | lecturer | Close room |
| GET | /api/notifications/stream | any | SSE notification stream |
| GET | /api/health | public | Health check |
