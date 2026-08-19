import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetCssPath = path.resolve(__dirname, "../../../widget/widget.css");
const publicCssPath = path.resolve(__dirname, "../../public/widget.css");
const widgetJsPath = path.resolve(__dirname, "../../../widget/widget.js");
const reportDetailPath = path.resolve(__dirname, "../pages/ReportDetail.tsx");

function readCss() { return fs.readFileSync(widgetCssPath, "utf8"); }
function readJs() { return fs.readFileSync(widgetJsPath, "utf8"); }

describe("modal shell: fixed actions, only body scrolls (regression for 1440x765 clipping)", () => {
  it("widget.css: overlay is viewport-bounded and centers modal without itself scrolling", () => {
    const css = readCss();
    // overlay must be fixed inset 0 with flex centering
    expect(css).toMatch(/#bugaputa-overlay\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0/s);
    expect(css).toMatch(/#bugaputa-overlay\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/#bugaputa-overlay\s*\{[^}]*align-items:\s*center/s);
    // overlay must not be the scroller; modal is bounded
    // padding should respect safe-area on mobile
    expect(css).toMatch(/env\(safe-area-inset-/);
  });

  it("widget.css: #bugaputa-modal is a bounded flex column shell (not overflow:auto on the panel)", () => {
    const css = readCss();
    // modal must be flex column, overflow hidden, viewport-bounded
    expect(css).toMatch(/#bugaputa-modal\s*\{[^}]*display:\s*flex/s);
    expect(css).toMatch(/#bugaputa-modal\s*\{[^}]*flex-direction:\s*column/s);
    expect(css).toMatch(/#bugaputa-modal\s*\{[^}]*overflow:\s*hidden/s);
    // must be viewport-bounded (90vh / dvh / calc with viewport units)
    expect(css).toMatch(/#bugaputa-modal\s*\{[^}]*(max-height|height)[^}]*(vh|dvh|svh)/s);
    // must NOT have the old overflow:auto directly on the modal shell
    // (the body is the scroller, not the shell)
    const modalBlock = (css.match(/#bugaputa-modal\s*\{[^}]*\}/s) || [""])[0];
    expect(modalBlock).not.toMatch(/overflow:\s*auto/);
    // shell must allow flex children to shrink
    expect(css).toMatch(/min-height:\s*0/);
  });

  it("widget.css: scroll ownership belongs to a dedicated body region, not the panel or document", () => {
    const css = readCss();
    // must have a body region selector (bugaputa-modal-body or bugaputa-body or similar inside modal)
    const hasBodySel = /#bugaputa-modal-body|#bugaputa-body/.test(css);
    expect(hasBodySel, "expected a dedicated modal body selector like #bugaputa-modal-body").toBe(true);
    // that body must be the scroller: flex:1, min-height:0, overflow:auto, overscroll containment
    expect(css).toMatch(/overflow(-y)?:\s*auto/);
    expect(css).toMatch(/overscroll-behavior/);
    expect(css).toMatch(/flex:\s*1/);
  });

  it("widget.css: footer/actions are non-scrolling, always visible, with divider and safe-area", () => {
    const css = readCss();
    // actions/footer must be non-scrolling: flex-shrink 0
    expect(css).toMatch(/#bugaputa-actions\s*\{[^}]*flex-shrink:\s*0/s);
    // must have a visible top divider/background so footer is distinct from scrolled content
    const hasDivider = /#bugaputa-actions\s*\{[^}]*border-top/.test(css) || /#bugaputa-modal-footer/.test(css);
    expect(hasDivider, "footer must have a top divider/border").toBe(true);
    // safe-area padding for virtual keyboard / notches
    expect(css).toMatch(/env\(safe-area-inset-bottom/);
    // 44px touch targets preserved
    expect(css).toMatch(/min-height:\s*44px/);
  });

  it("widget.js: DOM structure creates a dedicated scrollable body and keeps actions outside it", () => {
    const js = readJs();
    // JS must create a body wrapper element (e.g., bugaputa-modal-body)
    expect(js).toMatch(/bugaputa-modal-body|bugaputa-body/);
    // modal should be created then body appended, then footer/actions conceptually outside body
    // At minimum, form actions must not be the only scroller — body element created before showForm
    expect(js).toMatch(/createElement|h\(.*bugaputa-modal-body/);
    // overlay open should lock body scroll
    expect(js).toMatch(/document\.body\.style\.overflow\s*=\s*['\"]hidden['\"]/);
  });

  it("widget mirrors remain byte-identical", () => {
    const a = fs.readFileSync(widgetCssPath);
    const b = fs.readFileSync(publicCssPath);
    expect(a.equals(b)).toBe(true);
    const ja = fs.readFileSync(widgetJsPath);
    const jb = fs.readFileSync(path.resolve(__dirname, "../../public/widget.js"));
    expect(ja.equals(jb)).toBe(true);
  });

  it("ReportDetail lightbox is viewport-bounded (not taller than viewport at 768x500 / 390x844)", () => {
    const raw = fs.readFileSync(reportDetailPath, "utf8");
    // lightbox is role=dialog fixed inset 0 centered
    expect(raw).toMatch(/role=.dialog/);
    expect(raw).toMatch(/fixed inset-0/);
    // image must be constrained to viewport height (max-h with vh/dvh or 90vh)
    const hasViewportBound = /max-h-\[90vh\]|max-h-\[90dvh\]|max-h-screen|maxHeight|90vh/.test(raw);
    expect(hasViewportBound, "lightbox image must be viewport-bounded").toBe(true);
    // close control must be keyboard reachable and have visible affordance (min size, aria-label)
    expect(raw).toMatch(/aria-label=.Close/);
  });

  it("widget gzip stays under 30KB", async () => {
    const raw = fs.readFileSync(widgetJsPath, "utf8");
    const { gzipSync } = await import("zlib");
    const gz = gzipSync(raw);
    expect(gz.length, `widget gzip ${gz.length} must be < 30000`).toBeLessThan(30 * 1024);
  });
});
