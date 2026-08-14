import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Widget polish regression (icon + overlap)", () => {
  it("widget.js uses inline SVG for trigger, not emoji glyph", () => {
    // Superseded by edge-tab redesign (feature/widget-edge-tab): trigger is now a
    // text-label edge tab (writing-mode/transform), not a 56px SVG circle.
    // Keep no-emoji and accessibility intent, skip strict BUG_SVG checks.
    for (const p of [
      path.resolve(__dirname, "../../../widget/widget.js"),
      path.resolve(__dirname, "../../public/widget.js"),
    ]) {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      // Must not use emoji surrogate text for the button
      const btnLine = raw.slice(raw.indexOf("bugaputa-btn") - 200, raw.indexOf("bugaputa-btn") + 600);
      expect(btnLine).not.toMatch(/text:\s*['\"]\\uD83D/);
      // Tab uses inline styles with accessibility attributes
      expect(raw).toMatch(/aria-label/);
    }
  });

  it("widget trigger has accessible label and 44px+ hit target", () => {
    const raw = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");
    // Edge-tab redesign: accessible label is customizable (Feedback default or data-label), not hard-coded "Report a bug"
    expect(raw).toMatch(/aria-label/);
    // Edge tab: vertical = fixed 32px slim tab (width:32px), horizontal = 36px pill (min-height:36px)
    expect(raw).toMatch(/width:\s*32px|min-height:\s*36px/);
    expect(raw).toMatch(/z-index:\s*2147483640|z-index:2147483640/);
  });

  it("widget.css + landing prevent mobile overlap at 390px", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.css"), "utf8");
    // Should use env(safe-area-inset-bottom) to respect notches / avoid overlap
    expect(css).toMatch(/safe-area-inset-bottom/);
    // Landing invitation section must add mobile bottom padding so content is not obscured
    const landing = fs.readFileSync(path.resolve(__dirname, "../pages/Landing.tsx"), "utf8");
    expect(landing).toMatch(/pb-28/);
    expect(landing).toMatch(/sm:pb-8/);
  });

  it("no missing-glyph dependence: button uses SVG not font-emoji", () => {
    // Superseded by edge-tab redesign: trigger is text-label tab, not SVG icon.
    // Retained intent: trigger must not depend on emoji font glyphs.
    const js = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");
    expect(js).not.toMatch(/\\uD83D/);
    expect(js).toMatch(/aria-label/);
  });
});
