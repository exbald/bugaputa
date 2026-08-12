import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetJs = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");

describe("native capture architecture (TDD guardrails)", () => {
  it("consent copy mentions Current Tab Share + preview + Approximate label", () => {
    expect(widgetJs).toMatch(/Current Tab/);
    expect(widgetJs).toMatch(/Share/);
    expect(widgetJs).toMatch(/preview/i);
    expect(widgetJs).toMatch(/Approximate capture/);
    expect(widgetJs).toMatch(/may differ from screen pixels/);
  });
  it("permission/gesture handling: secureContext, NotAllowedError, AbortError fall back with message", () => {
    expect(widgetJs).toMatch(/isSecureContext/);
    expect(widgetJs).toMatch(/NotAllowedError/);
    expect(widgetJs).toMatch(/Permission denied/);
    expect(widgetJs).toMatch(/AbortError/);
  });
  it("no silent cross-tab capture: selfBrowserSurface include + no displaySurface screen/window fallback", () => {
    expect(widgetJs).toMatch(/selfBrowserSurface.*include/);
    expect(widgetJs).not.toMatch(/displaySurface.*screen/);
    expect(widgetJs).not.toMatch(/displaySurface.*window/);
  });
  it("DPR-aware: caps scale at 2 and validates frame dimensions before drawing", () => {
    expect(widgetJs).toMatch(/Math\.min.*devicePixelRatio.*2/);
    expect(widgetJs).toMatch(/videoWidth.*videoHeight|vW.*vH/);
  });
  it("fallback html2canvas still exists and is triggered after native failure", () => {
    expect(widgetJs).toMatch(/html2canvas/);
    expect(widgetJs).toMatch(/runCaptureFallback/);
    expect(widgetJs).toMatch(/ensureHtml2Canvas/);
  });
  it("explicit choice on denial/mismatch — never silent approximate fallback", () => {
    expect(widgetJs).toMatch(/showNativeChoice/);
    expect(widgetJs).toMatch(/Retry native/);
    expect(widgetJs).toMatch(/Use approximate capture/);
    expect(widgetJs).toMatch(/Upload image/);
    expect(widgetJs).toMatch(/Cancel/);
    // no auto-run of approximate fallback on permission-denied — must go through choice
    expect(widgetJs).toMatch(/showNativeChoice/);
    expect(widgetJs).not.toMatch(/permission-denied.*trying approximate capture/s);
  });
  it("dimension mismatch tightly validated and displaySurface browser enforced", () => {
    expect(widgetJs).toMatch(/native-dimensions-mismatch/);
    expect(widgetJs).toMatch(/displaySurface.*browser/);
    expect(widgetJs).toMatch(/getSettings.*displaySurface/s);
    expect(widgetJs).toMatch(/videoWidth.*videoHeight|vW.*vH/);
    // track cleanup on every path
    expect(widgetJs).toMatch(/getTracks\(\)\.forEach.*stop/s);
    expect(widgetJs).toMatch(/video\.remove/);
  });
  it("editor header shows Approximate warning when fallback used", () => {
    expect(widgetJs).toMatch(/isApprox|approximate/);
    expect(widgetJs).toMatch(/may differ from screen pixels|Approximate capture/);
  });
  it("trigger button restored on close and overlay escapes handled", () => {
    expect(widgetJs).toMatch(/bugaputa-btn/);
    expect(widgetJs).toMatch(/prevBtnDisplay|b\.style\.display/);
    expect(widgetJs).toMatch(/Escape.*requestDiscard|onOverlayEsc/);
  });
});
