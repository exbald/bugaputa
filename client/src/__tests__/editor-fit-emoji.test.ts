import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WJS = path.resolve(__dirname, "../../../widget/widget.js");
const WCSS = path.resolve(__dirname, "../../../widget/widget.css");
const wjs = fs.readFileSync(WJS, "utf8");
const wcss = fs.readFileSync(WCSS, "utf8");

describe("editor fit/no-scroll + emoji toolbar", () => {
  it("stage has no scrollbars, overflow hidden, flex center, min-height reset", () => {
    expect(wcss).toMatch(/#bugaputa-ann-stage\{[^}]*overflow:\s*hidden/s);
    expect(wcss).toMatch(/#bugaputa-ann-stage\{[^}]*align-items:\s*center/s);
    expect(wcss).toMatch(/#bugaputa-ann-stage\{[^}]*justify-content:\s*center/s);
    expect(wcss).toMatch(/#bugaputa-ann-stage\{[^}]*min-height:\s*0/s);
    expect(wcss).not.toMatch(/#bugaputa-ann-stage\{[^}]*overflow:\s*auto/s);
  });
  it("annotate container prevents page scroll when open", () => {
    expect(wcss).toMatch(/#bugaputa-annotate\{[^}]*overflow:\s*hidden/s);
    expect(wcss).toMatch(/#bugaputa-ann-header\{[^}]*flex-shrink:\s*0/s);
    expect(wjs).toMatch(/document\.body\.style\.overflow\s*=\s*'hidden'/);
  });
  it("wrap is contain-fit, never upscaled, toolbar reserves space (flex child not fixed)", () => {
    expect(wcss).toMatch(/#bugaputa-ann-canvas-wrap\{[^}]*max-width:\s*100%/s);
    expect(wcss).toMatch(/#bugaputa-ann-canvas-wrap\{[^}]*max-height:\s*100%/s);
    expect(wcss).toMatch(/#bugaputa-ann-bg\{[^}]*object-fit:\s*contain/s);
    // toolbar is flex child, not overlay
    expect(wcss).toMatch(/#bugaputa-ann-toolbar\{[^}]*flex-shrink:\s*0/s);
    expect(wcss).not.toMatch(/#bugaputa-ann-toolbar\{[^}]*position:\s*fixed[^}]*bottom:/s);
    // JS fits wrap via applyFit with min(1, ...) never upscale
    expect(wjs).toMatch(/function applyFit/);
    expect(wjs).toMatch(/Math\.min\(1,/);
    expect(wjs).toMatch(/canvasWrap\.style\.width/);
    expect(wjs).toMatch(/ResizeObserver/);
  });
  it("canvas bg and annotation share same fitted bounds; CSS size via 100%", () => {
    expect(wjs).toMatch(/cvs\.style\.width\s*=\s*'100%'/);
    expect(wjs).toMatch(/bgImg\.style\.width\s*=\s*'100%'/);
    expect(wcss).toMatch(/#bugaputa-ann-canvas\{[^}]*inset:\s*0[^}]*width:\s*100%/s);
  });
  it("pointer mapping converts display coords to model via rect scale", () => {
    expect(wjs).toMatch(/capturedDims\.cssW \/ rect\.width/);
    expect(wjs).toMatch(/capturedDims\.cssH \/ rect\.height/);
    expect(wjs).toMatch(/e\.clientX - rect\.left/);
  });
  it("toolbar icons are emoji with emoji font stack and accessible labels", () => {
    expect(wjs).toContain("👆");
    expect(wjs).toContain("✏️");
    expect(wjs).toContain("➡️");
    expect(wjs).toContain("🔲");
    expect(wjs).toContain("🔤");
    expect(wjs).toContain("📌");
    expect(wjs).toContain("↩️");
    expect(wjs).toContain("↪️");
    expect(wjs).toContain("🗑️");
    expect(wjs).toContain("🧹");
    // no legacy text symbols for those roles
    expect(wjs).not.toMatch(/icon:'↖'/);
    expect(wjs).not.toMatch(/icon:'T'/);
    expect(wjs).not.toMatch(/text:'Clear'/);
    expect(wcss).toMatch(/Apple Color Emoji/);
    expect(wcss).toMatch(/Segoe UI Emoji/);
    expect(wcss).toMatch(/Noto Color Emoji/);
    expect(wcss).toMatch(/#bugaputa-ann-toolbar button\{[^}]*font-size:\s*18px/s);
    // 44px targets retained
    expect(wcss).toMatch(/#bugaputa-ann-toolbar button\{[^}]*min-width:\s*44px/s);
    // toolbar buttons have accessible labels (label strings present; aria-label wired via h() )
    expect(wjs).toMatch(/Select \/ move/);
    expect(wjs).toMatch(/Delete selected/);
    expect(wjs).toMatch(/aria-label/);
  });
  it("export remains at original CSS viewport resolution, not display-fit size", () => {
    expect(wjs).toMatch(/capturedDims\.dpr/);
    expect(wjs).toMatch(/out\.width\s*=\s*Math\.round\(cssW\s*\*\s*exportScale\)/);
    expect(wjs).toMatch(/cssW\s*=\s*cvs\.width/);
  });
  it("cleanup removes ResizeObserver and resize listener", () => {
    expect(wjs).toMatch(/_applyFitCleanup/);
    expect(wjs).toMatch(/removeEventListener\('resize', _onWinResize\)/);
    expect(wjs).toMatch(/_ro\.disconnect/);
  });
});
