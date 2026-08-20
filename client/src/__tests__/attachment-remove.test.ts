import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WJS = path.resolve(__dirname, "../../../widget/widget.js");
const PJS = path.resolve(__dirname, "../../public/widget.js");
const WCSS = path.resolve(__dirname, "../../../widget/widget.css");
const PCSS = path.resolve(__dirname, "../../public/widget.css");
const js = () => fs.readFileSync(WJS, "utf8");
const css = () => fs.readFileSync(WCSS, "utf8");

describe("attachment clear + Remove screenshot control (widget)", () => {
  it("widget mirrors remain byte-identical (js + css)", () => {
    expect(fs.readFileSync(WJS).equals(fs.readFileSync(PJS))).toBe(true);
    expect(fs.readFileSync(WCSS).equals(fs.readFileSync(PCSS))).toBe(true);
  });

  it("gzip budget <30KB", () => {
    const raw = fs.readFileSync(WJS, "utf8");
    const gz = gzipSync(raw);
    expect(gz.length, `gzip ${gz.length} must be < 30720`).toBeLessThan(30720);
  });

  it("helper clearAttachmentState exists and clears every source", () => {
    const j = js();
    expect(j).toMatch(/function clearAttachmentState\(\)/);
    // resets file input value
    expect(j).toMatch(/getElementById\('bugaputa-file'\)[^}]*\.value\s*=\s*''/s);
    // revokes preview._blobUrl and capturedBlobUrl
    expect(j).toMatch(/preview\._blobUrl[^}]*revokeObjectURL/s);
    expect(j).toMatch(/capturedBlobUrl[^}]*revokeObjectURL/s);
    // nulls all captured/pending refs
    for (const name of ["capturedDataUrl","capturedDims","capturedSnapshotHtml","pendingSnapshotFile","pendingAnnotationsFile","pendingAnnotatedFile"]) {
      expect(j, `helper must null ${name}`).toMatch(new RegExp(name + "\\s*=\\s*null"));
    }
    // clears preview children, resets label, hides remove button
    expect(j).toMatch(/getElementById\('bugaputa-preview'\)/);
    expect(j).toMatch(/getElementById\('bugaputa-file-label'\)[^}]*Attach screenshot \(optional\)/s);
    expect(j).toMatch(/getElementById\('bugaputa-remove-screenshot'\)[^}]*display\s*=\s*'none'/s);
  });

  it("close() calls clearAttachmentState (fixes stale pendingAnnotatedFile leak)", () => {
    const j = js();
    expect(j).toMatch(/function close\(\)[^}]*clearAttachmentState\(\)/s);
    expect(j).toMatch(/function clearAttachmentState\(\)[\s\S]{0,900}pendingAnnotatedFile\s*=\s*null/s);
    // avoid double-revoke safety: helper already revokes, close does NOT do a second unconditional revoke of preview._blobUrl outside helper
    // (helper is the single source; counts as 1 preview revoke site inside helper + maybe none else)
  });

  it("open() is defensive (reopen clean even if close missed)", () => {
    const j = js();
    expect(j).toMatch(/function open\(\)[^}]*clearAttachmentState\(\)/s);
  });

  it("failure retention: onError does NOT clear attachment (retry keeps file)", () => {
    const j = js();
    // onError must exist and must NOT call clearAttachmentState
    expect(j).toMatch(/function onError\(/);
    // the comment documenting decision
    expect(j).toMatch(/onError intentionally does NOT clear attachment/);
    // ensure clearAttachmentState not called inside onError body (next 200 chars after function onError)
    const idx = j.indexOf("function onError(");
    const slice = j.slice(idx, idx+600);
    expect(slice).not.toMatch(/clearAttachmentState/);
  });

  it("showForm renders preview area plus remove button with required a11y", () => {
    const j = js();
    expect(j).toMatch(/id:'bugaputa-preview'/);
    expect(j).toMatch(/id:'bugaputa-remove-screenshot'/);
    expect(j).toMatch(/type:'button'/);
    expect(j).toMatch(/aria-label.*Remove screenshot/);
    // inline trash SVG (no emoji)
    expect(j).toMatch(/<svg[^>]*viewBox/);
    expect(j).not.toMatch(/Remove screenshot.*[\u{1F300}-\u{1FAFF}]/u);
    // positioned top-right of preview wrapper (wrapper relative)
    expect(j).toMatch(/preview\.appendChild\(removeBtn\)/);
  });

  it("remove button shown only when attachment exists; toggle on fileInput change", () => {
    const j = js();
    expect(j).toMatch(/function hasAttachment\(\)/);
    expect(j).toMatch(/pendingAnnotatedFile/);
    expect(j).toMatch(/pendingSnapshotFile/);
    expect(j).toMatch(/fileInput\.files/);
    expect(j).toMatch(/function syncRemoveBtn\(\)/);
    expect(j).toMatch(/syncRemoveBtn\(\)/);
  });

  it("remove click revokes URLs, clears every source, resets label, hides, focuses input", () => {
    const j = js();
    expect(j).toMatch(/removeBtn\.addEventListener\('click'/);
    // DRY: remove handler delegates to clearAttachmentState (which revokes + nulls)
    const idx = j.indexOf("removeBtn.addEventListener('click'");
    const slice = j.slice(idx, idx+400);
    expect(slice).toMatch(/clearAttachmentState\(\)/);
    expect(slice).toMatch(/fileInput\.focus\(\)/);
    // helper itself must revoke and clear (checked in helper test, but ensure >=3 sites overall)
    expect((j.match(/revokeObjectURL/g)||[]).length).toBeGreaterThanOrEqual(3);
    expect(j).toMatch(/Attach screenshot \(optional\)/);
    // FormData path after removal must omit screenshot when hasFile null
    expect(j).toMatch(/pendingAnnotatedFile \? pendingAnnotatedFile/);
  });

  it("fileInput change replaces preview, preserves remove button, supports replace-after-remove", () => {
    const j = js();
    expect(j).toMatch(/fileInput\.addEventListener\('change'/);
    // clears pendingAnnotatedFile when new file picked
    expect(j).toMatch(/if\(fileInput\.files\[0\]\) pendingAnnotatedFile=null/);
    // preserve removeBtn across change (not wiped by innerHTML='')
    expect(j).not.toMatch(/preview\.innerHTML\s*=\s*''/);
    expect(j).toMatch(/Array\.from\(preview\.children\)/);
    // re-append removeBtn after preview image
    expect(j).toMatch(/preview\.appendChild\(removeBtn\)/);
    // updates label to Replace when file present
    expect(j).toMatch(/Replace screenshot \(optional\)/);
  });

  it("validation preserved: 5MB + png/jpeg/webp/gif", () => {
    const j = js();
    expect(j).toMatch(/\.size\s*>\s*5\s*\*\s*1024\s*\*\s*1024/);
    expect(j).toMatch(/File too large \(max 5MB\)/);
    expect(j).toMatch(/image\/png/);
    expect(j).toMatch(/image\/jpeg/);
    expect(j).toMatch(/image\/webp/);
    expect(j).toMatch(/image\/gif/);
    expect(j).toMatch(/Invalid file type/);
  });

  it("ObjectURL cleanup: revoke on remove and clear", () => {
    const j = js();
    const revokes = (j.match(/revokeObjectURL/g) || []).length;
    expect(revokes, `expected >=3 revoke sites, got ${revokes}`).toBeGreaterThanOrEqual(3);
    // preview._blobUrl nulled after revoke
    expect(j).toMatch(/preview\._blobUrl\s*=\s*null/);
    expect(j).toMatch(/capturedBlobUrl\s*=\s*null/);
  });

  it("annotation toBlob -> pendingAnnotatedFile flow preserved", () => {
    const j = js();
    expect(j).toMatch(/toBlob/);
    expect(j).toMatch(/pendingAnnotatedFile\s*=\s*new File/);
    expect(j).toMatch(/annotated\.png/);
  });

  it("CSS: preview relative + remove button 44px, hover/active/disabled/focus-visible", () => {
    const c = css();
    expect(c).toMatch(/#bugaputa-preview\s*\{[^}]*position:\s*relative/s);
    expect(c).toMatch(/#bugaputa-remove-screenshot\s*\{/);
    expect(c).toMatch(/#bugaputa-remove-screenshot[^}]*min-width:\s*44px/s);
    expect(c).toMatch(/#bugaputa-remove-screenshot[^}]*min-height:\s*44px/s);
    expect(c).toMatch(/#bugaputa-remove-screenshot\s*\{[^}]*background:\s*#fff/s);
    expect(c).toMatch(/#bugaputa-remove-screenshot\s*\{[^}]*border:\s*1px solid #e2e8f0/s);
    expect(c).toMatch(/#bugaputa-remove-screenshot\s*\{[^}]*border-radius:\s*999px/s);
    expect(c).toMatch(/#bugaputa-remove-screenshot:hover/);
    expect(c).toMatch(/#bugaputa-remove-screenshot:active/);
    expect(c).toMatch(/#bugaputa-remove-screenshot:disabled/);
    expect(c).toMatch(/#bugaputa-remove-screenshot:focus-visible[^}]*outline:\s*2px solid #a3e635/s);
    expect(c).toMatch(/#bugaputa-remove-screenshot:focus-visible[^}]*outline-offset:\s*2px/s);
    expect(c).toMatch(/position:\s*absolute/);
    expect(c).toMatch(/box-shadow:/);
  });
});
