# Brief — Video Recording Redesign v2 (Re-spec)

**Status:** Re-spec supersedes Video 12–15 path. Draft PR #46 `feat/video-capture-feedback-2026-09` @ `bc0bd4f081c4685aed87ff107d471b86b7a70b27` is prototype only.
**Branch:** `feat/video-capture-feedback-2026-09` (update existing draft PR #46, do not open second PR, do not merge)
**Opt-in:** per-project `videoCaptureEnabled` OFF by default. Production untouched until Nik approves merge.

## Problem
Nik rejected current recorder: it only records video. Ybug reference shows a screenshot-style floating annotation toolbar where annotations move with page scroll, with timer/stop/mic/tools and a polished preview modal (Record again / Delete / Done). Bugaputa's current bare consent-only recorder does not meet that bar and wastes the proven screenshot annotation engine.

## Goal
One shared capture workspace: clicking `Record video` opens the **same** high-quality in-page annotation workspace and visual language as screenshot flow, augmented with recording controls. Annotations drawn during recording are captured in final playback. Pointer is visible. Privacy is current-tab-only or explicit unsupported + upload fallback. Preview is polished and accessible.

## Non-goals
- Camera capture, system/tab audio, whole-screen/window/other-tab capture
- Video editing/trimming/transcription
- Rebuilding already-reviewed backend/storage/API unless contract conflict
- Pixel-copy of Ybug branding/assets/text/code; Ybug is behavioral reference only
- `pnpm`/`yarn`, Next.js, glassmorphism

## Product decisions (verbatim — encode into PRD and every child card)

1. **One shared capture workspace.** Clicking `Record video` opens the same high-quality in-page annotation workspace and visual language as Bugaputa's screenshot flow, augmented with recording controls. It must not open the current bare consent-only recorder. Reuse the existing screenshot annotation engine/components where practical; no parallel, inferior tool implementation.
2. **Toolbar contract.** Compact viewport-fixed floating toolbar, responsive and movable if it obscures content. It exposes Record/3-second countdown/timer/Stop, microphone toggle with explicit text/tooltip and OFF default, pointer/select, freehand pen, arrow, rectangle, text, color, undo/redo, delete/clear, Done/Cancel. Match the screenshot flow's actual supported tools rather than inventing unrelated ones. Every icon has accessible name, tooltip, focus-visible, disabled and active states; 44px hit targets.
3. **Real permission timing.** Entering the workspace does not request capture. Clicking Record is the user gesture that requests permission. Denial/abort restores the toolbar with explicit Retry, Upload video, and Cancel; no stuck overlay or hidden trigger.
4. **Current-tab-only privacy contract.** Never intentionally offer or accept whole-screen, application-window, arbitrary-tab, system-audio, or camera capture. Prefer direct `getViewportMedia()` only where genuinely shipped and compatible; otherwise request self-capture with `getDisplayMedia` using the strongest supported hints (`preferCurrentTab:true`, `selfBrowserSurface:'include'`, `surfaceSwitching:'exclude'`, `monitorTypeSurfaces:'exclude'`, `systemAudio:'exclude'`, video `displaySurface:'browser'`, `audio:false`) and validate the resulting track is a browser surface and the current tab via Capture Handle or another standards-based identity check where supported. If the browser cannot guarantee/verify current-tab self-capture, do not silently fall back to screen/window/other-tab capture—show a clear unsupported state with video-file upload fallback. Document that `getDisplayMedia` hints alone cannot legally constrain the browser's chooser; do not promise more than the browser proves.
5. **Microphone semantics.** Separate `getUserMedia({audio:true,video:false})` only after explicit mic opt-in. Microphone is off by default. System/tab audio is excluded. Camera is never requested. Mic denial is recoverable and stops every acquired track; offer Retry and Continue without microphone.
6. **Annotations while recording.** User can draw and edit during recording. The annotation layer is part of the captured current-tab pixels, so marks and pointer emphasis are visible in final playback. Toolbar may remain viewport-fixed; annotation objects are page/content-relative. A mark around an element must move out with that element when scrolling and return to the same place when scrolling back—never remain stuck at viewport coordinates or drift. Store pointer input in document/container coordinates, render with scroll compensation or a document-sized vector layer, use `requestAnimationFrame`, and define behavior for main-document and nested scroll containers. Preserve undo/redo across scrolling.
7. **Pointer emphasis.** During recording, show a non-blocking high-contrast cursor halo plus brief click ripple, captured in the video. It follows real pointer movement without intercepting page input, respects reduced-motion, remains visible on light/dark backgrounds, and can be toggled if necessary. Playback must visibly show pointer position and clicks.
8. **Interaction model.** Pointer mode allows normal page click/scroll/navigation while recording; drawing modes capture annotation gestures without breaking wheel/trackpad scrolling. Changing URL, closing the captured tab, browser Stop sharing, track ending, max duration, size overflow, or recorder errors must stop cleanly and lead to preview or explicit recovery—never silent loss.
9. **Preview/retry.** After Stop (or track end), show a polished accessible modal with title, video player, duration/size, `Record again`, `Delete recording` (explicit, not unlabeled icon; confirmation or undo), and primary `Use recording`/`Continue`. Responsive desktop/390px layout with fixed actions, loading/error states, focus trap, ESC policy that cannot discard silently, and focus restoration. Record again cleans old streams/blob URLs/timers before returning to workspace.
10. **Limits/backend invariants retained unless the PRD identifies a conflict.** 60-second limit, 25MB cap, owner-authenticated streaming/download with HTTP Range, 5 submissions/min/IP/project, 1GB per-project quota, per-project flag OFF by default, lazy recorder, widget base bundle ≤29KB gzip before lazy video code, repository private, production untouched until approved merge. Reuse already-reviewed backend/storage/API work where it satisfies this contract; do not rewrite it gratuitously.
11. **Browser policy.** Chrome/Edge desktop are the primary exact-current-tab target. Firefox/Safari/mobile must be capability-detected. A browser that cannot provide verifiable current-tab-only capture gets explicit unsupported + upload fallback, not broader capture. No mocked `getDisplayMedia`, fake-ui/auto-accept, Chromium emulation, or synthetic streams may count as final permission acceptance, though deterministic tests may use fakes as regression coverage.
12. **Visual bar.** Ybug is a behavioral benchmark, not a pixel-copy target. Produce a Bugaputa-native, polished overlay/toolbar/preview. Visual acceptance requires real desktop and 390px screenshots at scrollY=0 and nonzero scroll, readable text, no clipping/overflow, coherent states, and annotations visibly remaining attached to content.

## Users
- Reporter (any visitor, no account): chooses Record video from 3-way chooser, annotates while recording, previews, submits with message
- Owner (dashboard): toggles video per project, sees badge/duration, plays/downloads via authenticated Range route

## Success criteria
- Reporter flow <60s on Chrome/Edge desktop, annotations visible in playback, pointer clicks visible
- Deny/abort/silent-loss paths recover with explicit Retry/Upload/Cancel
- Unsupported browser shows honest unsupported + upload fallback, never broad capture
- Base widget ≤29KB gzip (lazy video excluded), preview modal passes a11y focus/ESC checks
- Backend: 25MB/60s/5-min/1GB quota, Range, cleanup on every early exit, no disk leak
- Visual: desktop + 390px at scrollY=0 and scrolled, toolbar readable, no clipping, annotations attached to content

## What PR #46 keeps / replaces / removes
- Keeps: DB columns videoPath/videoMime/videoDurationMs/videoSizeBytes, per-project videoCaptureEnabled flag, widget-config flag fetch, 25MB/60s/size/Range/CSP mediaSrc, video upload validation/magic/duration/quota/cleanup, lazy widget/video-capture split, chooser polish, dashboard badge/player, tests for lifecycle/mic/regression
- Replaces: bare consent-only video pane + isolated MediaRecorder lifecycle → shared annotation workspace + composited recording (annotation layer is captured pixels) + pointer halo; toolbar upgraded to full annotation tools + recording controls; permission hints with strongest hints + Capture Handle validation + honest fallback; preview upgraded to polished modal with Record again/Delete with confirmation
- Removes: standalone bare recorder UI, hidden-trigger/overlay states, any code that accepts system-audio/camera/window/screen without verification, mocked permission acceptance for release evidence

## Evidence required
- Exact-SHA isolated canary (no prod mutation), GitHub Actions bot review + CI on current head, genuine headed Chrome/Edge allow/deny/scroll/pointer/playback QA + Firefox/Safari/mobile honest fallback checks, desktop+390px screenshots at scrollY=0/scrolled
