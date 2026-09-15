# Video Capture Feedback — Implementation Plan

**Date:** 2026-09-15
**Branch:** `plan/video-capture-feedback-2026-09` (based on `4461019c08f58a0c93fdb55ceaf5b3cffc08cb93`)
**Status:** Planning only — no code changes in this branch
**Author:** meta-pm (planning task t_ef8a5815)
**Scope:** First-class video capture as an additive feedback modality alongside existing screenshot / DOM snapshot / annotations. No destabilization of screenshots.

---

## 1. Goal

Add **Record video** as a third feedback path in the Bugaputa widget so reporters can submit a short screen/tab recording (with optional microphone) plus the same bug description/context that screenshots carry today. Dashboard owners see the video inline with playback, download, and status controls.

Non-goals for MVP: camera capture, in-widget video editing, timeline markers/comments, trimming, transcription, or replacing screenshot flow.

Success criteria:
- A reporter completes Record video in <60s on a supported desktop browser and the dashboard shows a playable `<video controls>` with correct duration/mime/size.
- On unsupported browsers the widget never dead-ends: a clearly labeled fallback (file upload or Screenshot / General feedback) is offered.
- Every rejected request (validation, honeypot, bad key, rate limit, oversized) cleans up temp files — no disk leak.
- Widget base IIFE stays <30KB gzipped (30,720 bytes ceiling); video support is lazy-loaded. Base chooser wiring must land only after reclaiming >=1.5KB gzipped headroom (target: base <=29KB / 29,696 bytes gzipped) so the ceiling is not breached. Enforced by a RED size test against the measured 30,547-byte baseline.

---

## 2. Recommended Architecture

### 2.1 Principle: additive, not invasive

- Reuse existing submission shape (`POST /api/reports` multipart JSON parity), existing context fields (`pageUrl`, `userAgent`, `viewport`, `language`, `contactEmail`, `message`, `projectKey`, `website` honeypot), same rate-limit, same honeypot semantics, same cleanup contract.
- Add a **new column and field** for video; do NOT overload `screenshotPath`.
- Keep screenshots fully intact — regressions in screenshot capture/annotation or snapshot/iframe rendering are release blockers even if video works.

### 2.2 Layer view

```
widget/widget.js (vanilla IIFE, <30KB gzipped base)
  ├─ chooser (3-way: Screenshot / Record video / General feedback)
  ├─ screenshot path  ── existing: DOM snapshot + rasterizer (modern-screenshot/html2canvas) + annotation editor + pendingSnapshotFile/pendingAnnotationsFile/pendingAnnotatedFile
  └─ video path (NEW) ── lazy-loaded video-capture module
        ├─ getDisplayMedia → MediaRecorder (+ optional audio track)
        ├─ recording UI (timer, indicator, Stop/Cancel, mic opt-in)
        ├─ processing → Blob → object URL preview → remove/replace
        └─ pendingVideoFile (+ pendingVideoMeta {mime,durationMs,sizeBytes}) submitted as multipart field "video"

server (Express + SQLite + multer + helmet)
  ├─ DB: reports.videoPath, reports.videoMime, reports.videoDurationMs (nullable, additive migration)
  ├─ POST /api/reports: accept new multipart field "video" alongside existing ones; validate mime+magic bytes+size+duration; random filename; cleanup on every early exit; insert row
  ├─ GET /uploads/:filename: (images/snapshots only, public) + authenticated GET /api/reports/:id/video (owner-only, Range) for video; keep html/gz "attachment" behavior
  ├─ DELETE /api/reports/:id: remove video artifact too
  └─ per-project feature flag: projects.videoCaptureEnabled boolean (default false, per project)

client (React + Vite + Tailwind)
  ├─ ProjectReports (list): video badge/poster/duration, keep screenshot thumbnail path
  └─ ReportDetail: authenticated <video controls> + download + error/unsupported-codec states; snapshot/annotations rendering untouched

infra
  └─ Coolify: single Docker image, volume /app/data holds SQLite + uploads; video increases upload volume — size/duration guardrails + monitoring
```

### 2.3 Feature-flag strategy

- **Per-project embed flag** `videoCaptureEnabled` (SQLite boolean, default 0 = off). Risky permission capability must be OFF by default.
- Optional embed override: `<script ... data-video-capture="true">` as a second signal — widget only exposes Record video when both server flag AND (either embed attr OR server flag alone, depending on policy). Recommendation: server flag is source of truth; embed attr is convenience but not required for canary.
- Dashboard Widget tab exposes a toggle (owner only) to enable/disable per project.

---

## 3. User Flow

### 3.1 Reporter (widget)

1. Click floating feedback tab → modal opens, focus trapped. Chooser shows **three** choices:
   - `Screenshot — Capture and annotate` (existing)
   - `Record video — Record your screen (up to 60s)` (new)
   - `General feedback — No capture`
2. **Record video path:**
   - Consent pane explains: records visible screen/tab only, browser will ask for permission, cross-origin iframes may appear blank, no passwords collected, mic is off unless you enable it. Checkbox `Include microphone (off by default)` plus note that OS/browser will show a recording indicator. `Don't show this again` persisted in `localStorage` (key `bugaputa-skip-video-consent`).
   - Click `Start recording` → `getDisplayMedia` prompt (browser/OS native). While waiting: show "Waiting for permission…" with Cancel.
   - Permission granted → recording state: visible red indicator + elapsed timer (mm:ss), `Stop` (44px min), `Cancel` (discards). Optional `Mute mic` if enabled. Timer auto-stops at 60s.
   - Permission denied / prompt dismissed → inline error + fallback row: `Choose another method: Screenshot or General feedback or Upload a video file (mp4/webm ≤25MB)`.
   - `Stop` → processing state: `Processing…` then preview: `<video controls>` preview (blob URL) with duration/size/mime, `Remove recording` / `Replace` / `Retake`, and file-fallback uploader (accept `video/webm,video/mp4`). Preview file is the attachment that will be submitted; `clearAttachmentState()` must revoke its object URL on remove/close/replace.
   - Proceed to report form (same form as screenshot path): `Describe the bug *` (10–2000 chars), optional email, `Will be sent:` box (URL/browser/viewport/language), honeypot (hidden), consent line. `Send report` posts `FormData` with `video` field plus context fields. On success show thanks and auto-close in ~2.2s. On network/validation error keep the video attached for retry (do NOT clear attachment on error).
3. Tab navigation, modal close (X/Cancel/ESC/backdrop), or `Cancel` during recording must clean up: stop all `MediaStreamTrack`s, revoke object URLs, clear timers, restore trigger button visibility, return focus.

### 3.2 Owner (dashboard)

- Project reports list (`/p/:id` Issues tab): each report with `videoPath` shows a video badge (e.g. `▶ Video · 0:23 · 8.4MB`) and a still poster (first frame via `<video>` or a placeholder icon when no poster). Screenshot badge stays unchanged.
- Report detail (`/r/:id`): below report message, a `Screen recording` card with `<video controls preload="metadata" playsInline>` hitting `/uploads/<videoFilename>`, plus `Download` link (with `download` attr) and metadata line. Loading, error, and unsupported-codec states are explicit (with download fallback). Snapshot/annotation cards remain as-is.

---

## 4. Explicit Decisions & Trade-offs

### 4.1 Capture UX — decided

| Item | Decision | Rationale |
|------|----------|-----------|
| Chooser | 3 buttons: Screenshot / Record video / General feedback. Record video is the middle option, labeled with duration limit. | Preserves existing screenshot path; video is discoverable without displacing primary flow. |
| Capture API | `navigator.mediaDevices.getDisplayMedia` + `MediaRecorder` only. No camera (`getUserMedia` video) in MVP. | Screen/tab recording is the bug-reporting need; camera adds permission surface and scoping risk. |
| Microphone | Off by default. Explicit checkbox `Include microphone` in consent pane. If checked, request audio via `getDisplayMedia({video:true, audio:true})` where supported; fallback to merging a `getUserMedia({audio:true})` track where `getDisplayMedia` audio is unsupported. User sees browser mic indicator. | Least-data default; audio is sensitive and harder to redact. |
| Consent | Inline consent copy before Start recording; `Don't show again` persists per scope as `bugaputa-skip-video-consent`. | Matches existing screenshot consent pattern (`bugaputa-skip-consent`). |
| Controls | Recording has `Stop` + `Cancel`. Preview has `Remove recording` (circular 44px button mirroring screenshot remove) + `Replace`/`Retake` (re-triggers getDisplayMedia). | Consistency with screenshot Remove control (widget/widget.css line 16–20). |
| Retry | Form error retains video for retry; same `onError` contract as screenshots (close clears, error does not). | Existing `clearAttachmentState` comment at widget/widget.js:102. |
| Annotation | Not offered for video. No annotation editor after video preview. | YAGNI — smuggling a video editor violates scope and size budget. Deferred to post-MVP (section 4.2). |
| File fallback | Inside video preview, show `<input type=file accept="video/webm,video/mp4">` plus `Upload a video instead` label. Same size/mime validation as captured blob. | Covers UnsupportedError and permission-denied path without dead end. |

### 4.2 Logical parity — decided

- Parity kept: `pageUrl`, `userAgent`, `viewport`, `language` auto-collected; `message`/`contactEmail` form; honeypot `website` must be empty; `x-project-key` header or `projectKey` body; same rate limit semantics.
- Video-specific: playback + download + badge/poster + duration. No annotation canvas.
- **Timeline markers / trimming / editing: DEFERRED.** Store raw recording only. Adding an editor now would double widget size and introduce codec re-encoding complexity. Record the need for a future `markers: [{tMs,label}]` sidecar if needed.

### 4.3 Failure-safe lifecycle — decided (state machine in §7)

- Every transition has a recovery path. UI never stays hidden or stuck: the floating trigger button (`#bugaputa-btn`) is restored on every close path (existing `close()` at widget/widget.js:140–156 does this for screenshots — video must do the same for its overlay/recording states).
- Object URL and track cleanup is centralized. `clearAttachmentState()` is extended to revoke `pendingVideoUrl` and stop `activeStream` tracks.

### 4.4 Compatibility — decided

| Concern | Decision |
|---------|----------|
| MIME negotiation | Probe `MediaRecorder.isTypeSupported` in priority: `video/webm;codecs=vp9,opus`, `video/webm;codecs=vp8,opus`, `video/webm;codecs=av1,opus`, `video/webm`, `video/mp4;codecs=h264,aac`, `video/mp4`. Pick first supported. If none, show fallback (UnsupportedError → file upload path). |
| Safari | Safari supports `video/mp4` recording (H.264) on recent versions but not `video/webm`. Negotiation covers it. Test on Safari 17+ (macOS). |
| Firefox | Firefox supports `video/webm` (vp8/vp9). |
| Chrome/Edge | `video/webm` (vp8/vp9/opus). |
| Desktop vs mobile | MVP is **desktop-first**. Mobile browsers largely lack `getDisplayMedia` (iOS Safari none, Android Chrome limited). On `!navigator.mediaDevices?.getDisplayMedia` show `Screen recording not supported on this device` + fallback file upload + other chooser options. Do not special-case mobile recording. |
| Display surface | `getDisplayMedia({video:{displaySurface:"browser"}})` hint where supported, but accept `monitor`/`window` too — do not reject by surface. |
| Permission cannot be stubbed | Release acceptance requires real headed allow AND deny tests (not mocked `navigator.mediaDevices`). See §11. |

### 4.5 Backend/data — decided

| Item | Decision | Detail |
|------|----------|--------|
| Schema column | `reports.videoPath TEXT` + `reports.videoMime TEXT` + `reports.videoDurationMs INTEGER` (all nullable). Optional `videoSizeBytes INTEGER` can be derived from file but storing helps list rendering without stat. MVP stores `videoPath` + `videoMime`; `durationMs` if measurable client-side, else NULL. | Migration via `PRAGMA table_info` + `ALTER TABLE ADD COLUMN` idempotent, matching `server/src/db.ts:94–99` pattern. |
| Multipart field | `video` (single file, maxCount 1). | Mirror existing `screenshot`/`annotations`/`domSnapshot` naming; field `video` is self-documenting. |
| MIME allowlist | `video/webm`, `video/mp4` (with codec-suffixed variants accepted if they parse to those base types). | Validate base mime after stripping `;codecs=...`. |
| Magic-byte validation | WebM: first 4 bytes `0x1A 0x45 0xDF 0xA3` (EBML). MP4: `ftyp` at bytes 4–7. Reject otherwise (400, no 500). | Read first 12 bytes via `fs.readSync`; same cleanup-before-respond pattern as screenshot path. |
| Filename | `randomUUID() + extFromMime(mime)` where ext map `video/webm→.webm`, `video/mp4→.mp4`. | Matches `server/src/routes/reports.ts:41–49` random filename pattern. |
| Max size | **25MB** (26,214,400 bytes). | Balances 60s of 720p vp9 (~2–8MB typical, worst ~20MB) with Coolify volume safety. Image cap stays 5MB; snapshot 8MB. Multer global limit is `MAX_SNAPSHOT_BYTES` (8MB) today — must be raised to `MAX_VIDEO_BYTES` (25MB) as the global `fileSize` is the largest artifact. Per-image 5MB check stays; per-video 25MB check added (section 6). |
| Max duration | **60 seconds client auto-stop; server enforcement is explicit and tested.** Client auto-stops at 60s and pre-upload validates duration. Server enforces via a tested header parser for WebM (EBML `Duration` element with `TimecodeScale`) and MP4 (`mvhd` timescale/duration box) — reject >61s with 413/400. If the header is unparsable/corrupt/truncated, do NOT claim enforcement: accept the file as a **manual fallback upload**, store `videoDurationMs=NULL`, and enforce only the byte cap (25MB). Document in the API that duration guarantee applies to in-widget recordings and to parser-supported webm/mp4; manual uploads beyond 60s that bypass the parser are capped by bytes, not duration, until robust probing (e.g. `ffprobe` sidecar) exists. Do not call a best-effort check an enforced maximum. | Client is authoritative for UX; server size guard is authoritative for storage; server duration probe covers the two allowlisted containers when parse succeeds. |
| Rate limit | **Separate video-upload limiter** plus existing report limiter. Keep `20/min/IP/project` for `POST /api/reports` without video; add `video` namespace limiter `5/min/IP/project` (recommended default: 5 video uploads per 60s window, 429 with `Retry-After`) enforced in `reports.ts` when `video` is present. Add per-project storage guard: `SELECT COALESCE(SUM(videoSizeBytes or file size),0) FROM reports WHERE projectId=?` or filesystem `du` check, soft cap **1GB per project** (recommended) → 413 `Project storage quota exceeded` when exceeded. Ensure every rejected multipart temp file is deleted via `cleanupUploads` before 429/413. Telemetry (`presence` namespace) stays isolated. Include alert threshold: log and alert at 75% of per-project quota. | Namespace isolation prevents video abuse from starving text reports and prevents storage exhaustion at 25MB × 20/min = 500MB/min. |
| Cleanup | Every early exit (honeypot, zod 400, bad projectKey 400, rate-limit 429, multer error, mime/size/magic failure) calls `cleanupUploads(req)` before responding. | Existing `cleanupUploads` at `reports.ts:89–101` iterates `req.files[key]` and `req.file`. Extend to include `video` key (already generic). |
| Delete | `DELETE /api/reports/:id` removes video file from `UPLOAD_DIR` (and legacy fallback) if present. | Mirrors screenshot/snapshot deletion loop at `reports.ts:293–301`. |
| Access | **Owner-authenticated, Range-capable route for video; screenshots stay public.** `GET /api/reports/:id/video` (auth required, `authMiddleware`, owner check via `report.projectId → project.ownerId`) streams `videoPath` inline with `videoMime`, `Accept-Ranges: bytes`, and `Range: bytes=` → 206 support. Alternative if strictly cleaner in this codebase: short-lived signed URL minted by the same owner check (`GET /api/reports/:id/video-url` returns `{url, expiresAt}` with HMAC token TTL ~15m, served by `GET /uploads/video/:token` with signature verification) — pick one and keep the other out of the MVP. Do NOT expose video via unauthenticated `GET /uploads/:filename` by UUID guess. Legacy image/snapshot routes `GET /uploads/:filename` remain public and unchanged for screenshots/snapshots. | Note: snapshot .html served as `application/octet-stream` attachment + `nosniff` stays; video served with correct Content-Type and Range on the authenticated route. Dashboard and tests must use the authenticated route. Explain cookie behavior in §6.3. |
| Range | Video playback requires HTTP Range on the authenticated route. `res.sendFile` (or streaming `createReadStream` with `Range` parsing) supports Range, but verify `Accept-Ranges: bytes` is set and `helmet` does not strip it. Add explicit test `GET /api/reports/:id/video` with `Cookie: jwt=…` + `Range: bytes=0-1023` expects 206. Unauthenticated `GET /api/reports/:id/video` must 401/403 and must not leak existence (treat as 404 or 403 consistently). | |
| CSP | Add `mediaSrc: ["'self'", "blob:", "data:"]` to `helmet.contentSecurityPolicy.directives` in `server/src/app.ts:56–77`. `frameSrc 'self'` stays; video is `<video src>`, not a frame. | Current CSP lacks `mediaSrc`, so `defaultSrc 'self'` would block `blob:` video preview if served via CSP header. |
| Migration compat | All new columns nullable; old rows return `videoPath: null` and dashboard hides video card. `GET /api/reports/:id` and `GET /api/projects/:projectId/reports` include new fields (null when absent). Widget works whether flag on or off. | |

### 4.6 Dashboard — decided

- List card: when `r.videoPath` present show `▶ Video · 0:23 · 8.4MB` badge (amber/blue style like status `Badge` in `ProjectReports.tsx:16–19`) and a thumbnail: if server can generate a poster, use `r.videoPosterPath`; otherwise render a muted `<video preload="metadata" muted>` first-frame or a static video icon. MVP recommends **icon + duration fallback** (no poster generation) to keep backend simple.
- Detail: `<video controls preload="metadata" playsInline crossOrigin="anonymous"> <source src="/uploads/<videoPath>" type="<videoMime>"> </video>` plus `Download` (anchor with `download`) and metadata row. States: loading (`Loading video…`), error (`Video unavailable — Download` + error alert), unsupported codec (`Your browser cannot play this video — Download it and open locally`).
- Preserve `ReportDetail.tsx` snapshot viewer (`SnapshotViewer` at lines 16–78, `sandbox=""`) and screenshot card — no regression.

### 4.7 Security/privacy — decided

- Least-data: mic off by default, no camera, no audio transcription, no video re-encoding server-side (store as-is).
- Explicit consent for audio: checkbox copy states recording includes audio if enabled; browser mic indicator is the OS-level consent signal.
- Cross-origin/embed: widget is a third-party script; `getDisplayMedia` prompt origin is the host page origin — no new embed risk. CORS for report submission stays `*` on `POST /api/reports` (existing behavior, `reports.ts:109–114`).
- Malicious media: mime + magic-byte validation, random filenames (no path traversal, `path.basename` + `randomUUID`), `X-Content-Type-Options: nosniff` on upload serving already helps; `Content-Type` is set from stored mime allowlist, not user-supplied header alone.
- Resource exhaustion: 25MB cap + duration auto-stop + rate limit + upload-volume monitoring. Coolify volume `/app/data` is bounded; plan section 13.5 adds monitoring.
- Content-Disposition: video served as `inline` (so `<video>` can stream) not `attachment`; snapshot stays `attachment` to avoid HTML execution.
- No secrets in fixtures: tests use `Buffer.from("89504e...","hex")` style; video tests will use tiny synthetic buffers (1KB) or real 1x1 probe files, never customer data.

### 4.8 Rollout — decided (§12)

### 4.9 Testing — decided (§9–§11)

---

## 5. File-by-file Change Map (with current code references)

### 5.1 Widget — `widget/widget.js` (≈1898 lines, IIFE) and mirror `client/public/widget.js`

| Area | Current reference | Change |
|------|-------------------|--------|
| Size guard | `widget/widget.js` 107,110 bytes raw / **30,547 bytes gzipped** at commit `4461019` against 30,720-byte ceiling → **173 bytes headroom**. Adding a third chooser button + wiring naively costs ~0.9–1.2KB gzipped and would breach the ceiling. | Reclaim >=1.5–2.0KB gzipped headroom **before** adding chooser wiring so the base stays <=29,696 bytes (29KB). Strategy (quantified, additive): (a) dead-code/whitespace trim in the IIFE preamble + presence dedupe ~0.3KB; (b) shorten long string literals / collapse repeated selectors in the injected CSS template ~0.4KB; (c) move snapshot-only helpers behind the existing lazy-loader guard so the base no longer bundles unused capture-engine shims ~0.4KB; (d) micro-minify `createWidgetConfig` label/color/position coercion helpers ~0.2KB; total ~1.3–1.7KB reclaimed, target 29.0–29.3KB base. Video-capture code lives in `widget/video-capture.js` (lazy-loaded via `loadScript(base+"/video-capture.js")`, never inlined). Base+lazy chunk combined is informational only; only the base is gated at 30,720. CI RED test: `gzip -c widget/widget.js | wc -c` must be <=29696 after reclaim and <=30720 unconditionally; existing baseline asserted as 30547 in `widget-mirror-and-size` test. If reclaim misses target, the plan explicitly justifies a budget change (e.g. 32KB ceiling) with a measured before/after `gzip -c` report — do not silently breach. |
| Chooser | `widget/widget.js:196–243` defines `#bugaputa-chooser` with `#bugaputa-choose-capture` + `#bugaputa-choose-general` and handlers at `:235–241` | Extend to 3 buttons: `#bugaputa-choose-screenshot` (renamed from capture), `#bugaputa-choose-video`, `#bugaputa-choose-general`. Add CSS for `#bugaputa-choose-video` (distinct but neutral — perhaps `background:#fff;border:1px dashed #cbd5e1` or same as screenshot secondary). All buttons get `aria-label`, `min-height:48px`, `focus-visible` ring. |
| Capture panes | `widget/widget.js:209–218` capturePane + consentBox + capBtn/capBack + capStatus | Split into `#bugaputa-screenshot-pane` (existing consentBox, behavior unchanged) and `#bugaputa-video-pane` (new). Video pane contains: consent copy, `Include microphone` checkbox (`#bugaputa-video-mic`), `Start recording` button, status div `#bugaputa-video-status`, fallback file input `#bugaputa-video-file` (hidden until unsupported/denied). |
| State vars | `widget/widget.js:96–103` — `capturedBlobUrl`, `capturedDataUrl`, `capturedDims`, `pendingAnnotatedFile`, `capturedSnapshotHtml`, `pendingSnapshotFile`, `pendingAnnotationsFile` | Add: `pendingVideoFile: File\|null`, `pendingVideoUrl: string\|null`, `pendingVideoMeta: {mime:string,durationMs:number,sizeBytes:number}\|null`, `activeStream: MediaStream\|null`, `mediaRecorder: MediaRecorder\|null`, `videoChunks: BlobPart[]`, `videoTimer: number\|null`, `videoElapsedMs: number`, `videoStartTs: number`. |
| clearAttachmentState | `widget/widget.js:103–123` centralizes teardown, revokes blob URLs, resets preview, hides remove button | Extend to revoke `pendingVideoUrl`, stop `activeStream` tracks, clear `videoTimer`, null `pendingVideoFile`/`pendingVideoMeta`/`mediaRecorder`/`videoChunks`. Also clean video preview children (the `<video>` element). Keep fidelity: called on every `close()` path; NOT on `onError` retention. |
| close() | `widget/widget.js:140–156` — calls `clearAttachmentState()`, cleans annotation editor, restores `#bugaputa-btn` display, removes promoted footer, restores scroll | Ensure video recording path also calls a `cleanupRecording()` before `clearAttachmentState()` when active — i.e. idempotent guard that stops tracks even if `close()` is entered via ESC/backdrop during recording. Button restore must cover video states (the trigger is hidden at `doCapture` via `b.style.display='none'` patterns — video hide must mirror). |
| trapFocus / onOverlayEsc | `widget/widget.js:124–139` | Add video-preview awareness: ESC during recording should `requestDiscardRecording()` (confirm if recording elapsed >5s), ESC during preview returns to chooser, not close entirely — mirrors annotation `requestDiscard()` confirmation at `:162–184`. |
| showForm | `widget/widget.js:245–359` — builds form, wires `fileInput` change (validation + preview + `hasAttachment`/`syncRemoveBtn`), submit handler picks file precedence and sends `FormData` (`:351–353`) or JSON (`:355–356`) | Add video branch: `hasAttachment()` also checks `pendingVideoFile`; `syncRemoveBtn()` covers video; `fileInput` (screenshot) change path remains; add `videoFileInput` change handler mirroring validation (size 25MB, mime webm/mp4). Submit handler: `hasFile` logic is refactored to `hasVideo = pendingVideoFile`; when present validate 25MB + mime allowlist + duration <=60s; then `fd.append('video', hasVideo)` alongside existing `screenshot`/`domSnapshot`/`annotations`. Ensure `website` honeypot short-circuit still calls `close()` without leaking files. |
| New module `widget/video-capture.js` | (new) | Exports `startVideoCapture({micEnabled, onProgress, onError, onPreview})` → handles `getDisplayMedia` + `MediaRecorder` lifecycle, MIME negotiation via `isTypeSupported`, chunk collection, timer (update every 200ms), max-duration auto-stop, `onended` (user closed share sheet) → triggers cancellation with cleanup, `NotAllowedError`/`AbortError` mapping, `NotSupportedError` mapping. Returns `{stream,recorder,stop,cancel}`. Lazy-loaded via `loadScript(base + "/video-capture.js")` pattern matching `loadScript` at `:371–377`. |
| scriptBase / loadScript | `widget/widget.js:366–377` | Reuse for video module URL construction. |
| Feature flag gate | (new) | After `fetchWidgetConfig()` resolves, read optional `videoCaptureEnabled` boolean from config response. Chooser third button `disabled` + tooltip when flag off; or hide it entirely (decision: hide when off to reduce confusion). Recommendation: **hide** the Record video button when flag false (choosen stays 2-way) so unsupported tenants don't see a disabled control. |
| Mirror | `client/public/widget.js` same as `widget/widget.js` | Must stay byte-identical after every change (existing invariant). CI must `diff -q widget/widget.js client/public/widget.js`. |

### 5.2 Widget CSS — `widget/widget.css` (75 lines) and mirror `client/public/widget.css`

Add styles (append after existing chooser block at line 43):

- `#bugaputa-choose-video` — same shape as `#bugaputa-choose-general` but with a subtle accent (e.g. icon `▶` via `::before`).
- `#bugaputa-video-pane`, `#bugaputa-video-status`, `#bugaputa-video-timer` (monospace, red dot indicator via `::before` pulsing).
- `#bugaputa-video-preview video {max-width:100%;max-height:220px;border-radius:8px;border:1px solid #e2e8f0;background:#0f172a}` plus preview meta line `#bugaputa-video-meta {font-size:11px;color:#64748b}`.
- `#bugaputa-remove-video` — reuse `#bugaputa-remove-screenshot` pattern (absolute top-right, 44px, `border-radius:999px`).
- Recording indicator `.bugaputa-rec-dot {width:8px;height:8px;border-radius:50%;background:#ef4444;animation:bugaputa-pulse 1s infinite}`.
- File fallback `#bugaputa-video-file` — mirrors `#bugaputa-file` styling (indigo file-selector button) + `accept` attr not styled.

No existing selectors are changed.

### 5.3 Server — `server/src/db.ts` (132 lines, SQLite WAL migration)

Current `migrate()` at `db.ts:40–117` creates `reports` with `screenshotPath,snapshotPath,annotationsPath` and idempotently adds `snapshotPath`/`annotationsPath` via `PRAGMA table_info` check.

Change:
```ts
// after existing reportCols loop (line 98):
const videoCols = ["videoPath","videoMime","videoDurationMs"] as const;
for (const col of videoCols) if (!reportCols.includes(col)) {
  const def = col==="videoPath" ? "TEXT" : col==="videoMime" ? "TEXT" : "INTEGER";
  database.exec(`ALTER TABLE reports ADD COLUMN ${col} ${def}`);
}
// plus projects flag:
const projCols = ... already extracted at 101
if (!colNames.has("videoCaptureEnabled"))
  database.exec("ALTER TABLE projects ADD COLUMN videoCaptureEnabled INTEGER DEFAULT 0");
database.exec("UPDATE projects SET videoCaptureEnabled=0 WHERE videoCaptureEnabled IS NULL");
```
Also export `WIDGET_DEFAULTS` stays; optionally add `VIDEO_MAX_BYTES` constant.

### 5.4 Server — `server/src/routes/reports.ts` (306 lines, multipart + honeypot + rate limit + cleanup)

Current constants at `reports.ts:12–19`:
```
ALLOWED_MIME = {png,jpeg,webp,gif}
SNAPSHOT_MIME = {text/html, gzip, x-gzip, octet-stream}
MAX_FILE_BYTES = 5MiB
MAX_SNAPSHOT_BYTES = 8MiB
IMAGE_FIELDS = {screenshot, annotations}
storage.filename handles domSnapshot .html/.html.gz
mimeToExt maps image mime
upload limits {fileSize: MAX_SNAPSHOT_BYTES, files:3}
fileFilter branches by IMAGE_FIELDS
pickedFiles returns {screenshot, domSnapshot, annotations}
cleanupUploads iterates req.files
POST handler normalizes body, honeypot short-circuit with cleanupUploads, validates zod, checks project, rate limit, per-image 5MB check, inserts report, 201
DELETE handler removes stored artifacts
```

Changes file-by-file deltas:

| Location | Change |
|----------|--------|
| Top constants | Add `const VIDEO_MIME = new Set(["video/webm","video/mp4"]);` `const MAX_VIDEO_BYTES = 25*1024*1024;` `const MAX_VIDEO_DURATION_MS = 60_000;` `const VIDEO_FIELDS = new Set(["video"]);` Update `const ALLOWED_ALL_MIME` comment accordingly. |
| `storage.filename` | Branch `if (file.fieldname==="video") { const ext = file.mimetype.includes("mp4")?".mp4":".webm"; cb(null, randomUUID()+ext); }` Keep existing domSnapshot branch first. |
| `mimeToExt` | Extend map with `video/webm→.webm`, `video/mp4→.mp4` (or inline in filename branch). |
| `upload` limits | Raise `fileSize` to `MAX_VIDEO_BYTES` (largest artifact). `files` limit from 3 to 4 (screenshot, domSnapshot, annotations, video). |
| `fileFilter` | Branch: `if (IMAGE_FIELDS.has(...)) allowed=ALLOWED_MIME; else if (VIDEO_FIELDS.has(...)) allowed=VIDEO_MIME or baseMime∈VIDEO_MIME (strip codecs); else allowed=SNAPSHOT_MIME;` Normalize `file.mimetype.split(";")[0].trim().toLowerCase()` before checking. |
| `pickedFiles` | Add `video: UploadedFile\|null`. |
| Per-file caps | Keep screenshot/annotations 5MB loop, add `if (files.video && size>MAX_VIDEO_BYTES) cleanup+413/400 ("File too large — max 25MB")`. Magic-byte check `validateVideoMagic(file.path, mime)` (read first 12 bytes, check EBML `1A45DFA3` or `ftyp` at 4–7) — on fail cleanup+400. Duration probe `probeVideoDurationMs(file.path, mime)` (WebM Duration/TimecodeScale and MP4 mvhd) — if parsed and >61_000ms reject 400 ("Video too long — max 60s"); if unparsable store `videoDurationMs=NULL` and accept subject to 25MB byte cap (honest split guarantee: duration enforcement only when parser succeeds; manual fallback capped by bytes). Also enforce video namespace rate limit (5/min/IP/project → 429 with Retry-After) and per-project 1GB quota → 413 before insert; every rejection deletes temp files via `cleanupUploads`. |
| Insert | Extend `INSERT INTO reports (..., videoPath, videoMime, videoDurationMs)` values `(..., videoPath, videoMime, videoDurationMs)`. |
| DELETE | Extend deletion loop to include `report.videoPath`. |
| Response shape | `POST /` still returns `{id}` 201; `GET /:id` and `GET /projects/:id/reports` automatically return new columns via `SELECT *`. No change there but tests assert new fields. |

New helpers to add in same file (or `server/src/lib/video.ts` — recommendation: keep inline in reports.ts to follow current single-file pattern; extract to `lib/video.ts` only if helper exceeds ~80 lines):

```ts
function baseMime(m: string){ return m.split(";")[0].trim().toLowerCase(); }
function isVideoMime(m: string){ return VIDEO_MIME.has(baseMime(m)); }
function validateVideoMagic(filePath: string, mimeIn: string): boolean { /* check EBML or ftyp */ }
async function probeVideoDurationMs(filePath: string, mime: string): Promise<number|null>
```

### 5.5 Server — `server/src/app.ts` (205 lines, helmet CSP + /uploads handler)

| Location | Change |
|----------|--------|
| `helmet({contentSecurityPolicy:{directives:{...}}})` at `app.ts:55–77` | Add `mediaSrc: ["'self'", "blob:", "data:"]` alongside existing `imgSrc`. Keep `connectSrc`, `scriptSrc`, `styleSrc` unchanged. |
| `/uploads/:filename` handler at `app.ts:100–124` | Extend content-type branch: after `if (lower.endsWith(".html")\|\|.xz)` block (which forces `application/octet-stream` + `attachment`), add `if (lower.endsWith(".webm")) res.type("video/webm"); else if (lower.endsWith(".mp4")) res.type("video/mp4");` before `res.sendFile`. Ensure `res.sendFile` Range support is verified (Express does this; keep as-is). Add `res.setHeader("Accept-Ranges","bytes")` explicitly. Keep legacy fallback path. |

### 5.6 Server — `server/src/lib/validators.ts` (48 lines, zod)

No direct video validation needed in `reportPublicSchema` (which validates `message`, `contactEmail`, `pageUrl`, etc.). Video is validated in the multer/fileFilter+handler layer. Optional: add a comment noting video field is handled there. No change required — YAGNI.

### 5.7 Server — `server/src/routes/projects.ts` (334 lines)

Add to `toProject(row)` return object:
```
videoCaptureEnabled: !!row.videoCaptureEnabled
```
Add alias handling for `widget_config` if needed.

Update `PATCH /:id` handler (currently only `widgetSettingsSchema`): extend to also accept `{videoCaptureEnabled?: boolean}` (new zod schema `projectVideoSettingsSchema` or widen `widgetSettingsSchema`). Recommendation: create `projectSettingsSchema` that includes widget_* + `videoCaptureEnabled: z.boolean().optional()` and keep `widgetSettingsSchema` for back-compat. Owner-only.

Also update `POST /` to set `videoCaptureEnabled: 0` default (already via DB default, no code change).

### 5.8 Server — `server/src/routes/widgetConfig.ts` (64 lines)

Include `videoCaptureEnabled` in response JSON (alongside label/color/position). Widget reads it to decide whether to show Record video.

### 5.9 Client — `client/src/lib/api.ts` (39 lines)

Add:
```ts
updateVideoCapture: (id:string, enabled:boolean)=> doFetch("/api/projects/"+id, {method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({videoCaptureEnabled: enabled})}),
```
And ensure `listProjects`/`getProject` types include `videoCaptureEnabled`.

### 5.10 Client — `client/src/pages/ProjectReports.tsx` (340 lines)

- Import `videoMime` awareness — no change to API client shape, just render branch.
- In `reports.map` card: after existing screenshot thumbnail `toSrc(r.screenshotPath)` branch, add video branch:
```tsx
{(r.videoPath||r.video||r.videoUrl) ? (()=>{ const s=toSrc(r.videoPath||r.video||r.videoUrl); const meta = `${r.videoMime||""} ${r.videoDurationMs? Math.round(r.videoDurationMs/1000)+"s":""}`.trim(); return s ? <span className="inline-flex items-center gap-1.5 text-xs bg-slate-900 text-white rounded-full px-2.5 py-1"><span aria-hidden>▶</span> Video {meta && <span className="opacity-70">{meta}</span>}</span> : null; })() : null}
```
- Keep structure responsive. Do not show a `<video>` element in list (heavy); use badge + maybe static icon.

### 5.11 Client — `client/src/pages/ReportDetail.tsx` (189 lines)

- Add `VideoViewer` component (parallel to `SnapshotViewer` at lines 16–78) or inline:
```tsx
function VideoViewer({reportId, mime}:{reportId:string; mime:string|null}) {
  const src = `/api/reports/${reportId}/video`;
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(true);
  return (
    <div className="mt-3">
      {loading && <div className="text-sm text-slate-400">Loading video…</div>}
      {err ? (
        <div role="alert" className="border rounded-xl p-4 bg-red-50 text-red-700 text-sm">{err} — <a href={`${src}?download=1`} className="underline">Download</a></div>
      ) : null}
      {/* same-origin cookie supplies httpOnly JWT; no crossOrigin needed */}
      <video controls preload="metadata" playsInline
        onLoadedMetadata={()=>setLoading(false)}
        onError={()=>{ setErr("This browser cannot play this video"); setLoading(false); }}
        className="w-full rounded-xl border bg-black max-h-[480px]">
        <source src={src} type={mime||undefined} />
      </video>
      <a href={`${src}?download=1`} className="mt-2 inline-block text-sm text-lime-600 hover:underline">Download</a>
    </div>
  );
}
```
Same-origin cookie behavior: dashboard and API share origin (`bugaputa.com`), so `<video src="/api/reports/:id/video">` sends the httpOnly JWT cookie automatically (SameSite=Lax). No CORS, no `crossOrigin="anonymous"` (which would omit cookies). If the deployment ever serves dashboard from a different origin, switch to `crossOrigin="use-credentials"` and `fetch(..., {credentials: 'include'})` → `blob:` URL path. `Download` triggers the same authenticated route with `?download=1` → `Content-Disposition: attachment`.
- In main render: above SnapshotViewer block, insert:
```tsx
{ report.videoPath && (<div className="bg-white border rounded-2xl p-5"><h2 className="font-semibold text-sm">Screen recording</h2><VideoViewer reportId={report.id} mime={report.videoMime||null} /><p className="mt-2 text-xs text-slate-400">{report.videoMime} · {report.videoDurationMs? Math.round(report.videoDurationMs/1000)+"s":""} · Download keeps the original file.</p></div>)}
```
- Keep screenshot card label as `snapshotPath ? "Flattened image" : "Screenshot"` — unchanged.

### 5.12 Other files NOT changed (explicit)

- `server/src/lib/rateLimit.ts` (41 lines) — no change, reuse same `rateLimitCheck` with default namespace `reports`.
- `server/src/lib/ip.ts` — unchanged.
- `server/src/middleware/auth.ts` — unchanged.
- `client/src/App.tsx`, `client/src/pages/Dashboard.tsx` — no video changes in MVP (list already via ProjectReports).
- `README.md` — update API table row for `POST /api/reports` to document `video` field (25MB, webm/mp4, 60s) and authenticated `GET /api/reports/:id/video` Range note (screenshots stay on `GET /uploads/:filename`). Out of scope for planning branch commit but flagged for follow-up PR.

---

## 6. API / Data Contract

### 6.1 Request — `POST /api/reports`

Public, CORS `*`, rate-limited `20/min/IP/project`, honeypot `website` must be empty.

Multipart (`multipart/form-data`) with `x-project-key` header OR `projectKey` field:

| Field | Required | Type | Notes |
|-------|----------|------|-------|
| `projectKey` (header/body) | yes | string | `pk_live_…` |
| `message` | yes | string | 10–2000 chars (zod) |
| `contactEmail` | no | string | valid email or "" |
| `pageUrl` | yes | string | valid URL |
| `userAgent` | no | string | ≤500 chars |
| `viewport` | no | string | e.g. "1280x720" |
| `language` | no | string | e.g. "en" |
| `website` | no | string | honeypot — non-empty → fake 201 + cleanup, no DB insert |
| `screenshot` | no | file | image/png,jpeg,webp,gif ≤5MB, random filename |
| `domSnapshot` | no | file | text/html or gzip ≤8MB, random .html/.html.gz |
| `annotations` | no | file | image/png,jpeg,webp,gif ≤5MB |
| `video` **(new)** | no | file | video/webm or video/mp4 (codecs suffix ok) ≤25MB, ≤60s, magic-byte validated, random .webm/.mp4 |

Any combination of `screenshot`, `domSnapshot`, `annotations`, `video` is valid; at least one of them is optional (same as today — `message` is the required part). So a video-only report (no screenshot/snapshot) is valid.

JSON fallback (`Content-Type: application/json`) stays — but video cannot be sent via JSON; JSON path remains unchanged.

Responses:

- `201 {id}` on success (including honeypot fake id).
- `400 {error, details?}` on validation / mime / size / magic / duration / unknown field.
- `429 {error}` on rate limit (cleanup already done).
- `500` never for file-type/size errors — they are 400.

### 6.2 Response — `GET /api/reports/:id` (auth) and `GET /api/projects/:projectId/reports` (auth)

Existing `SELECT * FROM reports` will now include:
```json
{
  "id": "…",
  "projectId": "…",
  "message": "…",
  "contactEmail": "…|null",
  "pageUrl": "…",
  "userAgent": "…",
  "viewport": "…",
  "language": "…",
  "screenshotPath": "…|null",
  "snapshotPath": "…|null",
  "annotationsPath": "…|null",
  "videoPath": "…|null",
  "videoMime": "video/webm|video/mp4|null",
  "videoDurationMs": 23100,
  "status": "open",
  "createdAt": "2026-09-15T…",
  "ipHash": "…"
}
```
Old rows have `videoPath:null, videoMime:null, videoDurationMs:null`.

### 6.3 Serving

#### 6.3.1 Legacy public `GET /uploads/:filename` (unchanged for screenshots/snapshots)

| Filename suffix | Content-Type | Content-Disposition | Auth | Notes |
|-----------------|--------------|---------------------|------|-------|
| `.html`, `.html.gz` | `application/octet-stream` | `attachment; filename="…"` plus `X-Content-Type-Options: nosniff` | none (public) | unchanged — prevents HTML execution |
| `.png/.jpg/.webp/.gif` | `image/*` | inline | none (public) | unchanged |

Legacy fallback `/data/uploads` kept. **Video is NOT served here in the hardened MVP.**

#### 6.3.2 Video `GET /api/reports/:id/video` (new — owner-authenticated, Range-capable)

`GET /api/reports/:id/video` — requires `authMiddleware` (httpOnly JWT cookie), checks `report.projectId → project.ownerId === req.user.id`, then streams `report.videoPath` inline with `Content-Type: <videoMime>`, `Accept-Ranges: bytes`, `Cache-Control: private, max-age=60`, `X-Content-Type-Options: nosniff`. Supports `Range: bytes=0-1023` → 206 with `Content-Range`. Unauthenticated → 401; non-owner → 404 (do not leak existence) or 403. `DELETE /api/reports/:id` removes the video file and future `GET .../video` is 404.

Same-origin cookie behavior: `<video src="/api/reports/:id/video">` on the dashboard origin (`bugaputa.com`) sends the httpOnly JWT cookie automatically (same-origin, `SameSite=Lax` cookie, no `crossOrigin` needed; keep `crossOrigin="anonymous"` off for cookie-authenticated video or set `crossOrigin="use-credentials"` only if CORS is involved — on same origin, plain `<video controls src="/api/reports/:id/video">` includes cookies). `Download` is `GET /api/reports/:id/video` with `?download=1` → `Content-Disposition: attachment; filename="…"` or a `fetch` with credentials → `blob:` URL. CSP `media-src` must allow same-origin video (see §5.5). If a signed-URL alternative is chosen, the mint endpoint is also owner-authenticated and tokens are HMAC-SHA256 with `expiresAt`, TTL ~15m, single-use optional.

Add `HEAD /api/reports/:id/video` mirroring headers (optional).

### 6.4 Projects — `PATCH /api/projects/:id`

Owner only. Body may include `widget_label`, `widget_color`, `widget_position` (existing) plus **`videoCaptureEnabled?: boolean`**. Other fields stay forbidden (400 on unknown per zod strictness decision — if schema is not strict, unknown fields are stripped).

Widget config — `GET /api/widget-config?project=pk_live_…` returns:
```json
{
  "label":"Feedback","color":"#171717","position":"right",
  "widget_label":"Feedback","widget_color":"#171717","widget_position":"right",
  "videoCaptureEnabled": false
}
```

---

## 7. Capture State Machine (widget)

```
idle
  │ click Record video
  ├─► consent (show consent + mic checkbox; Start / Back)
  │     │ Back → idle (chooser)
  │     │ Start → permission_request
  │
  ├─► permission_request (getDisplayMedia pending; show "Waiting…" + Cancel)
  │     │ cancel / ESC → cleanupTracks+cleanupTimer → idle
  │     │ NotAllowedError / AbortError → denied (show error + fallback file input + chooser links)
  │     │ NotSupportedError / no getDisplayMedia → unsupported
  │     │ stream.oninactive / track.onended → track_ended → denied/recover
  │     │ got stream + MediaRecorder started → recording
  │
  ├─► recording (stream active; MediaRecorder recording; timer 0/60; red dot)
  │     │ tick every 200ms update elapsed; auto-stop at 60s → processing
  │     │ navigation / visibility change / stream inactive → track_ended → processing if chunks>0 else denied
  │     │ Stop → processing
  │     │ Cancel → cleanupTracks+clearChunks → idle
  │     │ ESC → confirm discard if elapsed>5s → cancel
  │     │ modal close (X/backdrop) → cleanupTracks+clearChunks+revoke → idle (close())
  │
  ├─► denied (permission denied / dismissed)
  │     │ shows error + fallback: "Try Screenshot or General feedback or Upload a video file"
  │     │ upload via file input → validate → preview OR inline error
  │     │ Retake → permission_request
  │     │ Back → idle
  │
  ├─► unsupported (API absent or no mime supported)
  │     │ shows "Screen recording not supported on this device" + same fallback row
  │
  ├─► processing (recorder.onstop assembling blob; show spinner)
  │     │ empty blob (0 bytes) → invalid_blob → denied with "Recording was empty — try again"
  │     │ codec mismatch / error event → invalid_blob
  │     │ success → preview
  │
  ├─► preview (blob preview <video src=blobUrl controls>; meta duration/size/mime; Remove/Replace/Retake)
  │     │ Remove → revoke(blobUrl)+clear pendingVideoFile → denied/fallback state (keep formless preview pane)
  │     │ Replace via file input → validate (25MB, mime, magic not possible on blob — defer to server; client checks mime+size)
  │     │ Continue → form (showForm with pendingVideoFile attached)
  │
  ├─► form (message/email/context + honeypot + Submit)
  │     │ Cancel → close() cleanup
  │     │ Submit → submitting
  │
  ├─► submitting (fetch POST /api/reports with FormData {video: pendingVideoFile} )
  │     │ ok → success (show thanks, auto-close 2.2s, clearAttachmentState already handled by close)
  │     │ 4xx/5xx / network → recovered (show errBox, keep pendingVideoFile for retry, submitBtn re-enabled)
  │     │ tab navigation during fetch → browser may abort; on abort show recovered (retry)
  │
  ├─► recovered (form still visible with video retained; errBox visible; retry allowed)
  │     │ Submit again → submitting
  │
  └─► success (form hidden, success banner, auto-close timer)
```

Invariants:
- No state leaves `#bugaputa-btn` hidden after it has been hidden for recording/processing.
- Every state that holds a `MediaStream` has a path that calls `stream.getTracks().forEach(t=>t.stop())`.
- Every state that holds a blob URL has a path that calls `URL.revokeObjectURL(url)`.
- `localStorage` consent skip keys are namespaced (`bugaputa-skip-video-consent`) and never stored cross-origin.

---

## 8. Security & Privacy

| Area | Handling |
|------|----------|
| Least data | Video captures screen content only; no passwords/secrets collected intentionally. Existing DOM snapshot redaction (`REDACT_NAME_RE`, `data-bugaputa-mask` at widget/widget.js:480–494) does not apply to video — video is raw pixels. Mitigate with consent copy stating sensitive info should not be shown, plus mic off by default. |
| Audio consent | Checkbox `Include microphone` + browser/OS permission prompt + visible recording indicator are three signals; none are bypassable by script. |
| Cross-origin frames | `getDisplayMedia` shares whatever the display surface shows; cross-origin iframes appear as rendered in that surface (browser decides blanking). No extra exposure beyond what the user sees. |
| Malicious media | MIME + magic-byte validation blocks polyglot uploads; `helmet` + `nosniff` + allowlist `Content-Type` prevents sniffed execution. Video never rendered as `srcdoc`. |
| Path traversal | `path.basename` + `randomUUID()` filenames — same as screenshot path (`reports.ts:41, path.basename getUploadDir`). No user filename retained. |
| Resource exhaustion | 25MB per video, 60s auto-stop, 5/min/IP/project video limiter + 20/min/IP/project report limiter, per-project 1GB soft storage cap (413), `MAX_ORIGINS_PER_PROJECT` analog not needed; monitor upload volume + quota alerts. Rejected temp files always deleted before 429/413. |
| CSP | Add `media-src 'self' blob: data:`; keep `img-src 'self' data: blob: https:` for snapshots; `frame-src 'self'` etc unchanged. |
| Honeypot | Video upload on honeypot request must be deleted before fake 201, same as screenshots (`reports.ts:161–167` pattern). |
| No secrets in repo | Fixtures are synthetic tiny buffers; no customer data, no `.env` values committed. |

---

## 9. TDD Tasks in Implementation Order

Each task is small, test-first, and independently verifiable. Order matters — backend contract before widget before dashboard.

### T1 — Backend: migration + videoPath columns

- Add migration in `server/src/db.ts` (new columns + projects flag), idempotent.
- Tests: `server/tests/api.test.ts` — new `describe("video migration")` — fresh tmp DB has nullable columns; re-opening DB does not throw; defaults are 0/null.
- Verify: `npm --workspace=server run test -- --grep "video migration"` + inspect `PRAGMA table_info(reports)`.

### T2 — Backend: upload pipeline for `video` field (mime/size/magic/duration stub)

- Change `server/src/routes/reports.ts` (constants, storage.filename, limits, fileFilter, pickedFiles, per-file caps, magic check).
- Helper `validateVideoMagic` and lightweight `mimeToExt` extension.
- Tests: `server/tests/api.test.ts` new `describe("video upload")`:
  - accepts `video/webm` (.webm) and `video/mp4` (.mp4) with valid magic, file on disk, random filename; authenticated GET /api/reports/:id/video serves with correct content-type (derived from allowlisted mime, not client header) and Range 206 works; unauthenticated GET is 401/404.
  - accepts codec-suffixed mime `video/webm;codecs=vp9` maps to .webm.
  - rejects `text/plain`, `application/octet-stream` spoof, invalid magic (400 not 500), oversize >25MB (400), unexpected field `evil` (400), no leak on honeypot/bad key/rate-limit/short message (countUploadFiles before==after), delete cleans up video, snapshot .html still served as attachment not video.
- Verify: `npm --workspace=server run test -- --reporter=verbose`.

### T3 — Backend: CSP media-src + authenticated video Range

- Change `server/src/app.ts` CSP and upload handler.
- Tests: assert `GET /` CSP header contains `media-src` with `blob:`; authenticated `GET /api/reports/:id/video` returns `Accept-Ranges: bytes` and `Cache-Control: private`; same route with `Range: bytes=0-1023` returns 206 with `Content-Range`; unauthenticated request is 401 and non-owner is 404.
- Verify: same test command plus manual `curl -i -H "Range: bytes=0-5"`.

### T4 — Backend: projects flag + widget-config inclusion

- Change `server/src/routes/projects.ts` (`toProject`, PATCH schema) and `server/src/routes/widgetConfig.ts`.
- Tests: `GET /api/widget-config?project=pk_live_…` includes `videoCaptureEnabled` (default false); `PATCH /api/projects/:id {videoCaptureEnabled:true}` as owner succeeds, as other user 403, invalid type 400; `GET /api/projects` list includes `videoCaptureEnabled`.
- Verify: server tests.

### T5 — Widget base: 3-way chooser + CSS (no recording yet)

- Change `widget/widget.js` chooser to 3 buttons + handlers, add `widget/widget.css` video button styles, mirror to `client/public/*`, verify gizp size.
- Tests: `client/src/__tests__/bugaputa-widget.test.ts` (existing suite) — new assertions: chooser has 3 buttons when flag on, 2 when off; ESC/backdrop/cancel restore trigger; focus trap includes new buttons. Add `widget-deferred-reveal` guard still holds.
- Verify: `npm --workspace=client run test -- --reporter=verbose` + `gzip -c widget/widget.js | wc -c` ≤30720.

### T6 — Widget: lazy-loaded video-capture module + state machine

- New `widget/video-capture.js` + wiring in `widget/widget.js` (video pane, mic checkbox, status/timer, preview with `<video>` element).
- Extend `clearAttachmentState` + `close()` + `onOverlayEsc` for video.
- Tests: `client/src/__tests__/video-capture-lifecycle.test.ts` (new) with mocked `navigator.mediaDevices.getDisplayMedia` + `MediaRecorder`:
  - permission denied → denied state + fallback visible, trigger restored
  - unsupported (no getDisplayMedia) → unsupported state
  - recording → Stop → preview with blobUrl, timer auto-stop at 60s, track stopped
  - preview Remove → revoke + fallback, Replace via file input validates 25MB limit
  - modal close during recording cleans tracks + revokes, trigger restored
  - file fallback `video/webm` preview
- Also keep `write_file` filter workaround note: use `python open(path,'wb').write(content)` if `proces…` masking hits (seen in this repo — `process.env` references are masked in tool output).

### T7 — Widget: form submission carries `video` field

- Change `widget/widget.js:showForm` submit branch to append `video` to FormData.
- Tests: client widget test asserts `fetch` call body is FormData with `video` file when `pendingVideoFile` present, honeypot still short-circuits, error keeps video, close clears video.
- Also backend integration: `POST /api/reports` with `field("video", tinyWebm)` succeeds (already T2).

### T8 — Dashboard: list badge + detail video player

- Change `client/src/pages/ProjectReports.tsx` badge + `client/src/pages/ReportDetail.tsx` new `VideoViewer`.
- Tests: `client/src/__tests__/dashboard-video.test.ts` (new) — mock report with `videoPath` renders badge in list, detail fetches and shows `<video controls>` with src `/uploads/<videoPath>`, download link, error fallback when mime unsupported, preserves snapshot iframe rendering.
- Also verify existing `dashboard-redesign` and `dashboard-summary` suites still pass.

### T9 — Mirror/bundle identity + size budget

- Enforce `diff -q widget/widget.js client/public/widget.js` and `diff -q widget/widget.css client/public/widget.css` plus `gzip -c widget/widget.js` ≤30KB and `gzip -c widget/widget.js widget/video-capture.js` combined check (base alone ≤30KB, combined may be ≤40KB but lazy chunk stays separate).
- Tests: add `client/src/__tests__/widget-mirror-and-size.test.ts` asserting byte identity and gzip ceiling.

### T10 — Security/cleanup/Range edge cases

- Add backend tests for magic-byte rejection with correct mime but wrong bytes, header `X-Content-Type-Options: nosniff` on video serving, `Content-Type` derives from allowlist not upload header, cleanupUploads covers `video` on every failure path, rate-limit + video counts toward same bucket, no `projectKey` enumeration.

---

## 10. Exact Commands & Expected Outcomes

Run from repo root (`/home/hermes/workspaces/bugaputa-video-plan`) or the task worktree.

| Command | Expected outcome |
|---------|------------------|
| `npm --workspace=server run test -- --reporter=verbose` | All server suites pass including new `video migration`, `video upload`, `media-src` suites. Example tail: `Test Files  1 passed (1)` `Tests  48+ passed` with new video tests included; no 500 on 400 paths. |
| `npm --workspace=client run test -- --reporter=verbose` | All client suites pass including chooser, lifecycle, dashboard-video, mirror/size. Example tail: `Test Files  9+ passed` `Tests  60+ passed`. |
| `npm test` | Both workspaces pass sequentially. |
| `npm run build` | `server` `tsc` emits `server/dist/index.js`; `client` `vite build` emits `client/dist` assets; no TS errors. Exit 0. |
| `diff -q widget/widget.js client/public/widget.js && echo ok` | `ok` — mirrors identical. |
| `diff -q widget/widget.css client/public/widget.css && echo ok` | `ok`. |
| `gzip -c widget/widget.js | wc -c` | `≤ 30720` (30KB). |
| `gzip -c widget/widget.js widget/video-capture.js 2>/dev/null | wc -c` | Baseline noted; `video-capture.js` gzipped ≤ 8192 (8KB) target; base alone still ≤30KB. |
| `curl -s http://localhost:3000/health | jq .` | `{"ok":true}`. |
| `curl -i http://localhost:3000/api/reports/<id>/video -H "Cookie: jwt=<token>" -H "Range: bytes=0-1023"` | `206 Partial Content` with `Content-Range: bytes 0-1023/<total>` and `Accept-Ranges: bytes`; without cookie → 401. |
| `./scripts/smoke.sh http://localhost:3000` | `register → create project → public submit (x-project-key) → list reports (assert 1)` pass. Video smoke extended: `POST /api/reports` with `video` attach → 201 → authenticated `GET /api/reports/<id>/video` 200 video/webm (and 401 without auth). |
| `git status` on planning branch | Only `docs/plans/2026-09-15-video-capture-feedback.md` staged; no other diff. Commit as `docs: plan first-class video capture feedback`. |

---

## 11. Browser / Canary Matrix

### 11.1 Unit/integration (CI, mocked)

- Vitest + jsdom mocked `navigator.mediaDevices.getDisplayMedia` and `MediaRecorder` for lifecycle, validation, and cleanup assertions. Fast, deterministic.

### 11.2 Real browser headed matrix (acceptance — NOT mocked)

| Browser | OS | Video capture | Mime expected | Test |
|---------|----|---------------|---------------|------|
| Chrome 126+ | macOS / Linux | `getDisplayMedia` + `MediaRecorder` | `video/webm;codecs=vp9,opus` → `.webm` | Allow → record 5s → preview → submit → playable in ReportDetail + Range 206 |
| Chrome 126+ | macOS | deny | — | Deny → denied state + fallback visible, no stuck UI |
| Firefox 128+ | macOS / Linux | `getDisplayMedia` | `video/webm;codecs=vp8,opus` → `.webm` | Same as Chrome |
| Firefox deny | macOS | deny | — | Denied fallback |
| Safari 17+ | macOS | `getDisplayMedia` | `video/mp4` → `.mp4` | Allow → preview → submit → playable (also test Chrome playback of that mp4) |
| Safari deny | macOS | deny | — | Denied fallback |
| Mobile Safari | iOS | no getDisplayMedia | — | Unsupported state + file upload fallback + Screenshot/General still work |
| Android Chrome | Android | no/partial getDisplayMedia | — | Unsupported or limited — same fallback |

No test stubs the OS permission prompt for acceptance. `getDisplayMedia` prompt must be real in headed run.

### 11.3 Playback matrix

- `.webm` from Chrome must play back in Chrome, Firefox, and (if supported) Safari via `<video controls>`; `.mp4` from Safari must play back in all three. Where codec unsupported, dashboard must show `Download` fallback, not a silent failure.

### 11.4 Manual canary (isolated Coolify canary with separate state/storage/domain)

Required before promote-to-production:

1. Deploy canary Coolify app (same image tag, separate `bugaputa-data-video-canary` volume and domain `video-canary.bugaputa.com` or similar) with `videoCaptureEnabled` default false.
2. Enable flag for a canary project; run the Allow AND Deny prompt tests above against the canary domain (headed, not mocked).
3. Verify list badge, detail playback, Range, CSP header, snapshot/screenshot unaffected, upload volume growth.
4. Record evidence (screenshots + network logs) in canary run.

See §12.3 for isolation requirements.

---

## 12. Rollout & Rollback

### 12.1 Feature flag lifecycle

- Ship code with flag OFF for all projects. No worker auto-enables it.
- Dashboard owners opt in per project via Widget settings toggle. Widget reads flag via `GET /api/widget-config?project=…` includes `videoCaptureEnabled`.
- Embeds on sites without flag show the 2-way chooser (no Record video) — zero behavior change for existing tenants.

### 12.2 Canary isolation (required — precedes merge)

Do NOT reuse the production Coolify app for canary. Provision an **isolated feature-branch canary** before any merge to `main`:

- New Coolify Application `bugaputa-video-canary` pointing at the **feature-branch SHA** (not `main`), with:
  - Separate volume (e.g. `bugaputa-video-canary-data` → `/app/data`), so canary uploads and SQLite do not contaminate production.
  - Separate domain (e.g. `video-canary.bugaputa.com`), valid TLS, health check `GET /health`.
  - Environment copies `DATABASE_URL=/app/data/app.db`, `UPLOAD_DIR=/app/data/uploads`, `JWT_SECRET` (new random), `CORS_ORIGINS` etc from production but NOT sharing the volume.
- Keep production (`bugaputa.com`, app `811qw6y4gh56npcm5hzqblmk`) running `main` untouched during canary.
- Canary is the **first** real headed permission test surface. No merge until canary allow+deny pass.

### 12.3 Promote (only after canary acceptance)

Order is enforced: implementation → current-head CI + `github-actions[bot]`/`opencode-pr-review` bot review → **isolated feature-branch canary with headed allow AND deny tests** → final integration review → **merge to `main`** → Coolify auto-deploys `main` to production → production verification.

Only after canary acceptance (headed allow+deny, dashboard playback, Range, snapshot regression green):

- `meta-reviewer` ensures CI is green and `github-actions[bot]`/`opencode-pr-review` checks are passing on the feature branch HEAD; headed canary evidence (allow+deny logs + network traces) is attached to the PR.
- Merge feature branch to `main` via `meta-reviewer` draft PR when those gates are green — **Meta Team has autonomy to merge; do not wait for a manual Nik approval**. `Nik` merges only if he chooses to, not as a required gate. Never direct-push to default/protected branch.
- Coolify auto-deploys `main` to production; verify `GET /health`, `GET /api/health`, dashboard, and `widget.js` still serve.
- Gradually enable `videoCaptureEnabled` per project (owner toggle); do not bulk-enable.

### 12.4 Rollback

- **Code rollback:** capture the exact `origin/main` SHA **immediately before merge** (e.g. `git fetch origin && git rev-parse origin/main` and record it in the merge PR description and deploy notes). That SHA is the only valid rollback target for this release — do not use stale hardcoded SHAs (prior plan draft SHAs are not valid for a future release). Coolify rollback = redeploy that recorded SHA; `gh api` verification of the commit must match. One-click rollback reverts widget and API together.
- **Data rollback:** new columns/report fields are nullable — rolling back code leaves them inert. No data loss. Reports with `videoPath` will have their video hidden by old code but remain on disk and become visible again on re-deploy. No migration to undo. Keep `videoCaptureEnabled` flag off (nullable → 0) as the data-plane rollback.
- **Flag rollback:** set `videoCaptureEnabled=0` for all projects via `UPDATE projects SET videoCaptureEnabled=0` (or dashboard toggle). Widget chooser reverts to 2-way on next `widget-config` fetch (no embed change needed).
- **Storage:** if volume bloat is the trigger, keep `UPLOAD_DIR` files but gate new uploads via flag; no automatic deletion.

### 12.5 Observability & storage monitoring

- Add `du -sh /app/data/uploads` to on-call check; set an alert if volume exceeds 75% (e.g. 5GB soft cap). Video reports are larger — a 100-report cohort at 10MB each is ~1GB.
- Log video submissions with `{projectId, mime, sizeBytes, durationMs}` at `info` level (no PII, no message body).
- Dashboard: expose per-project video count/size in a future admin panel (deferred).

---

## 13. Key Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|------------|--------|-----------|
| R1 | Widget size blowout >30KB (base) | High if video code inlined | Blocks release (convention) | Lazy-load `video-capture.js` (requirement) + size CI gate (`gzip -c widget/widget.js`). |
| R2 | `getDisplayMedia` / `MediaRecorder` mime mismatch across browsers | High (Safari mp4 vs Chrome webm) | Playback fail / 400 on submit | Negotiation loop via `isTypeSupported`, base-mime validation, magic-byte check covers both; playback matrix tests both files. |
| R3 | Track / object-URL leak on modal close / ESC / navigation | Medium | Memory + camera indicator stuck + next open shows stale preview | Centralize teardown in `clearAttachmentState` + `cleanupRecording`; test every close path (including `beforeunload`). |
| R4 | Upload volume exhaustion (Coolify `/app/data` disk) | Medium | Production outage | 25MB cap + 60s auto-stop + rate limit; isolated canary volume proves growth; monitoring/alert at 75%. |
| R5 | Video codec unsupported on viewer's browser | Medium | Silent playback fail | `<video>` `onError` + `unsupported-codec` alert + download fallback; Range 206 ensures seeking doesn't hide decode errors. |
| R6 | Honeypot/validation/multer error leaks video temp file | Low (existing cleanup exists) | Disk leak | Explicitly extend `cleanupUploads` coverage and add countUploadFiles assertions on every failure path (like `api.test.ts:662–687` for screenshots). |
| R7 | CSP `media-src` missing blocks `blob:` preview | Medium | Widget preview appears broken | Add CSP directive; test header contains `media-src` with `blob:`. |
| R8 | Safari mobile shows broken Record video | Medium | Confusing UI | Detect `!getDisplayMedia` → unsupported state + file-upload fallback; mobile is not a supported recording surface. |
| R9 | Mirror drift (`widget/widget.js` vs `client/public/widget.js`) | Low | Stale widget in prod (`/widget.js` candidates at `app.ts:127–131` prefer `widget/widget.js` but both must match) | `diff -q` CI gate. |
| R10 | Snapshot regression (iframe/sandbox/attachment rendering) | Low | Pixel-exact guarantee broken | Keep `SnapshotViewer` untouched; add a snapshot-regression test run as part of T8; treat snapshot rendering failure as blocker. |

---

## 14. Bounden Open Questions (with recommended defaults)

| # | Question | Context | Recommended default |
|---|----------|---------|---------------------|
| Q1 | Single video vs multiple videos per report? | Could allow 2 clips; adds complexity | **Single `video` per report in MVP.** Multi-video is post-MVP (array field + carousel). |
| Q2 | Poster/thumbnail generation? | Extract first frame server-side (ffmpeg) vs client blob poster. | **Defer poster.** Use icon + duration badge in list and first-frame via `<video>` in detail without extra file. |
| Q3 | Duration enforcement: client vs server? | Client can lie; server probing mp4/webm duration is non-trivial. | **Client 60s auto-stop is UX; server parses WebM Duration + MP4 mvhd and rejects >61s when parse succeeds, otherwise stores NULL and caps by bytes. No best-effort called an enforced maximum — API docs state the split guarantee explicitly.** |
| Q4 | Audio default? | Hosts may not want any audio captured. | **Microphone off default; explicit opt-in checkbox; this is scope-set.** |
| Q5 | File upload alternative: allow .mov / .avi? | Users may upload screen recordings from elsewhere. | **No — only webm/mp4 allowlist.** .mov is mp4-variant but mime `video/quicktime` is a new allowlist entry with magic `ftypqt  ` — defer. |
| Q6 | Per-project flag vs global env flag? | Simpler global switch. | **Per-project `videoCaptureEnabled`** (already specced) — global env would block per-tenant canary. |
| Q7 | Should video reports count in `totalReports` / `openReports` aggregates? | Dashboard aggregates `SELECT COUNT(*) FROM reports …` | **Yes — video reports are reports.** No separate count. |
| Q8 | Retention/delivery after delete? | Should video be soft-deleted? | **Hard delete on `DELETE /api/reports/:id`** — same as screenshots (303 in reports.ts). Soft-delete is post-MVP. |
| Q9 | Video auth — should video be public by UUID? | Screen recordings are more privacy-sensitive than screenshots (mic, tab content). | **Owner-authenticated `GET /api/reports/:id/video` with Range (hardened MVP).** Keep screenshots/snapshots on public `/uploads/:filename`. Same-origin httpOnly cookie supplies auth to `<video>`; alternative is a short-lived HMAC signed URL minted by the same owner check (TTL ~15m). |
| Q10 | Combined max: screenshot + video + snapshot in one report? | Could exceed per-request size. | **Allow all three/four together** (files:3→4, fileSize 25MB guard, per-image 5MB + per-video 25MB). A combined report is legitimate (video + snapshot for searchable text). |

No question blocks MVP — each has a default above. Revisit only if user contradicts a default.

---

## 15. Future Execution Graph (profiles — DO NOT CREATE THESE CARDS YET)

Map to real Hermes profiles: `meta-backend`, `meta-frontend`, `meta-reviewer`, `meta-devops`. No card may combine the entire lifecycle — split into focused lanes so review/bot-review/browser-QA/merge/deploy each have a separate card.

### 15.1 Suggested lanes (sequential where dependent, parallel where safe) — 14 cards, exact accounting

```
T-do-plan  (done: this file) ─┬─► [01 BE-1] Backend migration + upload pipeline (T1+T2+T3)       profile: meta-backend
                              │         │
                              │         ▼
                              │    [02 BE-2] Backend flag + widget-config (T4)                   profile: meta-backend   parents: [01]
                              │         │
                              │         ▼
                              │    [03 BE-R] Review BE-1..BE-2                                    profile: meta-reviewer  parents: [01,02]
                              │         │
                              └─────────┼───────────────────────────────────────────────────────────┤
                                        │                                                           │
                              ┌─────────▼───────────────────────────────────────────────────────────▼──┐
                              │  [04 FE-1] Widget chooser + CSS (T5) with size reclaim               profile: meta-frontend  parents: [03]  (needs BE widget-config shape frozen)
                              │         │
                              │         ▼
                              │  [05 FE-2] Widget video-capture module + state machine + submit (T6+T7) profile: meta-frontend  parents: [04]
                              │         │
                              │         ▼
                              │  [06 FE-3] Dashboard list+detail video UI (T8)                       profile: meta-frontend  parents: [05]
                              │         │
                              │  [07 FE-M] Mirror/size gate (T9) — RED test + diff check             profile: meta-frontend  parents: [04,05,06] (or co-requisite with 05/06)
                              │         │
                              │         ▼
                              │  [08 FE-R] Review FE-1..FE-3+FE-M                                     profile: meta-reviewer  parents: [04,05,06,07,03]
                              │         │
                              └─────────┼───────────────────────────────────────────────────────────┘
                                        │
                              ┌─────────▼──────────────────────────────────────────────┐
                              │ [09 QA-BOT] GitHub Actions bot review + CI gate        │ profile: meta-reviewer  parents: [03,08]
                              │  (github-actions[bot] / opencode-pr-review automated) │ No additional review bots beyond the existing GitHub Actions bot.
                              └─────────┬──────────────────────────────────────────────┘
                                        │
                              ┌─────────▼──────────────────────────────────────────────┐
                              │ [10 CANARY] Isolated feature-branch Coolify canary      │ profile: meta-devops    parents: [09]
                              │  + headed allow AND deny permission tests (§11.2+§12.2) │ Builds feature-branch SHA, separate volume/domain.
                              └─────────┬──────────────────────────────────────────────┘
                                        │
                              ┌─────────▼──────────────────────────────────────────────┐
                              │ [11 RV-INT] Final integration review                    │ profile: meta-reviewer  parents: [10]
                              │  (verifies no screenshot/snapshot regression, API +    │  CSP/Range/auth, size gate, canary evidence)
                              │  dashboard + widget together)                           │
                              └─────────┬──────────────────────────────────────────────┘
                                        │
                              ┌─────────▼──────────────────────────────────────────────┐
                              │ [12 MERGE] Merge to main (draft PR)                     │ profile: meta-reviewer  parents: [11]
                              │  Records exact origin/main SHA pre-merge as rollback.   │  Autonomy to merge when gates green; no manual Nik gate.
                              └─────────┬──────────────────────────────────────────────┘
                                        │
                              ┌─────────▼──────────────────────────────────────────────┐
                              │ [13 DEPLOY-CANARY-ACCEPT] (alt lane if canary already │ profile: meta-devops    parents: [10] (if canary is post-merge verification)
                              │  ran pre-merge, this is a no-op/evidence gate)        │  In hardened order this merges into [10] — keep separate only if canary is rebuilt from main.
                              └─────────┬──────────────────────────────────────────────┘
                                        │  (hardened order keeps canary at [10] before merge; [13] is optional/merged)
                              ┌─────────▼──────────────────────────────────────────────┐
                              │ [14 DEPLOY-PROD] Promote to prod + production         │ profile: meta-devops    parents: [12] (and [10] evidence)
                              │  verification (health/CSP/Range/auth + widget.js)     │
                              └──────────────────────────────────────────────────────┘
```

Lane count: 14 enumerated above (01–14). If the optional [13] is merged into [10] (recommended — single pre-merge canary), the active DAG is 13 cards. Previous drafts miscounted ~12 while diagramming ~14 — this table is the source of truth.

Dependency notes:

- `BE-1` must land before `FE-1` reads the widget-config shape and before FE-2 submits `video`.
- `BE-2` can run in parallel with FE-1 once the rough shape is agreed, but `FE-R` [08] waits for both and for mirror/size [07].
- `FE-2` depends on `FE-1` chooser scaffolding.
- `QA-BOT` [09] waits for backend + frontend reviews [03,08]; no headed work until bot review + CI green.
- `CANARY` [10] is **before merge** and before `RV-INT`/`MERGE` — it builds the feature-branch SHA on an isolated volume/domain and runs headed allow+deny tests there.
- `RV-INT` [11] verifies canary evidence + no screenshot/snapshot regression.
- `MERGE` [12] records the exact `origin/main` SHA immediately before merge as the rollback target and merges when [09]+[10]+[11] are green; no manual Nik approval gate, no additional bot trigger.
- `DEPLOY-PROD` [14] auto-deploys `main` and verifies health/CSP/Range/auth and `widget.js`.

Never create these cards inside this planning task — they are planned but not yet instantiated. The plan file is the only artifact of `t_ef8a5815` / `t_59155575`.

---

## 16. Appendix — Inspected Files & Evidence

All paths relative to `/home/hermes/workspaces/bugaputa-video-plan` at commit `4461019c08f58a0c93fdb55ceaf5b3cffc08cb93`.

| Path | Notes inspected |
|------|-----------------|
| `widget/widget.js` (1898 lines, 107110 B, 30547 gzipped) | IIFE, defaults at :11–30, reveal timer :34–84, presence heartbeat :84, h helper :85, overlay/modal :186–356, capture fixups :360–478, snapshot sanitization :479–600+, choose/capture/consent/form lifecycle, `clearAttachmentState` :103–123, `close` :140–156, `showForm` :245–359, `trapFocus` :124–133 |
| `widget/widget.css` (75 lines) | Modal/chooser/capture-pane/annotation editor; chooser actions flex column, file-input indigo button, annotation canvas styles |
| `client/public/widget.js` | Byte-identical to `widget/widget.js` (107110 B, `diff -q` pass) |
| `client/public/widget.css` | Mirror of `widget/widget.css` |
| `server/src/routes/reports.ts` (306 lines) | ALLOWED_MIME, SNAPSHOT_MIME, MAX_FILE_BYTES, MAX_SNAPSHOT_BYTES, IMAGE_FIELDS, storage.filename, mimeToExt, multer limits {fileSize, files:3}, fileFilter, pickedFiles, cleanupUploads, POST honeypot :160–167, zod validation, project lookup, rateLimit, per-image 5MB guard, INSERT, DELETE artifact loop |
| `server/src/lib/validators.ts` (48 lines) | `reportPublicSchema` (projectKey, message 10–2000, contactEmail, pageUrl url, website honeypot, etc.) |
| `server/src/db.ts` (132 lines) | `initDb`, WAL, `reports` DDL with snapshotPath/annotationsPath + PRAGMA table_info migration, projects widget_* migration |
| `server/src/app.ts` (205 lines) | helmet CSP directives at :55–77, express.json limit 1mb, canonical redirect, widget asset CORP override, `/uploads/:filename` handler with html attachment logic at :100–124, widget asset candidates, error handler |
| `server/tests/api.test.ts` (~1270 lines) | suites: auth, projects, project aggregates, public reports, reports auth CRUD, rate limit, health & widget, annotated PNG upload & attachment validation edge cases, DOM snapshot + annotations artifacts, presence heartbeat |
| `server/src/lib/rateLimit.ts` (41 lines) | `rateLimitCheck(ip, projectId, namespace)`: 20/window 60s, isolated presence namespace |
| `server/src/routes/projects.ts` (334 lines) | `computePresenceFields`, `toProject` (includes widget defaults + aggregates + presence), GET list aggregate query, POST, GET :id enriched, PATCH widget settings |
| `server/src/routes/widgetConfig.ts` (64 lines) | Public `GET /api/widget-config?project=` CORS allow-all, returns defaults when missing, includes widget_label/color/position |
| `server/src/routes/presence.ts` (193 lines) | `sanitizeOrigin`, `resolveOrigin`, heartbeat debounce, `rateLimitCheck` with `presence` namespace, MAX_ORIGINS 50 |
| `client/src/pages/ProjectReports.tsx` (340 lines) | Tabs Issues/Widget/Snippet, `Badge`, `WidgetPreview`, status filters, report list with `toSrc(screenshotPath)` thumbnail, pagination |
| `client/src/pages/ReportDetail.tsx` (189 lines) | `SnapshotViewer` sandbox iframe pipeline, screenshot `<img>` + download + lightbox, status `select`, delete |
| `client/src/lib/api.ts` (39 lines) | `doFetch` with ApiError, `listProjects`, `createProject`, `getProject`, `updateProject`, `listReports`, `getReport`, `patchReport`, `deleteReport` |
| `client/src/components/BugaputaWidget.tsx` | Dev widget helper (not the public IIFE) |
| `README.md`, `.env.example`, `package.json`, `server/package.json`, `client/package.json`, `Dockerfile`, `docker-compose.yaml` | Stack confirmation: Node 20, Express/SQLite/multer, React/Vite, npm workspaces only, single Docker + Coolify volume `/app/data` |

---

## 17. Deferred Items (explicitly NOT in MVP)

- Timeline markers / comments on video.
- Video trimming / re-encoding / poster generation (ffmpeg).
- Audio transcription.
- Camera (`getUserMedia` video) capture.
- Multi-video per report.
- Auth-gated `/uploads/:video` — **now in hardened MVP as `GET /api/reports/:id/video` (owner auth+Range); signed-URL variant remains an optional alternative, not a deferral.**
- Client-side thumbnail generation for list.
- Server-side transcoding to normalize codec (mp4 vs webm).

---

*End of plan — actionable for an implementer with no prior context. Cite exact paths above when touching code; cite the state machine in §7 for widget work and the API contract in §6 for server/dashboard work.*
