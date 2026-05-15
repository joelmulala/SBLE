# SBLE — Deployment Guide

Production-readiness for single-node institutional hosting (Docker Compose or bare metal + Nginx).

---

## Architecture

```
Browser → Nginx (web) → static React build
                      → /api/* → Node API (api)
                      → SSE /api/notifications/stream
PostgreSQL (postgres) ← Sequelize
LiveKit Cloud/Self-hosted ← browser WebRTC (configure LIVEKIT_* on API)
Optional: performance service (FastAPI) on profile `analytics`
```

---

## Quick start (Docker)

```bash
cd sble
cp .env.example .env
# Edit DB_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, LIVEKIT_* 

docker compose up --build
```

Open **http://localhost:8080** (or `HTTP_PORT` from `.env`).

With analytics:

```bash
docker compose --profile analytics up --build
```

---

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DB_PASSWORD` | Yes | Postgres password |
| `JWT_SECRET` | Yes | ≥32 random characters |
| `ENCRYPTION_KEY` | Yes | Exactly 32 characters (AES-256) |
| `CLIENT_URL` | Yes | Public origin, e.g. `https://sble.university.edu` |
| `CORS_ALLOWED_ORIGINS` | Yes | Same as `CLIENT_URL` (comma-separated if multiple) |
| `LIVEKIT_*` | For video | API issues tokens; browser connects to `LIVEKIT_WS_URL` |
| `ALLOW_DEV_LOGIN` | Demo only | Set `true` for TEMP password login; **false** in real production |
| `TEMP_*_PASSWORD` | Demo only | Shared role passwords for demonstration |

See `.env.example` and `server/.env.example` for the full list.

### Secrets management

- Never commit `.env` to version control.
- In production use a secrets store (Docker secrets, Vault, host env injection).
- Rotate `JWT_SECRET` and `ENCRYPTION_KEY` on a documented schedule; re-encrypting stored files requires a migration plan.

---

## Database

### First-time initialization (Docker)

On first `postgres` volume creation, scripts run in order:

1. `server/db/init.sql` — schema  
2. `server/db/seed.sql` — admin account  
3. `server/db/demo-seed.sql` — demo lecturer, student, sample course  

### Manual init (bare metal)

```bash
psql -U postgres -c "CREATE DATABASE sble;"
psql -U postgres -d sble -f server/db/init.sql
psql -U postgres -d sble -f server/db/seed.sql
psql -U postgres -d sble -f server/db/demo-seed.sql
```

### Runtime schema updates

The API runs idempotent `ensure*Schema` helpers on startup (modules, calendar, announcements). For major changes, apply SQL migrations deliberately and back up first.

### Backup

```bash
docker compose exec postgres pg_dump -U sble sble > backup_$(date +%Y%m%d).sql
```

Restore:

```bash
cat backup.sql | docker compose exec -T postgres psql -U sble -d sble
```

---

## Bare-metal build (no Docker)

### 1. Build client

```bash
cd client
cp .env.example .env
# REACT_APP_API_URL=https://your-domain/api
npm ci
npm run build:production
```

### 2. API

```bash
cd server
cp .env.example .env
npm ci --omit=dev
npm start
```

### 3. Nginx

- Copy `client/build` to `/var/www/sble`
- Use `nginx/conf.d/default.conf` as a template; set `upstream` to `127.0.0.1:5000`
- Enable TLS (see below)

### 4. Process managers

**PM2** (placeholder config):

```bash
pm2 start deploy/ecosystem.config.js
pm2 save
```

**systemd** (placeholder unit):

```bash
sudo cp deploy/sble-api.service /etc/systemd/system/
sudo systemctl enable --now sble-api
```

---

## HTTPS / TLS

1. Obtain certificates (Let’s Encrypt or institutional CA).
2. Place cert/key under `nginx/ssl/` (not committed).
3. Add a `server { listen 443 ssl; ... }` block terminating TLS and proxying to `api` and static files.
4. Set `CLIENT_URL` and `CORS_ALLOWED_ORIGINS` to `https://...`.
5. LiveKit requires HTTPS or localhost for camera access.

---

## LiveKit

Configure on the **API** container/host:

```env
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_WS_URL=wss://your-project.livekit.cloud
```

No Nginx route is required for default LiveKit Cloud; the browser connects directly to `LIVEKIT_WS_URL`.

---

## Health checks

- API: `GET /api/health` (database required; performance service optional)
- Web: nginx serves `index.html`
- Postgres: `pg_isready`

---

## Troubleshooting

| Issue | Check |
|---|---|
| 502 on `/api` | `docker compose logs api` — DB env, `JWT_SECRET` |
| CORS errors | `CLIENT_URL` / `CORS_ALLOWED_ORIGINS` match browser URL |
| Login fails in prod | `ALLOW_DEV_LOGIN=true` or implement hashed passwords |
| Live class no video | `LIVEKIT_*` set; browser permissions; HTTPS |
| SSE notifications stall | Nginx `proxy_buffering off` on `/api/notifications/stream` |

---

## Related docs

- [LOCAL_SETUP.md](./LOCAL_SETUP.md) — development without Docker  
- [DEMO.md](./DEMO.md) — thesis / evaluator walkthrough  
- [SYSTEM_INTEGRATION.md](./SYSTEM_INTEGRATION.md) — integration reference  
