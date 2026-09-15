# Spike — Ybug-style "Allow ... to see this tab?" Proof

**Date:** 2026-09-15
**Canary:** https://canary-native-bugaputa.no-code.gdn (isolated Coolify app, disposable project)
**Branch:** feat/video-capture-feedback-2026-09 @ bc0bd4f

## Question

Which standards path can produce a Ybug-style current-tab-only prompt ("Allow ybug.io to see this tab?") on the isolated canary in headed Chrome/Edge for normal web content?

Candidates:
- `navigator.mediaDevices.getViewportMedia()` — proposed tab-viewport direct capture, no chooser
- `navigator.mediaDevices.getDisplayMedia({ preferCurrentTab:true, selfBrowserSurface:'include', surfaceSwitching:'exclude', monitorTypeSurfaces:'exclude', systemAudio:'exclude', video:{displaySurface:'browser'} })` + `track.getSettings().displaySurface` + `track.getCaptureHandle()` identity check

## Method

Minimal canary page with feature probes:

```js
log('getViewportMedia', typeof navigator.mediaDevices.getViewportMedia);
log('getDisplayMedia', typeof navigator.mediaDevices.getDisplayMedia);
try { log('isTypeSupported vp9', MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')); } catch(e){}
```

On Record click, attempt:
1. If `getViewportMedia` is a function, call `getViewportMedia({video:true})` (or with displaySurface hint) and inspect resulting `stream.getVideoTracks()[0].getSettings().displaySurface`.
2. Else call `getDisplayMedia` with strongest hints listed above, then validate:
   - `track.getSettings().displaySurface === 'browser'`
   - `track.getCaptureHandle()` / `MediaStreamTrack.getCaptureHandle()` matches expected handle for current tab (where supported; expose via `navigator.mediaDevices.getDisplayMedia({preferCurrentTab:true})` + `CaptureHandleConfig` if available)
   - If `getSettings()` lacks displaySurface or handle API absent, treat as unverifiable.

Evidence: screenshot of native prompt + `getSettings()` dump attached to PR.

## Verdict (2026-09-15)

- `getViewportMedia` is **not shipped** in Chrome 120-128 / Edge 120-128 stable for normal web content (origin trial / flag only). `typeof getViewportMedia === 'undefined'` on canary in headed Chrome 128. No direct tab-viewport path available.
- `getDisplayMedia` with `preferCurrentTab:true`, `selfBrowserSurface:'include'`, `surfaceSwitching:'exclude'`, `monitorTypeSurfaces:'exclude'`, `systemAudio:'exclude'`, `video:{displaySurface:'browser'}`, `audio:false` yields a tab-picker that *prefers* current tab but **does not legally constrain** the browser's chooser. Chrome shows "Choose what to share" with Tab / Window / Entire Screen tabs; `displaySurface:'browser'` is a hint.
- After grant, `track.getSettings().displaySurface` is `'browser'` when Tab was chosen, `'window'` / `'monitor'` otherwise. `getCaptureHandle()` is supported in Chrome (returns handle when `captureHandleConfig.exposeOrigin` set on `getDisplayMedia`), but normal web content cannot force inclusion — verification requires `track.getCaptureHandle()` shape (exists in Chrome 120+).
- Where `displaySurface` or Capture Handle is absent/unverifiable (Firefox 128+, Safari 17+, any mobile), we **cannot prove** current-tab-only capture. Conservative path is honest unsupported + file-upload fallback, never silent broad capture.

## Contract encoded in code

`widget/video-capture.js: chooseCaptureStream()` implements:

- try `getViewportMedia` only if `typeof === 'function'` (feature-detect, never mocked as acceptance)
- else `getDisplayMedia` with strongest hints object above (`preferCurrentTab:true`, `selfBrowserSurface:'include'`, `surfaceSwitching:'exclude'`, `monitorTypeSurfaces:'exclude'`, `systemAudio:'exclude'`, `video:{displaySurface:'browser'}`, `audio:false`)
- post-grant validation: `displaySurface === 'browser'` else unsupported; if `getCaptureHandle` available, validate handle origin matches `location.origin` when handle present; if verification impossible, route to unsupported fallback
- Never `audio:true` in `getDisplayMedia`; mic via separate `getUserMedia({audio:true,video:false})` only after explicit opt-in
- Documented in code comment: "getDisplayMedia hints alone cannot legally constrain the browser's chooser; we do not promise more than the browser proves via getSettings + Capture Handle."

Mocked `getDisplayMedia` / fake-ui / synthetic streams are used only in deterministic unit tests, never as headed QA evidence (per plan §13 / §6).

## References

- W3C Screen Capture: https://w3c.github.io/mediacapture-screen-share/
- Capture Handle: https://w3c.github.io/mediator-capture-handle/
- Region Capture / Viewport Capture proposals: https://github.com/w3c/mediacapture-screen-share/issues
