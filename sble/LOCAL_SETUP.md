# SBLE — Local Setup Guide (No Docker)

This guide gets the full system running on your machine without Docker.
Everything works: auth, courses, materials, assignments, quizzes, exams, WebRTC rooms, and notifications.

---

## What You Need to Install

| Tool | Version | Download |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| MySQL | 8.0 | https://dev.mysql.com/downloads/mysql |
| Redis | 7+ | https://memurai.com (Windows) or `apt install redis` (Linux/WSL) |
| Keycloak | 23.0 | https://www.keycloak.org/downloads |

---

## Step 1 — MySQL Setup

After installing MySQL, open a terminal and run:

```bash
mysql -u root -p
```

Then paste this:

```sql
CREATE DATABASE sble_db;
CREATE DATABASE sble_db_kc;
CREATE USER 'sble_user'@'localhost' IDENTIFIED BY 'change_this_db_password';
GRANT ALL PRIVILEGES ON sble_db.* TO 'sble_user'@'localhost';
GRANT ALL PRIVILEGES ON sble_db_kc.* TO 'sble_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Then import the schema:

```bash
mysql -u sble_user -p sble_db < server/db/init.sql
```

---

## Step 2 — Redis Setup

**Windows:** Download and install Memurai from https://www.memurai.com
It runs as a Windows service automatically after install.

**WSL / Linux / Mac:**
```bash
sudo apt install redis-server   # Linux/WSL
brew install redis              # Mac

# Start it
redis-server
```

Test it works:
```bash
redis-cli ping
# Expected: PONG
```

---

## Step 3 — Keycloak Setup

1. Download Keycloak 23.0 ZIP from https://www.keycloak.org/downloads
2. Extract it anywhere on your machine
3. Open a terminal in the extracted folder and run:

```bash
# Windows
bin\kc.bat start-dev

# Mac / Linux / WSL
bin/kc.sh start-dev
```

4. Open http://localhost:8080 in your browser
5. Log in with: admin / admin
6. Click "Create Realm" → Import → select `keycloak/sble-realm.json`
7. Create test users:
   - Go to Users → Add User
   - Create one user with role `lecturer`
   - Create one user with role `student`
   - Set a password for each under the Credentials tab (turn off "Temporary")
   - Assign roles under Role Mappings → Realm Roles

---

## Step 4 — Configure Environment

Edit `server/.env` — update these values to match your setup:

```env
DB_PASSWORD=change_this_db_password        # must match what you set in Step 1
JWT_SECRET=any_random_string_32_chars_long
ENCRYPTION_KEY=exactly_32_characters_here!
```

The `client/.env` file is already configured for localhost — no changes needed.

---

## Optional — LiveKit (future classroom RTC)

For `POST /api/rooms/:roomToken/livekit-token` to issue tokens, add to `server/.env`:

```env
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
LIVEKIT_WS_URL=wss://your-project.livekit.cloud
```

Values come from [LiveKit Cloud](https://cloud.livekit.io/) or your self-hosted deployment. If these variables are missing, the API still runs; the token endpoint returns `503` until LiveKit is configured.

To use native SBLE video in the browser, set in `client/.env` (then rebuild the client):

```env
REACT_APP_CLASSROOM_BACKEND=livekit
```

The default is `jitsi` (embedded meeting). Changing this requires `npm run build` or `npm start` after saving.

---

## Step 5 — Install Dependencies

```bash
# Backend
cd server
npm install

# Frontend (new terminal)
cd client
npm install
```

---

## Step 6 — Run the App

Open two terminals:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```
Server starts at http://localhost:5000

**Terminal 2 — Frontend:**
```bash
cd client
npm start
```
App opens at http://localhost:3000

---

## Step 7 — Verify Everything Works

Open http://localhost:3000 — you should be redirected to Keycloak login.

Log in with your lecturer account and:
1. Create a course
2. Upload a material (PDF)
3. Create an assignment
4. Create and publish a quiz
5. Upload an exam paper and release it
6. Create a room and open it

Log in with your student account and:
1. Enroll in the course
2. Download a material
3. Submit an assignment
4. Take the quiz
5. Download the released exam

---

## Troubleshooting

**"Database connection failed"**
- Make sure MySQL is running: `mysql -u root -p` should connect
- Check DB_PASSWORD in `server/.env` matches what you set

**"Cannot connect to Keycloak"**
- Make sure Keycloak is running at http://localhost:8080
- Check KEYCLOAK_URL in `server/.env`

**"Redis error" in logs**
- If Redis isn't running, comment out `REDIS_HOST` in `server/.env` — the app falls back to in-memory sessions

**WebRTC video not connecting**
- Make sure both browser tabs are on the same machine or local network
- Allow camera/microphone access when the browser asks

**Emails not sending**
- Leave `SMTP_HOST` blank in `.env` — emails are silently skipped, everything else still works

---

## What Works Without Each Optional Service

| Service | If not running | Impact |
|---|---|---|
| Redis | In-memory sessions | Sessions lost on server restart |
| SMTP | Emails skipped | No grade/exam notifications by email |
| MinIO | Local disk storage | Files saved to `server/uploads/` |
| TURN/Coturn | No TURN relay | WebRTC only works on same local network |
