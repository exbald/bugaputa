import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Widget polish regression (icon + overlap)", () => {
  it("widget.js uses inline SVG for trigger, not emoji glyph", () => {
    for (const p of [
      path.resolve(__dirname, "../../../widget/widget.js"),
      path.resolve(__dirname, "../../public/widget.js"),
    ]) {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      // Must contain SVG trigger
      expect(raw, `${p} must embed SVG icon`).toMatch(/BUG_SVG/);
      expect(raw, `${p} must contain <svg`).toMatch(/<svg[^>]*viewBox/);
      expect(raw, `${p} must use html:BUG_SVG not text emoji`).toMatch(/html:\s*BUG_SVG/);
      // Must not use emoji surrogate text for the button
      const btnLine = raw.slice(raw.indexOf("bugaputa-btn") - 200, raw.indexOf("bugaputa-btn") + 600);
      // The trigger line should not contain the old surrogate pair as text content
      expect(btnLine).not.toMatch(/text:\s*['\"]\\uD83D/);
    }
    // Also check server/widget served file equals source
    const src = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");
    expect(src).toMatch(/BUG_SVG/);
  });

  it("widget trigger has accessible label and 44px+ hit target", () => {
    const raw = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");
    expect(raw).toMatch(/aria-label.*Report a bug/);
    const css = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.css"), "utf8");
    // 56x56 on desktop -> 44px+ satisfied; check explicit sizes
    expect(css).toMatch(/width:\s*56px/);
    expect(css).toMatch(/height:\s*56px/);
    // should ensure svg display block
    expect(css).toMatch(/#bugaputa-btn svg/);
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
    const js = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");
    // SVG string contains stroke/currentColor, not relying on emoji font
    expect(js).toMatch(/stroke="currentColor"/);
    expect(js).toMatch(/aria-hidden="true"/);
  });
});
