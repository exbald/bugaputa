# Bugaputa product screenshots

Authentic annotated screenshots captured via Playwright against a local copyright-safe demo fixture (Acme Store) using the real Bugaputa widget (`widget/widget.js` + `widget/widget.css`, `modern-screenshot` + `html2canvas` capture engines).

Branch: `feature/landing-redesign-screenshots`
Location: `client/public/landing/screenshots/`
Reference from landing page as `/landing/screenshots/<file>` (Vite serves `client/public/` at `/`).

## Files

| File | Shot | Purpose (brief.md) | Size |
|------|------|-------------------|------|
| `01-widget-idle.png` | 1 Trigger state | Floating Bugaputa button visible on demo page, no overlay | ~46 KB |
| `02-chooser.png` | 1b Chooser | Widget overlay open: "Capture and annotate" vs "General feedback" | ~60 KB |
| `03-capture-consent.png` | 2 Capture — consent | "Before you capture" pane + "Capture this page" CTA | ~65 KB |
| `04-annotate-empty.png` | 2 Capture in progress (editor open) | Full-screen annotation editor over captured page (before drawing) | ~55 KB |
| `05-annotate-done.png` | 3 Annotation in progress + 4 Completed annotated result | Arrow + rectangle + text ("Price overlaps on Safari") drawn on screenshot, Done/Cancel + toolbar visible | ~66 KB |
| `06-report-form.png` | 5 Submitted/dashboard view (form ready) | Report form with annotated preview ready to send — next step after Done | ~86 KB |
| `07-mobile-idle.png` | Bonus — mobile 390x844 | Widget button on same fixture at mobile viewport | ~46 KB |

All PNGs < 400 KB (target met with headroom for srcset/WebP later). To add WebP: `cwebp -q 82 <png> -o <webp>` or `sharp`.

## How captured

Deterministic Playwright flow (see `/tmp/run-screenshots.cjs` for full script):
1. Serve fixture at 127.0.0.1:18666 using http.createServer, html + widget.js/css copied from widget/
2. Chromium with LD_LIBRARY_PATH=/tmp/chrome-libs + FONTCONFIG_FILE=/tmp/fonts-fixed.conf
3. page.goto fixture -> wait for #bugaputa-btn -> click -> #bugaputa-overlay
4. #bugaputa-choose-capture -> capture pane -> #bugaputa-do-capture
5. wait #bugaputa-annotate -> toolbar arrow/rect, pointer drag, text prompt stub -> #bugaputa-ann-done
6. report form appears, screenshots at each stage via page.screenshot()

## Landing usage

```tsx
<img src="/landing/screenshots/01-widget-idle.png" alt="Bugaputa widget button on a demo storefront" loading="lazy" />
<img src="/landing/screenshots/05-annotate-done.png" alt="Annotating a captured page — arrow, rectangle and text on a screenshot" loading="lazy" />
```

Use `loading="lazy"` and consider `srcset` for 2x.

## Regeneration

```bash
node /tmp/run-screenshots.cjs
# outputs to client/public/landing/screenshots/*.png
```
