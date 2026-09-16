# Video Recording Redesign v2 — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Date:** 2026-09-15
**Branch:** `feat/video-capture-feedback-2026-09` (PR #46 draft, head `bc0bd4f081c4685aed87ff107d471b86b7a70b27`) — prototype, not accepted UX. Update this branch; do not open second PR; do not merge without Nik.
**Supersedes:** Video 12–15 release path. Previous plan `2026-09-15-video-capture-feedback.md` (19ffd6d) is retained for context but superseded by this v2 spec.
**Goal:** One shared capture workspace where `Record video` opens the same high-quality annotation workspace as screenshots, augmented with recording controls. Annotations and pointer are captured in final video. Privacy is current-tab-only or honest unsupported fallback.

**Architecture:** Reuse proven screenshot annotation engine (live DOM overlay, not static bitmap) as the capture workspace base. Layer viewport-fixed recording toolbar + document-relative annotation vector layer + pointer halo; capture via `getViewportMedia()` if shipped else `getDisplayMedia` with strongest hints + Capture Handle identity verification; fallback to unsupported + file upload. Preserve backend (25MB/60s/Range/CSP/flag OFF) and reuse where contract holds.

**Tech Stack:** vanilla JS IIFE widget (`widget/widget.js` + lazy `widget/video-capture.js`, `widget/widget.css`), Node 20 Express + SQLite `better-sqlite3` WAL + multer + helmet, React 18 Vite Tailwind dashboard, single Docker volume `/app/data`, Coolify isolated canary.

---

## 1. Problem Statement

Nik demonstrated Ybug's behavior and rejected Bugaputa's current recorder as unusable because it only records video. Reference screenshots (`img_f16b*` through `img_696f*`) show: a screenshot-style floating annotation/recording toolbar; native prompt "Allow ybug.io to see this tab?"; annotations that move with page content during scroll; active timer/stop/mic/tools; and a polished recording-preview modal with Record again/Delete/Done.

PR #46 as built provides a bare consent-only recorder (consent pane → `getDisplayMedia({video:{displaySurface:'browser'},audio:false})` → MediaRecorder → preview) without annotation while recording, without pointer emphasis, without a shared screenshot workspace, and without scroll-attached annotations. This is a parallel inferior tool, not the required shared workspace.

## 2. Goals / Non-Goals

Goals:
- Unified workspace: screenshot and video share the same annotation engine and visual language; no parallel inferior tool.
- Toolbar contract: viewport-fixed, responsive, movable, 44px hit targets, a11y (accessible name/tooltip/focus-visible/disabled/active) — Record/3s countdown/timer/Stop, mic OFF default with explicit text/tooltip, pointer/select, pen/arrow/rect/text, color, undo/redo, delete/clear, Done/Cancel — matching screenshot's actual supported tools.
- Real permission timing: workspace entry does not request capture; Record click is the gesture. Denial/abort → Retry/Upload/Cancel, no stuck overlay.
- Privacy: current-tab-only. Prefer `getViewportMedia()` if genuinely shipped; else `getDisplayMedia` with `preferCurrentTab:true`, `selfBrowserSurface:'include'`, `surfaceSwitching:'exclude'`, `monitorTypeSurfaces:'exclude'`, `systemAudio:'exclude'`, `displaySurface:'browser'`, `audio:false`, validated via Capture Handle / displaySurface check. If unverifiable, show unsupported + upload fallback — never broad capture. Document that hints alone cannot constrain chooser.
- Mic: separate `getUserMedia({audio:true,video:false})` only after opt-in, OFF default, no system/tab audio, no camera, recoverable denial.
- Annotations while recording are captured pixels; document-relative storage with scroll compensation (`requestAnimationFrame`, document-sized vector layer), handling main + nested scroll containers, undo/redo preserved.
- Pointer halo + click ripple, non-blocking, high-contrast, reduced-motion aware, toggleable, visible in playback, visible on light/dark.
- Interaction: pointer mode allows page interaction; drawing captures gestures without breaking wheel/trackpad scroll; all termination paths (navigation, tab close, Stop sharing, track end, 60s, 25MB, errors) lead to preview/recovery never silent loss.
- Preview modal: polished, accessible, responsive 390px, title/player/duration/size, Record again/Delete (explicit + confirm/undo)/Use recording/Continue, focus trap, ESC cannot discard silently, restores focus, cleans streams/blob URLs/timers on retry.
- Invariants retained: 60s, 25MB, owner-auth Range streaming, 5/min/IP/project video namespace, 1GB quota, OFF default, lazy recorder, base widget ≤29KB gzip before lazy video, repo private, prod untouched until merge.
- Browser: Chrome/Edge desktop primary for verifiable current-tab; others capability-detected → honest fallback.

Non-goals:
- Camera, system/tab audio, whole-screen/window/other-tab capture, video editing/trimming/transcription, timeline markers, server re-encoding.

## 3. User Journeys

### Reporter — happy path (Chrome desktop)
1. Click feedback tab → modal with chooser (Screenshot / Record video New / General). Picks Record video.
2. Workspace opens: live page dim not, floating toolbar appears (no permission yet). Toolbar shows mic OFF, pointer selected, drawing tools, Record button.
3. Click Record → 3s countdown (cancelable) → native permission prompt appears (tab-only intent). Timer 00:00/01:00 visible.
4. Grant → recording indicator red dot, timer ticks. Scroll page — previously drawn box around "Price: $12" scrolls out with content and back in same place. Undo still works. Move pointer — halo follows, click ripple appears.
5. Stop → polished preview modal with playable video (annotations + halo visible), duration/size, Record again / Delete recording / Use recording. Use recording → form (Describe bug *, email, Will be sent context, honeypot). Send → 201, success, auto-close. Dashboard owner sees badge + playable video via authenticated Range.

### Reporter — denial
3b. Deny prompt → toolbar restored, inline error, explicit Retry / Upload video / Cancel. Upload webm ≤25MB → preview path → form → submit. No stuck overlay.

### Reporter — unsupported (Firefox/Safari/mobile or unverifiable tab)
Enters workspace, clicks Record → capability probe fails or displaySurface/handle proves not current-tab → unsupported banner "Recording this tab isn't supported in this browser — upload a video instead" + file input + Screenshot/General links. Never offers screen/window picker.

### Owner
Dashboard ProjectReports → toggle Enable video capture (per-project, OFF default). After report, sees badge `▶ Video · 0:23 · 8.4MB` in list, detail shows VideoViewer with `<video controls>` from `GET /api/reports/:id/video` (cookie auth, Range 206), Download, error states. Screenshot/snapshot rendering unchanged.

## 4. State Machine (widget)

```
idle (chooser: Screenshot/Record video/General)
 │
 ├─ pick Record video → workspace (toolbar, live page, no permission, mic OFF)
 │    │
 │    ├─ Back/Cancel/ESC → idle (chooser) [no tracks]
 │    │
 │    ├─ Record → countdown (3s, cancelable → workspace)
 │    │        │
 │    │        ├─ cancel/ESC → workspace
 │    │        └─ end countdown → requesting (getViewportMedia OR getDisplayMedia with hints)
 │    │                         │
 │    │                         ├─ no API / no supported mime → unsupported (banner + upload + links → workspace on Retake)
 │    │                         ├─ NotAllowedError/AbortError/SecurityError → denied (Retry / Continue without mic if mic denial / Upload / Cancel → workspace/chooser)
 │    │                         ├─ surface/handle proves not current-tab → unsupported (no silent fallback to screen/window)
 │    │                         ├─ user closed share / track ended before start → denied/recover (toolbar restored)
 │    │                         └─ got stream + MediaRecorder started → recording
 │    │
 │    └─ unsupported (probe failed) → file upload path → preview when valid file chosen
 │
 ├─ recording (stream active, MediaRecorder recording, timer, halo tracking, annotation layer live)
 │    │ tick every ~200ms, auto-stop at 60s → processing; size guard >25MB → stop + error
 │    ├─ Stop → processing
 │    ├─ Cancel (confirm if elapsed>5s) → cleanup tracks/revoke/timers → workspace
 │    ├─ ESC → confirm discard if >5s → cancel path above
 │    ├─ backdrop/X/modal close → same cleanup → close() restores #bugaputa-btn, removes overlay, restores scroll/focus
 │    ├─ navigation / tab close / Stop sharing / track onended → track_ended → processing if chunks>0 else denied with recovery
 │    └─ drawing/pointer interactions (see §7/#8) never break wheel/trackpad scroll
 │
 ├─ processing (assembling blob, checks: empty blob → invalid, size>25MB → capped, dur>61s → capped)
 │    ├─ empty/invalid → denied ("Recording was empty — try again")
 │    └─ success → preview
 │
 ├─ preview (modal: video player blobUrl, duration/size/mime, Record again / Delete recording (confirm/undo) / Use recording)
 │    ├─ Record again → revoke blobUrl, stop old tracks, clear timers, return to workspace (clean state)
 │    ├─ Delete recording → explicit confirm/undo → denied-like state (banner + upload + Retry)
 │    ├─ ESC → blocked if would discard silently; requires explicit Delete or confirm
 │    └─ Use recording/Continue → form (message/email/context/honeypot/Submit)
 │
 ├─ form (has pendingVideoFile retained; Remove screenshot control still covers video attachment)
 │    ├─ Cancel → close() cleanup (revokes)
 │    └─ Submit → submitting (FormData {video: pendingVideoFile})
 │         ├─ ok → success (thanks, auto-close ~2.2s, cleanup via close)
 │         └─ 4xx/5xx/network → recovered (error box, video retained for retry, submit re-enabled)
 │
 └─ success / recovered as in prior plan; trigger button always restored when overlay removed.
```

Invariants: every holder of MediaStream has a stop path; every blobUrl has a revoke path; `#bugaputa-btn` never stays hidden; localStorage skip key `bugaputa-skip-video-consent` namespaced; follow-up Record again cleans prior session.

## 5. Privacy / Permission Contract

- Entering workspace does not call `getDisplayMedia`/`getViewportMedia`. The Record click is the user gesture.
- Preference order: try `navigator.mediaDevices.getViewportMedia` (proposed direct tab-viewport capture) if `typeof getViewportMedia === 'function'` and feature-detect via `isTypeSupported` probe not throwing AND a test call would show tab-only surface — only where genuinely shipped (currently limited). Otherwise use `getDisplayMedia`.
- `getDisplayMedia` call: `{ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true, selfBrowserSurface: 'include', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude', systemAudio: 'exclude' }` shaping — but note `preferCurrentTab` and `selfBrowserSurface` are constraint hints, not security guarantees; Chrome may ignore or broaden chooser.
- Validation after stream: check `track.getSettings().displaySurface === 'browser'` and, if available, `track.getCaptureHandle()` / `MediaStreamTrack.getCaptureHandle` or `navigator.mediaDevices.getDisplayMedia({ preferCurrentTab })` identity token via `captureHandle` config. If `getSettings().displaySurface` is `monitor`/`window` or handle mismatches current tab identity, treat as not current-tab and route to unsupported fallback — do not accept the stream.
- Document: "`getDisplayMedia` hints alone cannot legally constrain the browser's chooser; we do not promise more than the browser proves via `getSettings` + Capture Handle." If the browser version lacks verifiable current-tab signal, the honest fallback is unsupported + file upload.
- Mic: only after explicit toggle ON, then `getUserMedia({audio:true,video:false})` and `stream.addTrack(audioTrack)` merging. Mic OFF by default. Mic denial stops every acquired track (display stream too) and offers Retry / Continue without mic. Never add system audio track.
- Never call `getDisplayMedia({audio:true})` for mic; never request `video:true` via `getUserMedia`.

## 6. Browser Support Matrix

| Browser | OS | Probe | Capture hint | Verification | Recording | Playback | Expected UX |
|---------|----|-------|--------------|--------------|-----------|----------|-------------|
| Chrome 120+ | Desktop | `getDisplayMedia` exists, `MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')` | `displaySurface:'browser'` + hints, try `getViewportMedia` if shipped | `displaySurface==='browser'` + Capture Handle tab identity | Supported (primary) | webm | Full workspace + timer + annotations + halo |
| Edge 120+ | Desktop | same | same | same | Supported | webm | Same as Chrome |
| Chrome/Firefox deny | Desktop | same | same | same | Deny → denied state | — | Retry/Upload/Cancel, no stuck UI |
| Firefox 128+ | Desktop/macOS | `getDisplayMedia` exists, webm vp8 | hints (Firefox ignores some) | `displaySurface` check often absent → cannot verify tab-only → honest unsupported fallback | Unsupported (no verifiable tab-only) unless Firefox ships handle → then benchmark | mp4/webm playback fallback | Banner + file upload + Screenshot/General; never offer screen/window |
| Safari 17+ | macOS | `getDisplayMedia` may exist for tab, mp4 only | hints limited | handle absent → cannot verify → unsupported fallback | Unsupported until verifiable | mp4 via fallback upload only | Same honest fallback |
| Safari iOS / Android Chrome | Mobile | `!getDisplayMedia` or no mime | — | — | Unsupported | — | Same fallback |
| Any unverifiable | Any | mime unsupported / no getDisplayMedia / handle mismatch | — | — | Unsupported | — | Upload ≤25MB webm/mp4 → preview → submit; picture proof required honest banner |

Release acceptance: **real headed Chrome/Edge allow AND deny** (no mocked `getDisplayMedia`, no fake UI auto-accept, no Chromium emulation, no synthetic stream as final evidence). Deterministic mocked tests remain for regression coverage but cannot count as heading QA.

## 7. Annotation Coordinate Model

Requirement: a mark around an element must move with that element on scroll and return to same place.

Model:
- Annotations are vector objects stored in **document coordinates** (offset relative to `document.documentElement`), not viewport (`clientX/Y`).
- Input conversion: `pointerEvent.clientX + window.scrollX` (and `scrollY`), with `requestAnimationFrame` throttling for move. For nested scroll containers, also add container `scrollLeft/top` and render against container's coordinate space; define primary target as `document` scrolling — nested containers annotated within their scrollport use container-local coordinates (vector layer sized to scrollHeight, positioned absolute inside container, scroll listener via `ResizeObserver` + `scroll` event updates transform).
- Rendering: a single document-sized `<svg>` / `<canvas>` vector layer (absolute, width `document.documentElement.scrollWidth`, height `scrollHeight`) overlaying the live page, with `transform: translate(-scrollX, -scrollY)` or viewport-compensated offset on each frame, so annotations appear fixed to content. Toolbar is `position:fixed` outside this layer (not captured at viewport coords incorrectly). During recording, this layer is part of captured pixels because `getDisplayMedia` captures the composited viewport — viewport-fixed toolbar is intentionally visible; annotations visibly move with content.
- History: undo/redo stacks store serialized annotations in document coords, so undo after scroll replays correctly. `pushUndo()` called on start/end of each gesture.
- Hit testing: viewport-to-document conversion before `pointInPolygon` / bounds checks. `requestAnimationFrame` for render loop, `will-change: transform` on layer.

## 8. Pointer Visibility Design

- Element: non-blocking `pointer-events:none` halo (e.g. 20px radial, high-contrast `border: 2px solid #fff` + `box-shadow: 0 0 0 2px #0f172a` + blend) following `pointermove` via RAF, captured in video because it is DOM within viewport.
- Click ripple: brief expanding circle on `pointerdown` (180ms, respects `prefers-reduced-motion` → fade only).
- Contrast: halo remains visible on light and dark backgrounds via double-border / mix-blend technique; tested against both.
- No interception: layer never captures clicks when in pointer/select mode (page receives events); drawing modes capture annotation gestures via `setPointerCapture` on canvas only.
- Toggle: exposed as toolbar button (eye/halo) with `aria-pressed`, persisted optionally in session.
- Playback proof: recorded video shows halo moving and ripple on click — verified in headed QA.

## 9. Preview Flow

After `MediaRecorder.onstop` (Stop or track end):
- Polished modal (same overlay z-index family, focus trap, `aria-modal`, ESC cannot discard silently): title "Review your recording", `<video controls playsinline preload=metadata>` with blobUrl, metadata line `mm:ss · X.X MB · mime`, primary `Use recording`/`Continue` (inserts into form), secondary `Record again` (cleans old streams/blobUrls/timers before returning to workspace), destructive `Delete recording` (explicit text label, not unlabeled icon, with confirm dialog or undo toast).
- Responsive: desktop fixed 520px modal, 390px single column, actions fixed at modal footer, no clipping/overflow, readable text.
- States: loading spinner during `processing`, error alert on empty/size/duration failure, focus restoration to trigger on close.
- Retry path: `Record again` re-enters workspace clean; `Delete` leaves toolbar with Retry/Upload/Cancel.

## 10. Failure States

| Trigger | Handling | Never |
|---------|----------|-------|
| Permission denied / dismissed | Denied state: error text, Retry / Continue without mic (if mic denial) / Upload video / Use screenshot / General | Stuck overlay, hidden Retry |
| No getDisplayMedia / no supported mime | Unsupported banner + upload + chooser links | Offer screen/window picker |
| unverifiable displaySurface / handle mismatch | Unsupported + upload | Silently accept screen/window |
| Mic denied | Stop all tracks, offer Retry / Continue without mic (starts recording without audio) | Leave mic track hanging, stale indicator |
| User closes share (track onended) during recording | If chunks>0 → processing→preview, else denied with Retry | Silent loss |
| Navigation / tab close / Stop sharing | Same as above | Lose without recovery |
| 60s elapsed | Auto-stop → preview | Continue beyond limit |
| >25MB blob | Reject with "Video too large — max 25MB" → fallback upload path | Silently truncate |
| Empty blob | "Recording was empty — try again" → denied | Show blank player |
| Network / 4xx / 5xx on submit | Keep video attached, error box, retry enabled | Clear attachment on error |
| ESC during recording (>5s) | Confirm discard | Silent discard |
| 390px layout | Reflow toolbar to overflow-x scroll, modal actions stacked | Clipping, overflow hidden |

## 11. Telemetry / Privacy Stance

- No covert collection. Video is user-initiated, per-project flag OFF default. Logs include `{projectId, mime, sizeBytes, durationMs, flagState}` at info — no message body, no PII.
- Snapshot redaction (`REDACT_NAME_RE`, `data-bugaputa-mask`) does not apply to video (raw pixels) — consent copy warns not to show sensitive info.
- No auto-transcription, no re-encoding server-side (store as-is). Lazy video chunk prevents base bundle bloat.

## 12. Backend Reuse Map

Reuse where contract holds; no gratuitous rewrite.

| Area | Current state (PR #46) | Verdict | File |
|------|------------------------|---------|------|
| Migration | `reports` videoPath/videoMime/videoDurationMs/videoSizeBytes + `projects` videoCaptureEnabled, idempotent via `PRAGMA table_info` | **Retain** — satisfies invariants | `server/src/db.ts:94–120` |
| Upload contract | `POST /api/reports` multipart field `video` with `VIDEO_MIME` (webm/mp4, codec suffix ok), `MAX_VIDEO_BYTES 25MB`, `MAX_VIDEO_DURATION_MS 60s` + 1s tolerance, magic-byte EBML/`ftyp`, mvhd/WebM duration probe, `PROJECT_VIDEO_QUOTA_BYTES 1GB`, separate `video` rate-limit namespace 5/min + `Retry-After`, per-project quota, honeypot cleanup, temp-file cleanup every early exit, random UUID filename, `INSERT` includes video columns, `DELETE` cleans video file | **Retain** — validated, tested (547-line video.test.ts, flag.test.ts). Do not rewrite; only fix if spike identifies conflict (none expected) | `server/src/routes/reports.ts`, `server/src/lib/video.ts:1–177` |
| Auth streaming | `GET /api/reports/:id/video` owner-auth, `Range` support (`bytes=0-` + suffix `bytes=-N`, strict single range), `Accept-Ranges: bytes`, 401/404 handling, `GET /uploads/:filename` blocks `.webm/.mp4` public | **Retain** | `server/src/routes/reports.ts:360+`, `server/src/app.ts:120` |
| CSP | `helmet` `mediaSrc ['self','blob:','data:']` + existing directives, `Cross-Origin-Resource-Policy` widget assets | **Retain** | `server/src/app.ts:60–77` |
| Widget flag | `widgetConfig` GET includes `videoCaptureEnabled`, project PATCH `videoCaptureEnabled`, TOCTOU-safe | **Retain** | `server/src/routes/widgetConfig.ts`, `server/src/routes/projects.ts` |
| Dashboard | `ProjectReports` video toggle + badge, `ReportDetail` VideoViewer `<video controls>` with auth cookie + download | **Retain** | `client/src/pages/ProjectReports.tsx:335–355`, `client/src/pages/ReportDetail.tsx` |
| Widget video chooser/mirror | 3-way chooser, `widget-config` fetch, presence dedupe, size reclaim, lazy `video-capture.js` via `loadScript(base+'/video-capture.js')` | **Retain chooser/prefetch logic**, but upgrade pane → shared workspace | `widget/widget.js:49–98,118–270` |
| Bare video pane lifecycle | `video-capture.js` 72-line session: `getDisplayMedia({video:{displaySurface:'browser'},audio:false})` + optional `getUserMedia` mic merge + MediaRecorder + timer | **Replace** — lacks shared annotation layer, lacks scroll-attached coords, lacks halo, lacks capture-handle verification, lacks strong hints/surface validation/honest fallback | `widget/video-capture.js:16–69` |

## 13. Technical Spike — Ybug-style "Allow ... to see this tab?" Proof

Spike acceptance item (blocks frontend workspace entry integration):

- Question: which standards path can actually produce the Ybug-style current-tab-only prompt ("Allow ybug.io to see this tab?") on the isolated canary in headed Chrome/Edge for normal web content?
- Candidates: `navigator.mediaDevices.getViewportMedia()` (tab-viewport direct, no chooser) vs `getDisplayMedia({preferCurrentTab:true, selfBrowserSurface:'include', surfaceSwitching:'exclude', monitorTypeSurfaces:'exclude', systemAudio:'exclude', video:{displaySurface:'browser'}})` + `track.getSettings().displaySurface` + `track.getCaptureHandle()` identity check.
- Method: on canary domain `https://canary-native-bugaputa.no-code.gdn`, run a minimal script-bag page that calls each path, observe native prompt wording and resulting `displaySurface`/handle. Record evidence: screenshot of prompt + `getSettings()` dump.
- Success bar: spike documents which path yields a prompt whose accept leads to a stream provably `displaySurface==='browser'` and handle matches current tab (or, if none, explicitly states "exact Ybug prompt unavailable to normal web content" and mandates the conservative unsupported/upload fallback rather than broad capture).
- Outcome informs §5 privacy contract — do not promise browser choice constraint beyond what `getSettings` + handle proves.

## 14. Acceptance Criteria (exact)

- Widget: base `gzip -c widget/widget.js | wc -c` ≤ 29696 (29KB) before lazy video, and always ≤ 30720 (30KB). Lazy `widget/video-capture.js` ≤ 8192 gzipped. Mirrors `diff -q widget/widget.js client/public/widget.js` and `widget.css` pass. Verifier `npm test` includes size gate RED test.
- Toolbar: all 12 controls render, 44px hit targets, a11y names/tooltips, focus-visible, movable when obscuring (drag handle or viewport-aware reflow), states coherent at 1280 and 390, no clipping/overflow.
- Permission: workspace entry never calls media; Record click triggers request; denial → Retry/Upload/Cancel; no stuck overlay. Evidence: headed Chrome allow + deny runs.
- Privacy: hints present in code, handle verification present, honest fallback when unverifiable. No system-audio/camera/window/screen accepted. Code review confirms `audio:false` always in `getDisplayMedia`.
- Annotations: hand-drawn marks stored doc-relative; scroll test: annotate element at scrollY=0, scroll 600px, mark scrolls out, scroll back, mark at same place, across at least 2 nested scroll containers. RAF used, undo/redo preserved across scroll.
- Pointer: halo visible on light (#fff) and dark (#0f172a), ripple on click captured in playback video frame; respects `prefers-reduced-motion`.
- Preview: modal accessible (focus trap, title, ESC needs explicit confirm, focus restores to trigger), Record again cleans tracks/blobUrls/timers, Delete needs confirm/undo, responsive 390.
- Backend invariants: 60s/25MB/Range 206 + suffix/strict-range/401 for unauth/404 for non-owner/5-min video quota/1GB per-project/flag OFF/CSP mediaSrc/cleanup every exit — all passing in `server/tests/video.test.ts`.
- Visual: real desktop and 390px screenshots at scrollY=0 and scrolled, text readable, no clipping, annotations attached.
- Evidence chain: exact 40-char SHA, branch, TLS, /health, canary isolated (prod untouched 811qw6y4gh56npcm5hzqblmk), bot review link, CI run link, headed QA screenshots/attachments.

## 15. Rollout / Rollback

Rollout:
1. Land behind `videoCaptureEnabled` OFF (default 0). Widget fetches flag via `GET /api/widget-config?project=` — when OFF chooser stays 2-way (no video).
2. Every code change resets GitHub Actions bot/CI → exact-SHA isolated canary deploy → genuine headed QA (no stale Video 12–15 QA reuse).
3. Promote: after headed Chrome/Edge allow/deny/scroll/pointer/playback + honest Firefox/Safari/mobile fallback all green, `meta-reviewer` leaves PR #46 draft. Merge only on Nik's explicit approval. Never direct-push to default branch. Production Coolify auto-deploys `main` after merge; verify `GET /health`, `/api/health`, `widget.js`/`video-capture.js` assets, gzip budgets.

Rollback:
- Flag toggle per project `UPDATE projects SET videoCaptureEnabled=0` (or dashboard). Immediate chooser revert.
- Code rollback: `git fetch origin && git rev-parse origin/main` captured immediately before merge as rollback SHA (record in PR description); redeploy that SHA via Coolify. New columns are nullable — old code leaves them inert, files remain on disk and reappear on re-deploy. No data loss.
- Storage trigger: flag OFF gates new uploads; existing files kept; quota logs at 75% warning.

## 16. Bite-Sized TDD Implementation Plan (exact files / commands after source inspection)

Each task = 2–5 min, RED-GREEN-REFACTOR, commit per task. Use `python3 -c "open(path,'wb').write(content.encode())"` if `process.env` masking hits write_file.

### T1 — Spike: prove Ybug prompt path on canary
Files: `docs/spike/2026-09-15-viewport-vs-displaymedia.md` (new), `tmp_spike.html` ephemeral
Steps: create minimal canary page that logs `typeof navigator.mediaDevices.getViewportMedia` and `getSettings().displaySurface` + `getCaptureHandle()`. Deploy to canary env, capture headed Chrome prompt screenshot. Document verdict. Acceptance: verdict written and cited in PRD privacy contract.
Verify: headed Chrome screenshot of prompt + dump file attached to PR.

### T2 — Shared workspace scaffolding (no capture yet)
Files: `widget/widget.js:1180–1450` (annotation engine), `widget/widget.css:95–160` (annotate styles)
Steps: introduce `openCaptureWorkspace(mode)` that reuses annotation editor as live overlay (not snapshot raster). Keep toolbar templates (`#bugaputa-annotate`, `#bugaputa-ann-toolbar`) but mount against live DOM, not `frame.srcdoc`. Add workspace flag `isRecording:false`. Tests: add `client/src/__tests__/capture-annotate-workspace.test.ts` that fakes open workspace and asserts toolbar renders.
Verify: `npm --workspace=client run test -- --reporter=verbose` pass, no widget size breach.
Commit: `feat(video): shared capture workspace scaffolding`

### T3 — Toolbar contract (record/countdown/timer/stop/mic/tools/a11y/movable)
Files: `widget/widget.js:1200–1350` (toolbar), `widget/widget.css` (toolbar responsive + movable)
Steps: render toolbar with all 12 controls, 44px, aria-label/tooltip, active/disabled states. Make toolbar movable via drag handle (pointer capture, clamp to viewport, store offset). Add mic toggle OFF default with explicit text/tooltip.
Verify: mocked toolbar test asserts all buttons exist + 44px + focus-visible; manual 390px clip check.
Commit: `feat(video): recording toolbar contract`

### T4 — Privacy contract: getViewportMedia preferred else strong-hint getDisplayMedia + handle validation + honest fallback
Files: `widget/video-capture.js:5–69` (session), `widget/widget.js:271–410` (pane lifecycle)
Steps: implement `chooseCaptureStream()` — try `getViewportMedia` if available, else `getDisplayMedia` with hints object from §5, then validate `displaySurface` + captureHandle. On fail → `onUnsupported`. Never set `audio:true` in getDisplayMedia. Add feature-detect helper `isVideoSupported()` update.
Verify: server-less unit test with mocked media that asserts hints object contains required keys and that non-browser surface triggers unsupported.
Commit: `feat(video): privacy-contract capture path`

### T5 — Microphone semantics (separate getUserMedia only on opt-in, recoverable)
Files: `widget/video-capture.js:45–61` (mic branch)
Steps: keep existing mic-opt-in merge path; ensure `audio:false` always in display path; on mic denial cleanup tracks + offer Retry/Continue without mic. Add test for continue-without-mic starts recording.
Verify: `client/src/__tests__/video-mic-semantics.test.ts` still pass with new path.
Commit: `feat(video): keep mic OFF default with recoverable denial`

### T6 — Annotation coordinate model (document-relative, scroll compensation, nested scroll, undo preserved)
Files: `widget/widget.js:1450–1750` (cssPoint, renderAll, scroll handlers)
Steps: switch storage to document coords, vector layer document-sized, RAF render, scroll listeners + ResizeObserver, nested container handling. Preserve `pushUndo`/`doUndo`/`doRedo`.
Verify: add `client/src/__tests__/annotation-scroll-attach.test.ts` — simulate scroll 600px, assert annotation bounds move out/back within 1px. Run desktop+390 manual scroll proof later.
Commit: `feat(video): document-relative annotation layer`

### T7 — Pointer emphasis (halo + ripple, reduced-motion, captured pixels)
Files: `widget/widget.css` (halo styles), `widget/widget.js:1300–1400` (pointer layer)
Steps: add `pointer-events:none` halo element tracking `pointermove` via RAF, click ripple child, `prefers-reduced-motion` media query, toggle button `aria-pressed`. Ensure layer inside captured viewport.
Verify: mocked pointer test asserts halo follows + ripple appended + not intercepting clicks.
Commit: `feat(video): pointer halo and ripple`

### T8 — Interaction model + termination hardening (pointer vs draw, wheel preserved, all stop/crash paths to preview/recovery)
Files: `widget/widget.js:360–520` (interaction + cleanup), `widget/video-capture.js:17–44` (track onended, timer, size guard)
Steps: pointer mode → page gets events; drawing modes → canvas captures. Wire `track.onended`, `visibilitychange`, `beforeunload`, navigation, size>25MB, error → cleanup + preview/recovery. Never silent loss.
Verify: unit tests for each trigger; headed QA later for real track end.
Commit: `feat(video): interaction model and termination hardening`

### T9 — Preview/retry modal (polished, accessible, responsive, cleanup on Record again)
Files: `widget/widget.js:307–360` (preview rendering), `widget/widget.css` (modal styles)
Steps: replace inline preview with modal (title, `<video controls>`, duration/size, Record again/Delete with confirm/undo, Use recording/Continue). Focus trap, ESC policy, fixed actions, desktop/390, loading/error. Record again revokes old blobUrl/timers/tracks.
Verify: a11y focus/ESC tests; mocked preview flow test.
Commit: `feat(video): polished preview modal`

### T10 — Submission wiring (reuse backend, size/mime checks client-side, keep honeypot/flag/cleanup)
Files: `widget/widget.js:421–520` (showForm submit), mirror `client/public/widget.js`
Steps: ensure `hasAttachment()` and `fileInput` path covers `pendingVideoFile`; `FormData.append('video')` path; keep backend invariants untouched. Mirror files.
Verify: `diff -q widget/widget.js client/public/widget.js` ok + `gzip -c widget/widget.js | wc -c` ≤30720.
Commit: `feat(video): wire preview to submission`

### T11 — Backend audit (no rewrite unless conflict)
Files: `server/src/routes/reports.ts`, `server/src/lib/video.ts`, `server/tests/video.test.ts`
Steps: audit retained backend against v2 contract (hints/handle are frontend-only, backend already excludes system audio via frontend `audio:false` guarantee + size/mime/duration/quota/Range). If no conflict, add no code — just run `npm --workspace=server run test -- --reporter=verbose` green as evidence. If gap found, patch minimal.
Verify: server tests green.
Commit: `chore(video): backend reuse audit — no contract conflict` (or fix commit if needed)

### T12 — Mirror/size gate + regression
Files: `client/src/__tests__/widget-mirror-and-size.test.ts`, `widget/widget.js`, `client/public/*`
Steps: enforce `gzip -c widget/widget.js | wc -c ≤30720` and `widget.css` mirror; run `npm run build` (tsc + vite).
Verify: `npm test && npm run build` pass.
Commit: `test(video): mirror and size gate`

### Commands (run from repo root or worktree)
| Command | Expected |
|---------|----------|
| `npm --workspace=server run test -- --reporter=verbose` | server suites pass including video/flag |
| `npm --workspace=client run test -- --reporter=verbose` | client suites pass including new workspace/scroll/pointer tests |
| `npm test` | both workspaces pass |
| `npm run build` | `server/dist/index.js` + `client/dist` ok |
| `diff -q widget/widget.js client/public/widget.js && echo ok` | ok |
| `gzip -c widget/widget.js \| wc -c` | ≤30720 (target ≤29696 for headroom) |
| `gzip -c widget/video-capture.js \| wc -c` | ≤8192 |
| Headed QA (Chrome/Edge allow+deny + scroll + pointer + playback; Firefox/Safari/mobile honest fallback) | all recovered, no broad capture, screenshots at 1280+390 scrollY=0/scrolled |

---

*Plan ready — decompose into kanban graph: (A) frontend capture/annotation/pointer (meta-frontend), (B) backend audit (meta-backend, omit if none but keep audit), (C) review/fix/push to PR #46, (D) bot+CI, (E) exact-SHA canary, (F) headed QA, (G) merge gate (no merge without Nik). Every code change resets D→E→F.*

