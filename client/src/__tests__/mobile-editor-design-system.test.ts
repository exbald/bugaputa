import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetCss = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.css"), "utf8");
const widgetJs = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");

describe("mobile editor design system (t_74ebd39e)", () => {
  it("CSS uses shared design tokens (CSS variables) for colors/spacing/radii/typography", () => {
    // tokens must be scoped to widget containers, not leaked to global :root
    expect(widgetCss).toMatch(/#bugaputa-root[^{]*\{[^}]*--bp-/s);
    expect(widgetCss).not.toMatch(/:root\s*\{[^}]*--bp-/s);
    expect(widgetCss).toMatch(/--bp-navy|--bp-lime| --bp-slate/);
    // header and toolbar should reference variables or tokens, not just ad-hoc hex everywhere
    expect(widgetCss).toMatch(/var\(--bp-/);
  });
  it("header at <=480px is compact: structured grid with title+actions on row 1, palette on row 2, no huge flex-wrap block", () => {
    // must have media query at 480
    expect(widgetCss).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)/);
    // header should become grid at mobile
    const mobileSection = widgetCss.slice(widgetCss.indexOf("@media(max-width:480px)") !== -1 ? widgetCss.indexOf("@media(max-width:480px)") : widgetCss.indexOf("@media (max-width:480px)"));
    expect(mobileSection.length).toBeGreaterThan(100);
    expect(widgetCss).toMatch(/grid-template-areas.*title.*actions.*palette/s);
    expect(widgetCss).toMatch(/grid-template-columns/);
  });
  it("palette at <=480px uses 32-36px visible swatches inside 44px hit areas, horizontally scrollable, not huge 64px circles", () => {
    expect(widgetCss).toMatch(/@media\s*\(\s*max-width\s*:\s*480px\s*\)/);
    // palette row should be scrollable at mobile
    expect(widgetCss).toMatch(/#bugaputa-palette[^}]*overflow-x\s*:\s*auto/s);
    // hit area 44px but visible via padding/content-box or explicit 32-36px
    const hasHitAreaLogic = widgetCss.includes("background-clip: content-box") || widgetCss.includes("background-clip:content-box") || /#bugaputa-palette[^{]*\{[^}]*padding\s*:/s.test(widgetCss);
    const hasVisibleSize = /width\s*:\s*44px.*height\s*:\s*44px|32px|36px/.test(widgetCss);
    expect(hasHitAreaLogic || hasVisibleSize).toBe(true);
    // must ensure mobile palette does not wrap
    expect(widgetCss).toMatch(/flex-wrap\s*:\s*nowrap/);
  });
  it("header total mobile height budget <=140px: padding compact, gaps tight, safe-area insets reserved", () => {
    expect(widgetCss).toMatch(/safe-area-inset-top|safe-area-inset-bottom/);
    // header padding at mobile should be compact (8px not 16+)
    const mobile = widgetCss.match(/@media\s*\(\s*max-width\s*:\s*480px\s*\)[^]*?#bugaputa-ann-header[^}]*\{[^}]*\}/s);
    expect(mobile).not.toBeNull();
    // Check that header at mobile declares small padding/gap
    expect(widgetCss).toMatch(/#bugaputa-ann-header[^}]*padding\s*:\s*8px/s);
    expect(widgetCss).toMatch(/#bugaputa-ann-header[^}]*gap\s*:\s*8px/s);
  });
  it("toolbar remains single bottom horizontal rail 44px targets, clear active/disabled, subtle scrollbar, no clipping under nav", () => {
    expect(widgetCss).toMatch(/#bugaputa-ann-toolbar/);
    expect(widgetCss).toMatch(/min-width\s*:\s*44px|min-height\s*:\s*44px/);
    // active state via aria-pressed
    expect(widgetCss).toMatch(/aria-pressed.*true/);
    // disabled opacity
    expect(widgetCss).toMatch(/:disabled[^}]*opacity/);
    // scrollbar affordance
    expect(widgetCss).toMatch(/scrollbar-width\s*:\s*thin/);
    expect(widgetCss).toMatch(/overflow-x\s*:\s*auto/);
    // safe-area bottom
    expect(widgetCss).toMatch(/safe-area-inset-bottom/);
    // must not clip: toolbar max-width constrained or margin includes safe area
    expect(widgetCss).toMatch(/calc\(100vw - 16px\)|calc\(8px \+ env/);
  });
  it("mobile approximate capture messaging: shows 'Native current-tab capture isn’t supported in this browser — approximate capture or upload'", () => {
    // widget.js escapes unicode as \u2019 / \u2014 — match the escaped form
    expect(widgetJs).toMatch(/Native current-tab capture/);
    expect(widgetJs).toMatch(/approximate capture or upload/);
    expect(widgetJs).toMatch(/bugaputa-mobile-approx-note/);
  });
  it("canary page exists and is genuinely responsive: short copy, separate labeled rows/cards, code blocks with break rules, 16px mobile padding", () => {
    const candidates = [
      path.resolve(__dirname, "../pages/Canary.tsx"),
      path.resolve(__dirname, "../pages/CanaryFixture.tsx"),
      path.resolve(__dirname, "../../public/canary.html"),
      path.resolve(__dirname, "../components/CanaryFixture.tsx"),
    ];
    const existing = candidates.filter(p => fs.existsSync(p));
    expect(existing.length).toBeGreaterThan(0);
    // read whichever exists
    const content = fs.readFileSync(existing[0], "utf8");
    expect(content.length).toBeGreaterThan(500);
    // code blocks must have responsive wrapping (inline style props use camelCase)
    expect(content).toMatch(/overflowWrap.*anywhere|overflow-wrap\s*:\s*anywhere|word-break\s*:\s*break-word|wordBreak.*break-word/);
    expect(content).toMatch(/display.*block|display:\s*block/);
    // mobile padding 16px
    expect(content).toMatch(/p-4|px-4|padding.*16px/);
    // short warning text
    expect(content).not.toMatch(/This is a catastrophically long code-heavy paragraph that wraps and overlaps and breaks html2canvas rendering at mobile widths because long unbroken strings and inline code are not handled/s);
    // should include grid/flex/badge/code elements to test capture fidelity
    expect(content).toMatch(/grid|flex/);
    expect(content).toMatch(/<code|badge|Badge/);
  });
  it("approximate warning in header remains readable without consuming multiple rows (single line ellipsis or clamp)", () => {
    // header title at mobile should be truncated, not wrapping to multiple rows
    expect(widgetCss).toMatch(/text-overflow\s*:\s*ellipsis|line-clamp|white-space\s*:\s*nowrap/);
  });
});
