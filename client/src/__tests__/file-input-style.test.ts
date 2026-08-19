import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cs = (p: string) => fs.readFileSync(p, "utf8");
const WJS = path.resolve(__dirname, "../../../widget/widget.js");
const PJS = path.resolve(__dirname, "../../public/widget.js");
const WCSS = path.resolve(__dirname, "../../../widget/widget.css");
const PCSS = path.resolve(__dirname, "../../public/widget.css");

describe("file input indigo styling + mirror + preserved behaviour", () => {
  it("widget/widget.css and client/public/widget.css are byte-identical", () => {
    expect(cs(WCSS), "widget.css vs public/widget.css").toBe(cs(PCSS));
  });

  it("CSS: #bugaputa-file indigo file-selector-button styling", () => {
    for (const p of [WCSS, PCSS]) {
      const css = cs(p);
      // scoped to #bugaputa-file ::file-selector-button
      expect(css, `${p} ::file-selector-button exists`).toMatch(/#bugaputa-file::file-selector-button/);
      expect(css, `${p} ::-webkit-file-upload-button fallback exists`).toMatch(/#bugaputa-file::-webkit-file-upload-button/);
      // indigo colors
      expect(css, `${p} default indigo #4f46e5`).toMatch(/#4f46e5/);
      expect(css, `${p} hover #4338ca`).toMatch(/#4338ca/);
      expect(css, `${p} active #3730a3`).toMatch(/#3730a3/);
      // button sizing / shape
      expect(css, `${p} border-radius 10px`).toMatch(/border-radius:\s*10px/);
      expect(css, `${p} min-height 44px`).toMatch(/min-height:\s*44px/);
      expect(css, `${p} padding 10px 16px`).toMatch(/padding:\s*10px 16px/);
      expect(css, `${p} margin-right 12px`).toMatch(/margin-right:\s*12px/);
      expect(css, `${p} border none`).toMatch(/border:\s*none/);
      expect(css, `${p} color #fff`).toMatch(/color:\s*#fff/);
      expect(css, `${p} cursor pointer`).toMatch(/cursor:\s*pointer/);
    }
  });

  it("CSS: focus-visible, disabled, overflow handling", () => {
    for (const p of [WCSS, PCSS]) {
      const css = cs(p);
      expect(css, `${p} :focus-visible outline`).toMatch(/#bugaputa-file:focus-visible/);
      expect(css, `${p} outline 2px solid #a3e635`).toMatch(/outline:\s*2px solid #a3e635/);
      expect(css, `${p} outline-offset 2px`).toMatch(/outline-offset:\s*2px/);
      expect(css, `${p} :disabled opacity`).toMatch(/#bugaputa-file:disabled/);
      expect(css, `${p} opacity .5`).toMatch(/opacity:\s*\.5/);
      // input overflow handling for long filenames
      expect(css, `${p} overflow hidden`).toMatch(/#bugaputa-file\{[^}]*overflow:\s*hidden/);
      expect(css, `${p} text-overflow ellipsis`).toMatch(/text-overflow:\s*ellipsis/);
      expect(css, `${p} white-space nowrap`).toMatch(/white-space:\s*nowrap/);
      expect(css, `${p} max-width 100%`).toMatch(/max-width:\s*100%/);
      expect(css, `${p} display block`).toMatch(/#bugaputa-file\{[^}]*display:\s*block/);
      expect(css, `${p} width 100%`).toMatch(/#bugaputa-file\{[^}]*width:\s*100%/);
    }
  });

  it("preserved behaviour: widget.js file handling (5MB, preview, Replace wording, accept)", () => {
    for (const p of [WJS, PJS]) {
      const js = cs(p);
      expect(js, `${p} 5MB size check`).toMatch(/\.size\s*>\s*5\s*\*\s*1024\s*\*\s*1024/);
      expect(js, `${p} File too large message`).toMatch(/File too large \(max 5MB\)/);
      expect(js, `${p} Screenshot preview alt`).toMatch(/Screenshot preview/);
      expect(js, `${p} Replace screenshot wording`).toMatch(/Replace screenshot/);
      expect(js, `${p} pendingAnnotatedFile`).toMatch(/pendingAnnotatedFile/);
      expect(js, `${p} accept image/png`).toMatch(/image\/png/);
      expect(js, `${p} accept image\/jpeg`).toMatch(/image\/jpeg/);
    }
  });
});
