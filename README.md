# Bugaputa — frictionless bug reporting

Lightweight bug-reporting SaaS: a drop-in widget lets visitors submit bugs in <30s (no account), site owners triage reports in a dashboard.

- **Widget**: vanilla JS IIFE, <30KB gzipped, floating button + accessible modal
- **Backend**: Node 20 + Express + SQLite (better-sqlite3, WAL) + JWT httpOnly cookie + zod + helmet + multer
- **Frontend**: React + Vite + Tailwind + React Router
- **Deploy**: single Docker image, health checks, Coolify on `bugaputa.com` (legacy `bugaputa.no-code.gdn` retained for widget/API compat)

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
| DATABASE_URL | ./data/app.db | SQLite file; prod: `/app/data/app.db` (Coolify volume, see docker-compose.yaml) |
| JWT_SECRET | dev-secret-change-me | must be set in prod |
| UPLOAD_DIR | ./data/uploads | prod: `/app/data/uploads` |
| CORS_ORIGINS | http://localhost:5173,http://localhost:3000 | |
| TRUSTED_PROXY_IPS | 127.0.0.1,::1 | Comma-separated exact IPs of trusted reverse proxies allowed to supply `X-Forwarded-For`; set this to the Coolify/Traefik proxy container IP in production. Never use a whole private subnet. |

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
| POST | /api/reports | public | projectKey via x-project-key header or body; honeypot website must be empty; rate-limited; JSON, or multipart with any of: `screenshot` (flattened png/jpeg/webp/gif, <=5MB), `domSnapshot` (text/html or application/gzip, <=8MB), `annotations` (transparent PNG overlay, <=5MB) |
| GET | /widget.js | no | widget JS (CORS *) |
| GET | /widget.css | no | widget CSS |
| GET | /health, /api/health | no | {ok:true} |
| GET | /uploads/:filename | no | image |

Sequence: register -> POST /api/projects -> note publicKey -> POST /api/reports with x-project-key.

## Widget snippet

```html
<script src="https://bugaputa.com/widget.js" data-project="pk_live_..." data-api="https://bugaputa.com"></script>
```

Optional `data-api="https://bugaputa.com"` to override API base (defaults to the script origin). The widget injects a floating button, opens an accessible modal (focus trap, ESC, 44px targets), shows what will be sent (URL, browser, viewport, language), and posts to POST /api/reports.

### Capture: DOM snapshot, not a rasterized image

Rasterizing a page re-renders it outside the real document context, which shifts text
and re-wraps layouts (generic font keywords like `system-ui` don't resolve there, and
platform UI fonts such as macOS San Francisco aren't addressable by any CSS name).
So capture serializes a sanitized **DOM snapshot** instead, and real browser engines
render it back — in the annotation editor and in the dashboard — which is pixel-exact
by construction on every OS and browser.

What the snapshot contains: the cloned document with form values, canvas pixels
(`toDataURL`) and same-origin stylesheets inlined (including CSSOM-only rules), URLs
absolutized, and fixed/stuck-sticky elements re-anchored to the captured viewport.
Images and CSS `url()` resources are inlined as `data:` URIs (per-file 768KB, 3MB
total, 6s budget) so the snapshot is self-contained: viewers render it in a sandboxed
iframe, whose opaque origin would otherwise be refused any asset served with
`Cross-Origin-Resource-Policy: same-origin` — the usual cause of broken images.

What is stripped or masked: `script`/`noscript`/`template`, preload/prefetch links,
meta refresh, all `on*` handlers and `javascript:` URLs; cross-origin frames become
placeholders; password fields, `autocomplete="cc-*"`, and any field whose name/id
matches `pass|secret|token|card|cvc|ssn` become `XXXXX`. Add `data-bugaputa-mask` to
any element to force-mask its text.

Degradation: snapshot fails → flattened raster only; raster fails → snapshot only;
both fail → manual image upload. Inner scroll positions of nested containers are
recorded (`data-bugaputa-scroll-*`) but not replayed, since the viewer runs without
scripts.

## Docker

```bash
docker build -t bugaputa .
docker run -p 3000:3000 -v $(pwd)/data:/app/data -e DATABASE_URL=/app/data/app.db -e UPLOAD_DIR=/app/data/uploads -e JWT_SECRET=secret bugaputa
curl -sf http://localhost:3000/health
```

Coolify: volume /app/data, env DATABASE_URL=/app/data/app.db, UPLOAD_DIR=/app/data/uploads, JWT_SECRET, PORT=3000, NODE_ENV=production, domains `bugaputa.com`, `www.bugaputa.com` (redirects to apex), and `bugaputa.no-code.gdn` (compat), port 3000.

## Smoke test

```bash
./scripts/smoke.sh http://localhost:3000
# or against prod:
./scripts/smoke.sh https://bugaputa.com  # legacy https://bugaputa.no-code.gdn still serves widget/API for existing embeds
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

- zod validation on every input; message 10-2000 chars; file MIME + size checks (5MB images, 8MB snapshots); honeypot website; rate limit 20/min/IP/project; helmet; CORS allow-all only on public POST; IP hashed, never plain. Every early exit (honeypot, validation, bad key, rate limit, multer error) deletes all uploaded artifacts.
- DOM snapshots are captured-page markup, so they are treated as untrusted: rendered only inside `sandbox=""` iframes (no scripts, opaque origin) in the editor and dashboard, and `/uploads` serves `.html`/`.gz` as `application/octet-stream` + `Content-Disposition: attachment` + `nosniff` so they can never render on the app origin. Secrets are redacted at capture time (see widget section). The dashboard's CSP allows `img-src https:` so snapshot images render — note this means viewing a report can request images from the reporter's origin.
- Auth: bcrypt 10, JWT httpOnly Secure SameSite=Lax (Secure in prod).

<!-- coolify auto-deploy verification: 2026-08-13T03:20:02Z -->
