import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetJs = path.resolve(__dirname, "../../../widget/widget.js");
const reportDetail = path.resolve(__dirname, "../pages/ReportDetail.tsx");
const appTs = path.resolve(__dirname, "../../../server/src/app.ts");
function readJs(){ return fs.readFileSync(widgetJs, "utf8"); }

describe("DOM snapshot capture (widget)", () => {
  it("builds a serialized snapshot instead of relying on rasterization", () => {
    const js = readJs();
    expect(js).toMatch(/function buildSnapshotHtml/);
    expect(js).toMatch(/function snapshotCopyState/);
    expect(js).toMatch(/function sanitizeSnapshot/);
    expect(js).toMatch(/function absolutizeSnapshotUrls/);
    expect(js).toMatch(/function inlineSameOriginSheets/);
    expect(js).toMatch(/function anchorSnapshotViewport/);
    expect(js).toMatch(/XMLSerializer/);
  });

  it("reuses the existing fixed/sticky re-anchoring for the snapshot clone", () => {
    const js = readJs();
    expect(js).toMatch(/buildSnapshotHtml[\s\S]{0,900}prepareCaptureFixups/);
    expect(js).toMatch(/buildSnapshotHtml[\s\S]{0,900}applyCloneFixup/);
  });

  it("strips executable and navigational content from the snapshot", () => {
    const js = readJs();
    expect(js).toMatch(/sanitizeSnapshot[\s\S]{0,400}script/);
    expect(js).toMatch(/noscript/);
    expect(js).toMatch(/template/);
    expect(js).toMatch(/meta\[http-equiv="refresh"/);
    expect(js).toMatch(/javascript:/);
    // every inline event handler attribute is removed
    expect(js).toMatch(/indexOf\('on'\)===0/);
  });

  it("redacts secrets and honours the customer masking attribute", () => {
    const js = readJs();
    expect(js).toMatch(/pass\|secret\|token\|card\|cvc\|ssn/i);
    expect(js).toMatch(/XXXXX/);
    expect(js).toMatch(/data-bugaputa-mask/);
    expect(js).toMatch(/cc-/);
    expect(js).toMatch(/password/);
  });

  it("neutralizes embedded frames and preserves canvas pixels", () => {
    const js = readJs();
    expect(js).toMatch(/IFRAME/);
    expect(js).toMatch(/snapshotPlaceholderBox/);
    expect(js).toMatch(/toDataURL/);
  });

  it("inlines images so snapshots survive an opaque-origin sandbox", () => {
    // A sandboxed iframe has an opaque origin, so assets served with
    // Cross-Origin-Resource-Policy: same-origin (or restricted by CSP) fail to load
    // and render as broken images. Inlining removes the network dependency entirely.
    const js = readJs();
    expect(js).toMatch(/function inlineSnapshotResources/);
    expect(js).toMatch(/function fetchAsDataUri/);
    expect(js).toMatch(/readAsDataURL/);
    expect(js).toMatch(/SNAPSHOT_INLINE_BUDGET/);
    expect(js).toMatch(/SNAPSHOT_INLINE_MAX/);
    // css url() references are inlined too, not just <img>
    expect(js).toMatch(/url\\\(/);
    // inlining must never hang the capture
    expect(js).toMatch(/SNAPSHOT_INLINE_MS/);
    expect(js).toMatch(/buildSnapshotHtml[\s\S]{0,1400}inlineSnapshotResources/);
  });

  it("records viewport metadata needed to re-render at capture size", () => {
    const js = readJs();
    expect(js).toMatch(/data-bugaputa-viewport/);
    expect(js).toMatch(/data-bugaputa-dpr/);
    expect(js).toMatch(/data-bugaputa-url/);
  });

  it("renders the editor background in a script-less sandboxed iframe", () => {
    const js = readJs();
    expect(js).toMatch(/bugaputa-ann-frame/);
    expect(js).toMatch(/srcdoc/);
    expect(js).toMatch(/setAttribute\('sandbox',''\)/);
    expect(js).not.toMatch(/allow-scripts/);
    expect(js).not.toMatch(/allow-same-origin/);
    expect(js).toMatch(/pointer-events:none/);
  });

  it("compresses the snapshot when the browser supports it, with a plain fallback", () => {
    const js = readJs();
    expect(js).toMatch(/CompressionStream/);
    expect(js).toMatch(/snapshot\.html\.gz/);
    expect(js).toMatch(/snapshot\.html'/);
    expect(js).not.toMatch(/import .*pako/);
  });

  it("submits snapshot and annotations overlay alongside the flattened image", () => {
    const js = readJs();
    expect(js).toMatch(/fd\.append\('domSnapshot'/);
    expect(js).toMatch(/fd\.append\('annotations'/);
    expect(js).toMatch(/annotations\.png/);
    // a missing rasterized image must not block submission
    expect(js).toMatch(/hasFile \|\| pendingSnapshotFile \|\| pendingAnnotationsFile/);
  });

  it("keeps both rasterizers as fallback artifacts", () => {
    const js = readJs();
    expect(js).toMatch(/modern-screenshot\.min\.js/);
    expect(js).toMatch(/html2canvas\.min\.js/);
    expect(js).toMatch(/captureLegacy/);
  });
});

describe("DOM snapshot viewing (dashboard + server)", () => {
  it("renders snapshots in a sandboxed iframe, never as same-origin HTML", () => {
    const tsx = fs.readFileSync(reportDetail, "utf8");
    expect(tsx).toMatch(/sandbox=""/);
    expect(tsx).not.toMatch(/allow-scripts/);
    expect(tsx).toMatch(/srcDoc/);
    expect(tsx).toMatch(/DecompressionStream/);
    expect(tsx).toMatch(/data-bugaputa-viewport/);
    expect(tsx).toMatch(/annotationsSrc/);
  });

  it("serves stored snapshot artifacts as downloads only", () => {
    const app = fs.readFileSync(appTs, "utf8");
    expect(app).toMatch(/application\/octet-stream/);
    expect(app).toMatch(/Content-Disposition/);
    expect(app).toMatch(/nosniff/);
    expect(app).toMatch(/frameSrc/);
  });
});
