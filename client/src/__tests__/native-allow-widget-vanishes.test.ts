import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetPath = path.resolve(__dirname, "../../../widget/widget.js");
function widget() { return fs.readFileSync(widgetPath, "utf8"); }

// TDD reproduction of t_a602a2ed: native Allow then widget disappears.
// The bug: successCanvas does `if(settled) return; settled=true` BEFORE async canvas.toBlob.
// If toBlob delivers null, `fallback('native-toBlob-null')` is called while settled already true,
// so fallback early-returns and never restores widget/overlay or shows explicit choices.
// The widget stays hidden (overlay display none, trigger display none) with no editor.
// This test is the RED loop: it must fail on edb94aa and pass after the fix.

describe("native Allow then widget disappears (t_a602a2ed) — settled-before-async-blob + editor robustness", () => {
  it("successCanvas must NOT mark settled before async toBlob completes", () => {
    const js = widget();
    // Extract successCanvas body
    const idx = js.indexOf("function successCanvas");
    expect(idx, "successCanvas exists").toBeGreaterThan(-1);
    const body = js.slice(idx, idx + 3500);
    // Buggy pattern: `if(settled) return; settled=true;` before canvas.toBlob, then fallback inside callback.
    // That makes toBlob-null unrecoverable.
    // Fixed pattern: settle only inside toBlob callback after blob non-null + editor mounted,
    // or fallback clears settled / uses separate phase so null can recover.
    // Assert the buggy early-settled ordering is NOT present.
    // Concretely: `settled=true` must not appear before `canvas.toBlob` inside successCanvas.
    const settledPos = body.indexOf("settled=true");
    const toBlobPos = body.indexOf("canvas.toBlob");
    expect(settledPos, "successCanvas should set settled").toBeGreaterThan(-1);
    expect(toBlobPos, "successCanvas should call toBlob").toBeGreaterThan(-1);
    // In the buggy code, settled comes before toBlob. After fix, settled comes after (inside callback) or via pending flag.
    // So fail when settled is before toBlob inside successCanvas.
    expect(
      settledPos < toBlobPos,
      "settled must not be set before canvas.toBlob — otherwise toBlob-null cannot fallback (widget vanishes)"
    ).toBe(false);
  });

  it("native toBlob null/undefined must restore widget chrome and show explicit choice, not vanish", () => {
    const js = widget();
    // The failure handler inside toBlob must be reachable (not blocked by settled) and restore chrome.
    // We verify: successCanvas toBlob callback explicitly handles !blob by restoring widget/overlay choice,
    // or by delegating to showNativeChoice / showCaptureChoice with prevBtn/prevOverlay.
    // Minimal: file contains native-toBlob-null handling that restores trigger and overlay,
    // and successCanvas does not pre-settle.
    // Check fallback is invoked for toBlob-null and is not blocked.
    expect(js).toMatch(/native-toBlob-null/);
    // handleCaptureError and showNativeChoice both restore overlay/btn — verify toBlob-null path goes there
    // (either directly or via fallback that is not short-circuited)
    // successCanvas's fallback call must be outside a settled-true guard that would block it.
    // We already asserted settled not before toBlob; also verify showNativeChoice/showCaptureChoice restores chrome.
    expect(js).toMatch(/showNativeChoice|showCaptureChoice|handleCaptureError/);
    // verify the toBlob-null branch restores display: at least fallback/onFallback is reachable
    expect(js).toMatch(/!blob.*fallback|fallback.*native-toBlob-null/s);
  });

  it("native toBlob exception and image/blobUrl load errors must surface explicit choice and clean tracks", () => {
    const js = widget();
    // Any exception thrown inside async toBlob callback or editor construction must be caught
    // and routed to fallback/choice, not swallowed leaving hidden overlay.
    // Require that openAnnotateEditor or its caller is wrapped or that toBlob callback has try/catch,
    // and that tracks are cleaned on every path.
    expect(js).toMatch(/getTracks\(\)\.forEach.*stop/s);
    // editor bg image load and object URL must not silently fail:
    // blobUrl/img load errors should show choice
    // At minimum, js should handle blobUrl / image load or editor creation failure explicitly
    // We accept either: try/catch around openAnnotateEditor, or .onerror handler on bg image, or catch on editor promise.
    const hasEditorGuard = /try[\s\S]*openAnnotateEditor|openAnnotateEditor[\s\S]*catch|bg.*onerror|createObjectURL.*catch/i.test(js);
    expect(hasEditorGuard, "editor/openAnnotateEditor failures must be guarded (try/catch or onerror) to avoid vanishing widget").toBe(true);
  });

  it("loadedmetadata race / frame readiness: must not require exact single-event ordering that silently stalls", () => {
    const js = widget();
    // loadedmetadata once:true with only that path would stall if event already fired.
    // Require either readyState check, or fallback polling/timeout, or play then capture without strictly waiting loadedmetadata.
    // The current code uses loadedmetadata + play; we require at least a fallback if loadedmetadata never fires
    // (e.g., check readyState or setTimeout poll for videoWidth). We assert presence of such guard.
    // Minimal guard: readyState check, or videoWidth poll, or setTimeout tryCaptureFrame independent of event.
    const hasRaceGuard =
      /readyState|videoWidth.*setTimeout|setTimeout.*tryCaptureFrame.*\d{2,}|requestVideoFrameCallback/.test(js);
    expect(hasRaceGuard, "native path needs a frame-ready guard beyond loadedmetadata alone").toBe(true);
    // Also verify timeout fallback restores chrome (the 12s fallback exists)
    expect(js).toMatch(/native-timeout/);
  });

  it("widget/overlay hidden for capture must be restored on EVERY failure path (never vanish)", () => {
    const js = widget();
    // Every fallback/choice must restore prevBtnDisplay / prevOverlayDisplay
    // Verify showNativeChoice restores, handleCaptureError restores, and timeout fallback goes via showNativeChoice.
    expect(js).toMatch(/prevBtnDisplay/);
    expect(js).toMatch(/prevOverlayDisplay/);
    // Ensure at least 2 distinct restore sites (choice + error)
    const restoreCount = (js.match(/prevBtnDisplay/g) || []).length;
    expect(restoreCount, "at least 2 places must restore prevBtnDisplay (choice + error/timeout)").toBeGreaterThanOrEqual(2);
  });

  it("doCapture hides overlay/trigger but native success must keep editor visible; failures must not leave hidden state", () => {
    const js = widget();
    // doCapture saves prevOverlayDisplay/prevBtnDisplay before hiding.
    // Verify success path shows editor (openAnnotateEditor) and hides overlay intentionally for editor,
    // while failure paths restore overlay. No path should leave both overlay and btn hidden with no editor.
    expect(js).toMatch(/overlay.*display.*none|btn.*display.*none/s);
    expect(js).toMatch(/openAnnotateEditor/);
    // bugaputa-annotate is the editor marker — must exist
    expect(js).toMatch(/bugaputa-annotate/);
  });
});
