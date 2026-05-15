# SBLE — Demonstration & Thesis Guide

Reproducible walkthrough for academic defense, institutional pilots, and evaluator onboarding.

---

## One-command demo stack

```bash
cd sble
cp .env.example .env
docker compose up --build
```

Open **http://localhost:8080**

Configure **LiveKit** in `.env` before demonstrating live video.

---

## Demo accounts

Passwords come from `.env` (`TEMP_*_PASSWORD`). Defaults in `.env.example`:

| Role | Email | Password (default) |
|---|---|---|
| Admin | `admin1@sble.local` | `admin123` |
| Lecturer | `lecturer.demo@sble.local` | `lecturer123` |
| Student | `student.demo@sble.local` | `student123` |

`demo-seed.sql` creates the lecturer, student, and sample course **Introduction to Cybersecurity**.

---

## Recommended demo flow (15–20 minutes)

### Lecturer (10 min)

1. Sign in as **lecturer.demo@sble.local**
2. Open **My courses** → **Introduction to Cybersecurity**
3. Show **course home** (modules, upcoming activity)
4. **Communication** — post or highlight the welcome announcement
5. **Materials** — upload a PDF (encrypted at rest)
6. **Assignments** — create assignment with due date
7. **Quizzes** — show draft → publish flow
8. **Live Classes** — create room; join; brief A/V check (LiveKit)
9. **Gradebook** — show course grade overview
10. **Calendar** — institutional + course events

### Student (8 min)

1. Sign out → sign in as **student.demo@sble.local**
2. Open the same course from **My courses**
3. Download a material
4. Submit assignment (file upload)
5. Take published quiz (timer enforced server-side)
6. Join live class from notification or **Live Classes**
7. **Gradebook** — view published results
8. **Communication** — read announcement / discussion

### Admin (optional, 2 min)

1. `admin1@sble.local` — **Users** management overview

---

## What to emphasize for evaluators

- **Security:** AES-256 file encryption, JWT auth, course-scoped access, role enforcement  
- **Blended learning:** modules, async materials, sync live class, assessments, gradebook  
- **Reliability:** quiz auto-submit, idempotent grading, Docker reproducibility  
- **Institutional UX:** course workspace, calendar, communication hub  

---

## Reset demo data

```bash
docker compose down -v
docker compose up --build
```

This recreates the database volume and re-runs `init.sql`, `seed.sql`, and `demo-seed.sql`.

---

## Pre-demo checklist

- [ ] `.env` secrets set; `ALLOW_DEV_LOGIN=true` for password demo  
- [ ] LiveKit keys valid; test one room join  
- [ ] `docker compose ps` — all services healthy  
- [ ] Browser: Chrome/Edge, camera/mic allowed  
- [ ] Backup slides with architecture diagram (see `SYSTEM_INTEGRATION.md`)  

---

## Support contacts (customize)

- Technical lead: _your email_  
- Institution IT: _helpdesk_  
