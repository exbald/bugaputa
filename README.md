# Bugaputa — frictionless bug reporting

Lightweight bug-reporting SaaS: a drop-in widget lets visitors submit bugs in <30s (no account), site owners triage reports in a dashboard.

- **Widget**: vanilla JS IIFE, <30KB gzipped, floating button + accessible modal
- **Backend**: Node 20 + Express + SQLite (better-sqlite3, WAL) + JWT httpOnly cookie + zod + helmet + multer
- **Frontend**: React + Vite + Tailwind + React Router
- **Deploy**: single Docker image, health checks, Coolify on `bugaputa.no-code.gdn`

## Quick start (local)

```bash
cp .env.example .env   # set JWT_SECRET
npm install
npm run build          # builds server + client
npm test               # vitest — backend tests
npm start              # http://localhost:3000
# dev: npm run dev  (concurrently: server + vite)
```

Open http://localhost:3000 — landing, login, dashboard. The widget is at `/widget.js`.

## Environment

| Var | Default | Notes |
|-----|---------|-------|
| PORT | 3000 | |
| NODE_ENV | development | `production` enables Secure cookies |
| DATABASE_URL | ./data/app.db | SQLite file; prod: `/data/app.db` (Coolify volume) |
| JWT_SECRET | dev-secret-change-me | must be set in prod |
| UPLOAD_DIR | ./data/uploads | prod: `/data/uploads` |
| CORS_ORIGINS | http://localhost:5173,http://localhost:3000 | |

See `.env.example`.

## API

| Method | Path | Auth | Body / Notes |
|--------|------|------|--------------|
| POST | /api/auth/register | no | {email,password} -> {user}, sets cookie |
| POST | /api/auth/login | no | {email,password} -> {user} |
| POST | /api/auth/logout | no | clears cookie |
| GET | /api/auth/me | yes | -> {user} |
| GET | /api/projects | yes | own projects |
| POST | /api/projects | yes | {name, allowedOrigins?} -> Project (pk_live_...) |
| GET | /api/projects/:id | yes | own |
| DELETE | /api/projects/:id | yes | own |
| GET | /api/projects/:projectId/reports?status=&q=&page=&limit= | yes | {items,total} |
| GET | /api/reports/:id | yes | own |
| PATCH | /api/reports/:id | yes | {status: open|in_progress|resolved|archived} |
| DELETE | /api/reports/:id | yes | own |
| POST | /api/reports | public | projectKey via x-project-key header or body; honeypot website must be empty; rate-limited; multipart screenshot (png/jpeg/webp/gif, <=5MB) or JSON |
| GET | /widget.js | no | widget JS (CORS *) |
| GET | /widget.css | no | widget CSS |
| GET | /health, /api/health | no | {ok:true} |
| GET | /uploads/:filename | no | image |

Sequence: register -> POST /api/projects -> note publicKey -> POST /api/reports with x-project-key.

## Widget snippet

```html
<script src="https://bugaputa.no-code.gdn/widget.js" data-project="pk_live_..."></script>
```

Optional `data-api="https://bugaputa.no-code.gdn"` to override API base. The widget injects a floating button, opens an accessible modal (focus trap, ESC, 44px targets), shows what will be sent (URL, browser, viewport, language), and posts to POST /api/reports.

## Docker

```bash
docker build -t bugaputa .
docker run -p 3000:3000 -v $(pwd)/data:/data -e DATABASE_URL=/data/app.db -e UPLOAD_DIR=/data/uploads -e JWT_SECRET=secret bugaputa
curl -sf http://localhost:3000/health
```

Coolify: volume /data, env DATABASE_URL=/data/app.db, UPLOAD_DIR=/data/uploads, JWT_SECRET, PORT=3000, NODE_ENV=production, domain bugaputa.no-code.gdn, port 3000.

## Smoke test

```bash
./scripts/smoke.sh http://localhost:3000
# or against prod:
./scripts/smoke.sh https://bugaputa.no-code.gdn
```

Checks: /health, /api/health, /widget.js, then register -> create project -> public submit (x-project-key) -> list reports (assert 1 item).

## Tests

```bash
npm test            # server vitest (40 tests)
npm --workspace=client run build   # vite build must succeed
```

## Project structure

```
server/        Express app, routes, db, middleware, tests
client/        React dashboard + landing (Vite)
widget/        vanilla JS widget source (widget.js + widget.css + vendored capture engines:
               modern-screenshot.min.js (primary, pixel-accurate SVG foreignObject) and
               html2canvas.min.js (fallback), lazy-loaded after capture consent)
scripts/       smoke.sh
Dockerfile     multi-stage build
```


## Third-party licenses

- html2canvas 1.4.1 (https://github.com/niklasvh/html2canvas) — MIT, vendored as `widget/html2canvas.min.js` and served at `/html2canvas.min.js` (lazy-loaded only after capture consent). License header retained in vendored file.

## Security

- zod validation on every input; message 10-2000 chars; file MIME + 5MB check; honeypot website; rate limit 20/min/IP/project; helmet; CORS allow-all only on public POST; IP hashed, never plain.
- Auth: bcrypt 10, JWT httpOnly Secure SameSite=Lax (Secure in prod).

<!-- coolify auto-deploy verification: 2026-08-13T03:20:02Z -->
