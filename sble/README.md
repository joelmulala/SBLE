# SBLE — Secure Blended Learning Environment

A full-stack university LMS: course modules, gradebook, academic calendar, communication hub, encrypted file storage, **JWT authentication**, and **LiveKit** live classrooms.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + React Router 6 |
| Backend | Node.js + Express |
| Database | PostgreSQL (Sequelize) |
| Auth | JWT (`POST /api/auth/login`, Bearer token) |
| Live class | LiveKit (`livekit-client` + `livekit-server-sdk`) |
| Encryption | AES-256-CBC (stored files) |
| Notifications | Server-Sent Events (SSE) |
| Sessions | Redis (optional; in-memory fallback) |
| Storage | Local disk (MinIO-ready) |

---

## Running the Project

### Local development

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for PostgreSQL, env vars, LiveKit, and run commands.

Quick summary:

1. PostgreSQL + `server/db/init.sql`
2. Configure `server/.env` and `client/.env`
3. `npm run dev` in `server/` (port **5000**)
4. `npm start` in `client/` (port **3000**)

### Docker (production / demo)

```bash
cp .env.example .env
docker compose up --build
# http://localhost:8080 — see DEPLOYMENT.md and DEMO.md
```

---

## Features

### Authentication
- Email/password login and self-registration (`/login`, `/register`)
- Role-based access: student, lecturer, admin
- JWT stored client-side; `AuthProvider` + `useAuth()` on the frontend

### Courses & learning structure
- Course workspace with modules, materials, assignments, quizzes, exams
- Gradebook and academic calendar (institutional + course events)
- Communication hub: announcements and threaded discussions

### Live classes
- Lecturers create rooms; students join via LiveKit
- In-room chat, moderation, and attendance (lecturer)

### Security
- AES-256-CBC for uploaded files
- Helmet, rate limiting, audit logs
- HTTPS in production via reverse proxy

---

## Project layout

```
sble/
├── client/          React app
├── server/          Express API + Sequelize
│   └── db/init.sql  PostgreSQL schema
├── LOCAL_SETUP.md
└── SYSTEM_INTEGRATION.md
```

---

## API overview

| Area | Base path |
|---|---|
| Auth | `/api/auth` |
| Courses & modules | `/api/courses` |
| Materials, assignments, quizzes, exams | `/api/materials`, etc. |
| Gradebook | `/api/gradebook` |
| Calendar | `/api/calendar` |
| Communication | `/api/communication`, `/api/announcements` |
| Live rooms | `/api/rooms` (+ LiveKit token route) |

Health check: `GET /api/health`

---

## Documentation

- [LOCAL_SETUP.md](./LOCAL_SETUP.md) — step-by-step local run
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Docker, Nginx, production env
- [DEMO.md](./DEMO.md) — thesis / evaluator demo script
- [SYSTEM_INTEGRATION.md](./SYSTEM_INTEGRATION.md) — architecture and env reference
