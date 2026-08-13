import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetJs = path.resolve(__dirname, "../../../widget/widget.js");
const widgetCss = path.resolve(__dirname, "../../../widget/widget.css");
function readJs(){ return fs.readFileSync(widgetJs, "utf8"); }
function readCss(){ return fs.readFileSync(widgetCss, "utf8"); }

describe("capture+annotate chooser/capture/editor flows (widget-local)", () => {
  it("chooser shows Capture vs General with accessible names", () => {
    const js = readJs();
    expect(js).toMatch(/bugaputa-chooser/);
    expect(js).toMatch(/Capture and annotate this page/);
    expect(js).toMatch(/General feedback/);
    expect(js).toMatch(/aria-label.*Capture and annotate/);
    // General keeps one-click flow (showForm)
    expect(js).toMatch(/btnGeneral.*showForm/s);
  });
  it("capture: consent disclosure, DPR handling, data-html2canvas-ignore, tainted fallback", () => {
    const js = readJs();
    expect(js).toMatch(/Before you capture/);
    expect(js).toMatch(/cross-origin iframes/i);
    expect(js).toMatch(/data-html2canvas-ignore/);
    expect(js).toMatch(/devicePixelRatio/);
    expect(js).toMatch(/allowTaint.*false/);
    expect(js).toMatch(/useCORS/);
    expect(js).toMatch(/handleCaptureError/);
    expect(js).toMatch(/Continue with image upload/);
    // recursive capture guard: hide btn + overlay before snapshot
    expect(js).toMatch(/btn\.style\.display.*none/);
    // fallback never blank submit: offer upload instead
    expect(js).toMatch(/toDataURL/);
  });
  it("lazy-load capture/editor deps via dynamic script load only after consent", () => {
    const js = readJs();
    // primary engine (modern-screenshot) and fallback (html2canvas) are both
    // loaded via dynamic script injection inside doCapture, never bundled/imported
    expect(js).toMatch(/loadScript/);
    expect(js).toMatch(/modern-screenshot\.min\.js/);
    expect(js).toMatch(/html2canvas\.min\.js/);
    expect(js).toMatch(/captureLegacy/); // fallback path retained
    expect(js).not.toMatch(/import.*html2canvas/);
    expect(js).not.toMatch(/import.*modern-screenshot/);
  });
  it("annotation editor: tools, palette, undo/redo, delete, color, Done/Cancel, keyboard", () => {
    const js = readJs();
    expect(js).toMatch(/bugaputa-annotate/);
    expect(js).toMatch(/PALETTE/);
    expect(js).toMatch(/undoStack/);
    expect(js).toMatch(/redoStack/);
    expect(js).toMatch(/doUndo/);
    expect(js).toMatch(/doRedo/);
    expect(js).toMatch(/Delete selected|btnDel/);
    expect(js).toMatch(/Clear all/);
    expect(js).toMatch(/aria-pressed/);
    expect(js).toMatch(/minWidth.*44px/);
    // tools: select/pen/arrow/rect/text/pin
    for(const t of ["select","pen","arrow","rect","text","pin"]) expect(js).toContain(`'${t}'`);
    expect(js).toMatch(/Escape.*requestDiscard/);
    expect(js).toMatch(/requestDiscard/);
    expect(js).toMatch(/confirm.*Discard/);
    expect(js).toMatch(/Delete.*Backspace/);
  });
  it("text/pin plain-text, size caps, XSS-safe (prompt + slice + plain fillText)", () => {
    const js = readJs();
    expect(js).toMatch(/plain text only/i);
    expect(js).toMatch(/slice\(0,200\)/);
    expect(js).toMatch(/slice\(0,180\)/);
    expect(js).not.toMatch(/innerHTML.*a\.text/);
    // render uses fillText (plain) not innerHTML
    expect(js).toMatch(/fillText/);
  });
  it("export: flatten to PNG via canvas toBlob, size guard, reuse screenshot field", () => {
    const js = readJs();
    expect(js).toMatch(/toBlob/);
    expect(js).toMatch(/image\/png/);
    expect(js).toMatch(/5\*1024\*1024/);
    expect(js).toMatch(/screenshot/);
    expect(js).toMatch(/pendingAnnotatedFile/);
    expect(js).toMatch(/FormData/);
  });
  it("cleanup: revoke blob URLs, remove listeners, prevent scroll while editing", () => {
    const js = readJs();
    expect(js).toMatch(/revokeObjectURL/);
    expect(js).toMatch(/removeEventListener.*keydown/);
    expect(js).toMatch(/body\.style\.overflow.*hidden/);
    expect(js).toMatch(/touchmove.*prevent/);
    expect(js).toMatch(/focus.*trap|trapFocus|edTrap/);
  });
  it("upload validation: client-side 5MB + mime png/jpeg/webp/gif", () => {
    const js = readJs();
    expect(js).toMatch(/image\/png/);
    expect(js).toMatch(/image\/jpeg/);
    expect(js).toMatch(/image\/webp/);
    expect(js).toMatch(/image\/gif/);
    expect(js).toMatch(/5\*1024\*1024/);
  });
  it("widget.css: bottom pill toolbar responsive at 390px, 44px targets", () => {
    const css = readCss();
    expect(css).toMatch(/#bugaputa-ann-toolbar/);
    expect(css).toMatch(/position:\s*fixed/);
    expect(css).toMatch(/border-radius:\s*999px/);
    expect(css).toMatch(/min-height:\s*44px|min-width:\s*44px/);
    expect(css).toMatch(/max-width:\s*390|@media.*480/);
    expect(css).toMatch(/safe-area-inset-bottom/);
  });
  it("ReportDetail: shows annotated PNG with open full-size + download", () => {
    const rd = fs.readFileSync(path.resolve(__dirname, "../pages/ReportDetail.tsx"), "utf8");
    expect(rd).toMatch(/Open full size/);
    expect(rd).toMatch(/Download/);
    expect(rd).toMatch(/lightbox|aria-modal/);
    expect(rd).toMatch(/screenshotPath/);
  });
});
