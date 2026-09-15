# Runbook — Video Recording Redesign v2

Branch: feat/video-capture-feedback-2026-09 → PR #46 draft (update existing, no second PR, no merge without Nikolay)
Verified head: bc0bd4f081c4685aed87ff107d471b86b7a70b27 (keep in sync; every code change resets bot/CI → exact-SHA deploy → headed QA)
Canary: isolated Coolify app (same disposable project/env as last video canary, canary-only VITE_CANONICAL_ORIGIN + VITE_LANDING_WIDGET_PROJECT_KEY); prod app 811qw6y4gh56npcm5hzqblmk @ bugaputa.com untouched
Repo private. Never expose credentials in task bodies/comments/files/logs. Do not reuse stale Video 12–15 QA as release evidence.

## How to run locally
npm install (workspaces ["server","client"])  → npm run dev (concurrently) | npm run build (server tsc + client vite) | npm run test (vitest both) | npm start (node server/dist/index.js)
Env: DATABASE_URL (default ./data/app.db), JWT_SECRET (required prod), UPLOAD_DIR (/app/data/uploads), CORS_ORIGINS, VITE_CANONICAL_ORIGIN, VITE_LANDING_WIDGET_PROJECT_KEY, PORT
Single Docker: Dockerfile + docker-compose.yaml volume /app/data, GET /health & /api/health

## Pre-flight (PM owns before decomposition)
- Inspect widget/widget.js current prototype + screenshot annotation engine (html2canvas/modern-screenshot, annotation editor) before selecting architecture
- Preserve backend: server/src/db.ts video columns + videoCaptureEnabled, server/src/lib/video.ts mime/magic/duration, server/src/routes/reports.ts video upload validation/quota/cleanup/Range, server/src/app.ts CSP mediaSrc, per-project flag OFF default
- Identify retain/replace/remove in PR #46 (see brief.md) and encode into PRD
- Technical spike: prove which standards path can actually surface Ybug-style "Allow ... to see this tab?" on canary (getViewportMedia() if shipped vs getDisplayMedia hints + Capture Handle identity verification). If not provably current-tab-only, enforce conservative unsupported/upload fallback — do not promise beyond what browser proves. Do not count mocked getDisplayMedia/fake-ui/synthetic streams as acceptance.
- Write and commit docs/plans/2026-09-15-video-recording-redesign-v2.md per task spec (problem/goals/journeys/state machine/privacy/permission contract/browser matrix/annotation coordinate model/pointer design/preview/failures/telemetry/backend reuse/acceptance/rollout + bite-sized TDD plan with exact files/commands after source inspection)

## Task graph (minimum decomposition on meta-team board)

Parents → Children (parents=[...] at creation; true dependencies only)

A  Capture/permission + composited annotation/pointer  → meta-frontend
   — shared annotation workspace (reuse screenshot engine), viewport-fixed toolbar (Record/3s countdown/timer/Stop, mic OFF default, pointer/pen/arrow/rect/text/color/undo/redo/delete, Done/Cancel, 44px, a11y), real permission timing (only Record triggers request), privacy contract (getViewportMedia preferred else getDisplayMedia with preferCurrentTab/selfBrowserSurface/surfaceSwitching/monitorTypeSurfaces/systemAudio + Capture Handle verification + honest fallback; no system-audio/camera/window/screen), separate getUserMedia mic only on opt-in with recoverable denial, annotations while recording (document-relative coords, scroll-compensated vector layer, RAF, nested scroll, undo/redo preserved, captured pixels), pointer halo+ripple (non-blocking, reduced-motion, toggle), interaction model (pointer allows page interaction, drawing captures gestures without breaking scroll, all termination paths → preview/recovery), preview modal (player/duration/size, Record again/Delete with confirmation, Use recording, responsive 390px, focus trap, ESC cannot discard silently, cleanup of streams/blob URLs/timers), tests (mocked permission + scroll-attachment + pointer visibility), gzip headroom preserved
   Depends on: PM plan committed. Blocks: review/integration.

B  Backend contract changes → meta-backend (omit if none)
   — Only if PRD identifies conflict with retained invariants (60s/25MB/Range/5-min/1GB quota/OFF default/lazy). Otherwise no-op with reuse map. If needed, patch validators/routes/CSP and add tests.
   Depends on: A or plan (whichever owns contract). Blocks: review/integration.

C  Review/fix/push to existing draft PR head → meta-reviewer
   — Fix findings, push to feat/video-capture-feedback-2026-09, keep PR #46 draft, no merge. Verify widget mirror parity, gzip budget, no secrets.
   Parents: [A, B if exists]

D  GitHub Actions bot + current-head CI round → meta-reviewer (GitHub Actions bot review only; no Codex/Cortex)
   — Trigger or wait for Actions on the exact head, collect bot review + CI pass as evidence.
   Parents: [C]

E  Exact-SHA isolated canary deploy → meta-devops
   — Deploy the exact SHA from D to isolated canary via Coolify API, verify 40-char SHA, branch, TLS, /health + /api/health, widget/config/assets 200, gzip budgets, isolation (prod untouched). Evidence bundle (canary_evidence.json, sanitized logs, screenshots).
   Parents: [D]

F  Real headed Chrome/Edge + honest fallback QA → meta-reviewer (or designated QA profile)
   — Genuine headed Chrome/Edge: current-tab allow/deny/scroll/pointer/playback (no mocked getDisplayMedia, no fake-ui/auto-accept, no Chromium emulation, no synthetic streams as acceptance). Firefox/Safari/mobile: honest unsupported + upload fallback checks. Desktop + 390px screenshots at scrollY=0 and scrolled (annotations attached, no clipping).
   Parents: [E]

G  Merge gate → meta-reviewer (do not merge without Nikolay's explicit approval)
   — Verifies F, leaves PR #46 draft. Never auto-merge.
   Parents: [F]

Previous Video 12–15 cards (t_6483c164, t_afb0703a, t_30037f1d, t_f43f99e8, t_6d45be6e) are superseded — comment authoritative chain, leave paused/superseded.

## Failure handling
- Stuck overlay/hidden trigger, silent loss on navigation/track-end/size overflow/recorder error, mic denial not cleaned, toolbar not movable, annotations stuck at viewport coords, pointer invisible on playback → fix in A, reset C→F
- Browser cannot verify current-tab → honest unsupported + upload fallback (never broad capture)
- Every code change resets bot/CI → exact-SHA deploy → headed QA (no skipping)
- Secrets: never log env/.env, never paste tokens in task bodies

## Rollout / rollback
Rollout: behind per-project flag OFF; enable per-project after F passes on canary; verify prod merge SHA == canary SHA.
Rollback: flag OFF per-project, revert PR if merged (requires explicit approval), canary disposable.

## Evidence trail
Tag every task comment with the exact SHA under test, canary URL + deployment UUID + health, bot review link + CI run link, QA screenshots/attachments. Existing Video 12–15 QA is stale — new chain is authoritative.

## Verification
npm test (server vitest --reporter=verbose + client vitest) and npm run build before claiming done. Real headed QA is mandatory for release; mocked permission alone does not count.
