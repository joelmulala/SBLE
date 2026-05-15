# SBLE — System Integration Document

**Project:** Secure Blended Learning Environment (SBLE)
**Version:** 1.0
**Date:** April 2026
**Type:** Full-Stack Web Application — Local Deployment

---

## 1. System Overview

SBLE is a secure, role-based Learning Management System built for blended learning delivery.
It integrates authentication, encrypted file storage, real-time video collaboration,
automated assessment, and live notifications into a single cohesive platform.

The system is designed to run fully locally without Docker for development and presentation,
while remaining Docker-ready for production deployment.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT BROWSER                           │
│   React 18 + React Router 6 + AuthProvider (JWT) + Axios + SSE │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTPS / HTTP (dev)
┌────────────────────────▼────────────────────────────────────────┐
│                     NODE.JS EXPRESS SERVER                      │
│  Auth │ Courses │ Materials │ Assignments │ Quizzes │ Exams     │
│  Rooms (LiveKit) │ Notifications │ Calendar │ Gradebook          │
└──┬──────────┬──────────┬──────────┬──────────┬─────────────────┘
   │          │          │          │          │
   ▼          ▼          ▼          ▼          ▼
PostgreSQL  JWT auth   Redis      Local      node-cron
(data)     (Bearer)   (sessions)  Disk/MinIO  (quiz timer)
                              LiveKit (RTC)
                               (files)
```


---

## 3. Component Inventory

| Component | Technology | Version | Role |
|---|---|---|---|
| Frontend | React | 18.2 | UI layer |
| Routing | React Router | 6.20 | Client-side navigation |
| HTTP Client | Axios | 1.6 | API communication |
| Auth Client | AuthProvider + JWT | — | Login, token storage, role checks |
| Backend | Node.js + Express | 18 LTS / 4.18 | REST API + WebSocket server |
| ORM | Sequelize | 6.33 | Database abstraction |
| Database | PostgreSQL | 14+ | Persistent data store |
| Auth | jsonwebtoken | 9.x | JWT sign/verify |
| Session Store | Redis (optional) | 7 | Persistent session storage |
| File Encryption | Node.js crypto (AES-256-CBC) | built-in | At-rest file encryption |
| File Upload | Multer | 1.4.5 | Multipart form handling |
| Object Storage | Local disk / MinIO (optional) | — / latest | File persistence |
| Live classroom | LiveKit | 2.x | SFU video/audio for rooms |
| WS Signaling | ws (npm) | 8.14 | Optional legacy WebRTC (`ENABLE_LEGACY_WEBRTC`) |
| Notifications | Server-Sent Events (SSE) | built-in HTTP | Real-time push to browser |
| Email | Nodemailer | 6.9 | SMTP email delivery |
| Scheduler | node-cron | 3.0 | Quiz timer enforcement |
| Logging | Winston | 3.11 | Structured server logging |
| Security Headers | Helmet | 7.1 | HTTP security headers |
| Rate Limiting | express-rate-limit | 7.1 | API abuse prevention |

---

## 4. Integration Map

Each integration point below describes what connects to what, how, and what happens if it is unavailable.

### 4.1 Frontend ↔ JWT Auth

- **Protocol:** HTTP JSON (`POST /api/auth/login`, `GET /api/auth/me`)
- **Client:** `client/src/auth/AuthProvider.js` — `useAuth()` / `useKeycloak()` (compat shim)
- **Storage:** `localStorage` key `sbleToken`
- **What it does:** Login form posts credentials; API returns JWT; Axios sends `Authorization: Bearer <token>` on protected routes.
- **If unavailable:** Users cannot sign in; protected pages redirect to `/login`.

### 4.2 Frontend ↔ Express API

- **Protocol:** HTTP REST (JSON)
- **Base URL:** `http://localhost:5000/api` (dev) / `/api` (production via Nginx)
- **Config file:** `client/src/config/api.js`
- **Auth:** Bearer token injected by Axios interceptor on every request
- **Endpoints:** auth, courses, materials, assignments, quizzes, exams, rooms, notifications

### 4.3 Frontend ↔ LiveKit (live classroom)

- **Protocol:** WebRTC via LiveKit SFU
- **Token:** `POST /api/rooms/:roomToken/livekit-token` (server signs with `livekit-server-sdk`)
- **Client:** `livekit-client` through `createClassroomMediaAdapter()` → `livekitAdapter.js`
- **Env:** `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_WS_URL` on the server
- **If unavailable:** Room UI loads but media session cannot start (503 from token route).

Legacy peer WebRTC signaling (`signalingServer.js`) runs only when `ENABLE_LEGACY_WEBRTC=true`.

### 4.4 Frontend ↔ SSE Notification Stream

- **Protocol:** HTTP Server-Sent Events
- **Endpoint:** `GET /api/notifications/stream?token=<jwt>`
- **Config file:** `server/src/routes/notifications.js` + `server/src/services/notifications/sseService.js`
- **What it does:** Pushes real-time events to the browser — grade notifications and exam release alerts.
- **If unavailable:** Notifications simply don't appear. All other features unaffected.

### 4.5 Express API ↔ PostgreSQL

- **Library:** Sequelize ORM (`pg` driver)
- **Config file:** `server/src/config/database.js`
- **Connection:** `DB_HOST:DB_PORT` from environment
- **Pool:** max 10 connections, 30s acquire timeout
- **If unavailable:** Server exits on startup with `Database connection failed`.

### 4.6 Express API ↔ JWT verification

- **Module:** `server/src/config/authGuard.js` (re-exported as `keycloak.js` for legacy requires)
- **What it does:** Verifies Bearer JWT with `JWT_SECRET`; sets `req.user` and `req.kauth` grant shape for role helpers.
- **Middleware:** `authGuard.protect()` + `attachUser` in `server/src/middleware/auth.js`
- **If misconfigured:** Missing `JWT_SECRET` prevents server startup.

### 4.7 Express API ↔ Redis (Sessions)

- **Library:** `ioredis` + `connect-redis`
- **Config file:** `server/src/index.js`
- **What it does:** Stores Express sessions in Redis so they survive server restarts.
- **Fallback:** If `REDIS_HOST` is not set, falls back to in-memory sessions automatically. App still works — sessions are lost on restart only.
- **If unavailable:** Graceful fallback — no crash.

### 4.8 Express API ↔ File System (Uploads)

- **Library:** Multer + Node.js `fs`
- **Config file:** `server/src/services/storage/uploadService.js`
- **Upload path:** `UPLOAD_DIR` env var (default: `./uploads`)
- **Encryption:** Every uploaded file is AES-256-CBC encrypted before being saved. Plaintext is deleted immediately after encryption.
- **Decryption:** On download, file is decrypted and streamed directly to the HTTP response — never written to disk as plaintext.
- **MinIO upgrade:** If `MINIO_ENDPOINT` is set, files are pushed to MinIO after local temp write. Local temp file is deleted.
- **If unavailable:** Upload routes return 500.

### 4.9 Express API ↔ Email (SMTP)

- **Library:** Nodemailer
- **Config file:** `server/src/services/email/emailService.js`
- **Triggers:** Grade submission → student email. Exam release → all enrolled students.
- **Fallback:** If `SMTP_HOST` is not set, email is silently skipped with a log warning. No crash.
- **If unavailable:** Graceful skip — SSE notifications still fire.

### 4.10 Express API ↔ node-cron (Quiz Timer)

- **Library:** node-cron
- **Config file:** `server/src/services/scheduler/quizTimer.js`
- **Schedule:** Every 1 minute (`* * * * *`)
- **What it does:** Finds all open quiz attempts where `submitted_at` is null and elapsed time exceeds `time_limit_minutes`. Auto-submits them.
- **If unavailable:** Quiz time limits are not enforced server-side. Students could keep quizzes open indefinitely.

---

## 5. Data Flow Diagrams

### 5.1 User Login Flow

```
1. User opens http://localhost:3000
2. Unauthenticated users → /login
3. POST /api/auth/login { email, password }
4. API returns JWT + user profile
5. AuthProvider stores token in localStorage (sbleToken)
6. GET /api/auth/me validates session on reload
7. App renders role dashboard (student or lecturer)
```

### 5.2 File Upload Flow (Material / Assignment / Exam)

```
1. Lecturer selects file in browser
2. Frontend sends multipart/form-data to POST /api/materials/upload
3. Axios attaches Bearer token
4. Express: keycloak.protect() validates token
5. Multer saves file to ./uploads/<folder>/<unique-name>
6. encryptFile() reads plaintext → AES-256-CBC → writes .enc file
7. Plaintext file deleted from disk
8. Encrypted path saved to MySQL (materials table)
9. 201 response returned to frontend
```

### 5.3 File Download Flow

```
1. Student clicks Download
2. GET /api/materials/:id/download with Bearer token
3. Express validates token + logs audit entry
4. MySQL lookup → encrypted file path retrieved
5. decryptFileToStream() reads .enc file → decrypts → pipes to HTTP response
6. Browser receives plaintext file as download
7. Encrypted file remains on disk — never exposed
```

### 5.4 Quiz Attempt Flow

```
1. Student opens published quiz
2. GET /api/quizzes/:id — correct_answer fields stripped from response
3. Student answers questions, clicks Submit
4. POST /api/quizzes/:id/attempt with answers JSON
5. Server auto-grades MCQ + True/False questions
6. QuizAttempt record created with score + submitted_at
7. Score returned to frontend immediately
8. node-cron (every 1 min) auto-submits any attempts past time limit
```

### 5.5 Exam Release + Notification Flow

```
1. Lecturer clicks Release on exam
2. PATCH /api/exams/:id/release
3. Exam.is_released set to true in MySQL
4. Enrollment lookup → all enrolled student emails collected
5. Nodemailer sends email to all students (if SMTP configured)
6. SSE broadcast fires → all connected students receive exam-released event
7. Notification bell in Layout.js increments + shows exam title
```

### 5.6 WebRTC Room Flow

```
1. Lecturer creates room → POST /api/rooms → room_token (UUID) stored in MySQL
2. Students see active room in course → click Join
3. Browser navigates to /rooms/:token
4. Room.js opens WebSocket: ws://localhost:5000/ws/?room=<token>
5. signalingServer.js assigns peerId, sends { type: 'connected', peerId }
6. When second peer joins → { type: 'peer-joined' } broadcast
7. First peer creates RTCPeerConnection → createOffer → sends via WS
8. Second peer receives offer → createAnswer → sends via WS
9. ICE candidates exchanged via WS
10. Direct peer-to-peer video/audio established (bypasses server)
11. Chat messages broadcast through WS signaling server
```

---

## 6. Security Integration Points

| Point | Mechanism | Implementation |
|---|---|---|
| Authentication | Keycloak OIDC JWT | `keycloak.protect()` on all routes |
| Authorization | Realm role RBAC | `requireRole('lecturer','admin')` middleware |
| Token validation | keycloak-connect | Validates signature + expiry on every request |
| File encryption | AES-256-CBC | `fileEncryption.js` — encrypt on upload, decrypt on download |
| Transport security | HTTPS (production) | Nginx TLS 1.2/1.3 termination |
| HTTP headers | Helmet | CSP, HSTS, X-Frame-Options, X-Content-Type-Options |
| Rate limiting | express-rate-limit | 100 requests per 15 minutes per IP |
| Audit logging | AuditLog model | Logged on upload, download, submission, exam access |
| Session security | httpOnly cookies | `cookie: { httpOnly: true, secure: true }` in production |
| Input validation | Multer file filter | MIME type whitelist + 50MB size limit |

---

## 7. Environment Configuration Reference

All integration behaviour is controlled via environment variables in `server/.env` and `client/.env`.

### server/.env

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DB_DIALECT` | No | postgres | `postgres` (default) |
| `DB_HOST` | Yes | localhost | PostgreSQL host |
| `DB_PORT` | No | 5432 | PostgreSQL port |
| `DB_NAME` | Yes | sble | Database name |
| `DB_USER` | Yes | — | Database user |
| `DB_PASSWORD` | Yes | — | Database password |
| `JWT_SECRET` | Yes | — | JWT signing + session secret |
| `TEMP_STUDENT_PASSWORD` | No | — | Dev login password for seeded student |
| `TEMP_LECTURER_PASSWORD` | No | — | Dev login password for seeded lecturer |
| `TEMP_ADMIN_PASSWORD` | No | — | Dev login password for seeded admin |
| `ENABLE_LEGACY_WEBRTC` | No | — | Set `true` to enable old WebSocket signaling |
| `ENCRYPTION_KEY` | Yes | — | AES-256 key (32 chars) |
| `UPLOAD_DIR` | No | ./uploads | Local file storage path |
| `REDIS_HOST` | No | — | Redis host (blank = in-memory) |
| `REDIS_PORT` | No | 6379 | Redis port |
| `REDIS_PASSWORD` | No | — | Redis auth password |
| `SMTP_HOST` | No | — | SMTP server (blank = skip email) |
| `SMTP_PORT` | No | 587 | SMTP port |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `MINIO_ENDPOINT` | No | — | MinIO host (blank = local disk) |
| `LIVEKIT_API_KEY` | No | — | LiveKit API key; if any of the three LiveKit vars are missing, `POST /api/rooms/:roomToken/livekit-token` returns 503 |
| `LIVEKIT_API_SECRET` | No | — | LiveKit API secret |
| `LIVEKIT_WS_URL` | No | — | LiveKit WebSocket URL (e.g. `wss://…`) returned to clients as `serverUrl` |
| `CLIENT_URL` | No | http://localhost:3000 | CORS allowed origin |

### client/.env

| Variable | Default | Purpose |
|---|---|---|
| `REACT_APP_API_URL` | http://localhost:5000/api | Backend API base URL |

---

## 8. Service Dependency Matrix

| Service | Required | Fallback if absent | Affected features |
|---|---|---|---|
| PostgreSQL | YES | None — server exits | Everything |
| JWT / `JWT_SECRET` | YES | Server won't start | Auth |
| LiveKit | No* | Live rooms return 503 token | Video only |
| Redis | No | In-memory sessions | Sessions lost on restart |
| SMTP | No | Emails silently skipped | Email notifications |
| MinIO | No | Local disk storage | File persistence at scale |
| TURN/Coturn | No | WebRTC on local network only | Cross-network video |
| node-cron | Built-in | N/A | Quiz time enforcement |
| SSE | Built-in | N/A | Real-time notifications |

---

## 9. API Endpoint Integration Summary

| Method | Path | Auth | Role | Integrations Used |
|---|---|---|---|---|
| POST | /api/auth/sync | JWT | any | Keycloak, MySQL |
| GET | /api/auth/me | JWT | any | Keycloak, MySQL |
| GET | /api/courses | JWT | any | Keycloak, MySQL |
| POST | /api/courses | JWT | lecturer/admin | Keycloak, MySQL, AuditLog |
| POST | /api/courses/:id/enroll | JWT | student | Keycloak, MySQL |
| GET | /api/courses/:id | JWT | any | Keycloak, MySQL |
| POST | /api/materials/upload | JWT | lecturer/admin | Keycloak, Multer, AES-256, MySQL, AuditLog |
| GET | /api/materials/course/:id | JWT | any | Keycloak, MySQL |
| GET | /api/materials/:id/download | JWT | any | Keycloak, MySQL, AES-256, AuditLog |
| POST | /api/assignments | JWT | lecturer/admin | Keycloak, MySQL |
| GET | /api/assignments/course/:id | JWT | any | Keycloak, MySQL |
| POST | /api/assignments/:id/submit | JWT | student | Keycloak, Multer, AES-256, MySQL, AuditLog |
| PATCH | /api/assignments/submissions/:id/grade | JWT | lecturer/admin | Keycloak, MySQL, Nodemailer, SSE |
| GET | /api/quizzes/course/:id | JWT | any | Keycloak, MySQL |
| POST | /api/quizzes | JWT | lecturer/admin | Keycloak, MySQL |
| PATCH | /api/quizzes/:id/publish | JWT | lecturer/admin | Keycloak, MySQL |
| GET | /api/quizzes/:id | JWT | any | Keycloak, MySQL |
| POST | /api/quizzes/:id/attempt | JWT | student | Keycloak, MySQL, node-cron |
| GET | /api/exams/course/:id | JWT | any | Keycloak, MySQL |
| POST | /api/exams/upload | JWT | lecturer/admin | Keycloak, Multer, AES-256, MySQL, AuditLog |
| PATCH | /api/exams/:id/release | JWT | lecturer/admin | Keycloak, MySQL, Nodemailer, SSE |
| GET | /api/exams/:id/download | JWT | any | Keycloak, MySQL, AES-256, AuditLog |
| POST | /api/rooms | JWT | lecturer/admin | Keycloak, MySQL |
| GET | /api/rooms/course/:id | JWT | any | Keycloak, MySQL |
| PATCH | /api/rooms/:id/close | JWT | lecturer/admin | Keycloak, MySQL |
| GET | /api/notifications/stream | JWT (query) | any | SSE |
| WS | /ws/?room=:token | none | any | WebSocket, WebRTC signaling |
| GET | /api/health | none | public | — |

---

## 10. File Structure Reference

```
sble/
├── client/
│   ├── public/index.html
│   ├── src/
│   │   ├── App.js                        # Routes + ProtectedRoute
│   │   ├── index.js                      # ReactKeycloakProvider root
│   │   ├── index.css                     # Global reset styles
│   │   ├── config/
│   │   │   ├── api.js                    # Axios instance + token interceptor
│   │   │   └── keycloak.js               # Keycloak client config
│   │   ├── hooks/
│   │   │   ├── useAuthSync.js            # Syncs Keycloak user to DB on login
│   │   │   └── useNotifications.js       # SSE connection + notification state
│   │   ├── components/
│   │   │   ├── Layout.js                 # Shell, sidebar, notification bell
│   │   │   └── Layout.module.css
│   │   └── pages/
│   │       ├── Dashboard.js              # Welcome + course overview
│   │       ├── Courses.js                # Course list + enroll
│   │       ├── CourseDetail.js           # Course hub (materials/assignments/etc)
│   │       ├── Materials.js              # Upload + download encrypted materials
│   │       ├── Assignments.js            # Create + submit + grade assignments
│   │       ├── Quizzes.js                # Create + publish + take quizzes
│   │       ├── Exams.js                  # Upload + release + download exams
│   │       └── Room.js                   # WebRTC video room + chat
│   ├── .env                              # Frontend environment variables
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
│
├── server/
│   ├── src/
│   │   ├── index.js                      # Express app entry point
│   │   ├── config/
│   │   │   ├── database.js               # Sequelize MySQL connection
│   │   │   ├── keycloak.js               # keycloak-connect config
│   │   │   ├── auth.js                   # JWT sign/verify helpers
│   │   │   └── logger.js                 # Winston logger
│   │   ├── middleware/
│   │   │   └── auth.js                   # protect, requireRole, attachUser, audit
│   │   ├── models/
│   │   │   ├── index.js                  # Sequelize associations
│   │   │   ├── User.js
│   │   │   ├── Course.js
│   │   │   ├── Enrollment.js
│   │   │   ├── Material.js
│   │   │   ├── Assignment.js
│   │   │   ├── Submission.js
│   │   │   ├── Quiz.js
│   │   │   ├── QuizQuestion.js
│   │   │   ├── QuizAttempt.js
│   │   │   ├── Exam.js
│   │   │   ├── Room.js
│   │   │   └── AuditLog.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── courses.js
│   │   │   ├── materials.js
│   │   │   ├── assignments.js
│   │   │   ├── quizzes.js
│   │   │   ├── exams.js
│   │   │   ├── rooms.js
│   │   │   └── notifications.js
│   │   └── services/
│   │       ├── email/emailService.js     # Nodemailer SMTP
│   │       ├── encryption/fileEncryption.js  # AES-256-CBC
│   │       ├── notifications/sseService.js   # SSE client registry
│   │       ├── scheduler/quizTimer.js    # node-cron quiz auto-submit
│   │       ├── storage/uploadService.js  # Multer + MinIO/disk
│   │       └── webrtc/signalingServer.js # WebSocket signaling
│   ├── db/init.sql                       # MySQL schema
│   ├── .env                              # Server environment variables
│   ├── package.json
│   └── Dockerfile
│
├── keycloak/
│   └── sble-realm.json                   # Realm import (roles, client config)
├── nginx/nginx.conf                      # Production reverse proxy
├── docker-compose.yml                    # Full Docker stack
├── .env.example                          # Environment variable template
├── README.md                             # Project overview + API reference
├── LOCAL_SETUP.md                        # Local dev setup guide
├── INTEGRATIONS.md                       # Integration tools reference
└── SYSTEM_INTEGRATION.md                 # This document
```

---

## 11. npm Dependency Summary

### Server (`server/package.json`)

| Package | Version | Purpose |
|---|---|---|
| express | ^4.18.2 | HTTP server framework |
| pg | ^8.13.1 | PostgreSQL driver |
| sequelize | ^6.33.0 | ORM |
| livekit-server-sdk | ^2.15.3 | LiveKit access tokens for rooms |
| express-session | ^1.17.3 | Session management |
| connect-redis | ^7.1.0 | Redis session store adapter |
| ioredis | ^5.3.2 | Redis client |
| jsonwebtoken | ^9.0.2 | JWT utilities |
| bcryptjs | ^2.4.3 | Password hashing |
| multer | ^1.4.5-lts.1 | File upload handling |
| cors | ^2.8.5 | Cross-origin resource sharing |
| helmet | ^7.1.0 | HTTP security headers |
| express-rate-limit | ^7.1.0 | Rate limiting |
| dotenv | ^16.3.1 | Environment variable loading |
| uuid | ^9.0.0 | UUID generation |
| ws | ^8.14.2 | WebSocket server |
| winston | ^3.11.0 | Logging |
| nodemailer | ^6.9.7 | Email sending |
| node-cron | ^3.0.3 | Scheduled jobs |
| minio | ^7.1.3 | MinIO object storage client |

### Client (`client/package.json`)

| Package | Version | Purpose |
|---|---|---|
| react | ^18.2.0 | UI framework |
| react-dom | ^18.2.0 | DOM rendering |
| react-router-dom | ^6.20.0 | Client-side routing |
| axios | ^1.6.0 | HTTP client |
| livekit-client | ^2.19.0 | LiveKit browser SDK |
| react-scripts | 5.0.1 | CRA build tooling |

---

## 12. Integration Testing Checklist

Use this checklist to verify all integrations are working before a demo or submission.

### Authentication
- [ ] Opening http://localhost:3000 shows SBLE login when logged out
- [ ] Logging in with lecturer account loads Dashboard
- [ ] Logging in with student account loads Dashboard
- [ ] Logout clears session and returns to login

### Courses
- [ ] Lecturer can create a course
- [ ] Student can see and enroll in a course
- [ ] Course detail page shows title and lecturer name

### Materials
- [ ] Lecturer can upload a PDF material
- [ ] Material appears in the list
- [ ] Student can download and open the material (decrypted correctly)

### Assignments
- [ ] Lecturer can create an assignment with a due date
- [ ] Student can upload a file submission
- [ ] Lecturer can grade a submission with feedback
- [ ] Student sees grade notification in the bell icon

### Quizzes
- [ ] Lecturer can create a quiz with MCQ questions
- [ ] Lecturer can publish the quiz
- [ ] Student can take the quiz and see their score
- [ ] Quiz is auto-submitted after time limit (check server logs)

### Exams
- [ ] Lecturer can upload an encrypted exam PDF
- [ ] Exam shows as Locked for students
- [ ] Lecturer releases exam
- [ ] Student sees exam-released notification in bell icon
- [ ] Student can download and open the exam PDF

### WebRTC Rooms
- [ ] Lecturer can create a room
- [ ] Room appears in course for students
- [ ] Opening room in two browser tabs shows video from both
- [ ] Chat messages appear in both tabs
- [ ] Mute and Stop Video buttons work

### Notifications
- [ ] Bell icon shows unread count
- [ ] Clicking bell shows notification messages
- [ ] Dismissing a notification removes it

### Health Check
- [ ] GET http://localhost:5000/api/health returns `{ "status": "ok" }`
