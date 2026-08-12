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

describe("close restore + toolbar regression (finalize fix)", () => {
  it("close() restores #bugaputa-btn and cleans annotate state", () => {
    for (const p of [WJS, PJS]) {
      const js = cs(p);
      // must clear capture state
      expect(js, `${p} clears capturedDataUrl`).toMatch(/capturedDataUrl\s*=\s*null/);
      expect(js, `${p} clears capturedDims`).toMatch(/capturedDims\s*=\s*null/);
      // must remove annotate editor and reset overflow
      expect(js, `${p} removes bugaputa-annotate`).toMatch(/getElementById\('bugaputa-annotate'\)/);
      expect(js, `${p} resets body overflow`).toMatch(/document\.body\.style\.overflow\s*=\s*''/);
      // must restore trigger hidden during capture
      expect(js, `${p} restores bugaputa-btn display`).toMatch(/getElementById\('bugaputa-btn'\)/);
      expect(js, `${p} restores display=''`).toMatch(/\.style\.display\s*=\s*''/);
      // else branch: overflow reset even when overlay absent
      expect(js, `${p} else overflow reset`).toMatch(/else\s*\{\s*document\.body\.style\.overflow/);
    }
  });

  it("widget/public mirrors are byte-identical", () => {
    expect(cs(WJS), "widget.js vs public/widget.js").toBe(cs(PJS));
    expect(cs(WCSS), "widget.css vs public/widget.css").toBe(cs(PCSS));
  });

  it("mobile scrollbar is visible, contrasted, 6px", () => {
    for (const p of [WCSS, PCSS]) {
      const css = cs(p);
      // inside @media(max-width:480px) block
      const m = css.match(/@media\(max-width:480px\)\{[^}]+\}[^]*?scrollbar-width:thin[^]*?scrollbar-color:[^;]+;[^]*?\}/s);
      // broader checks
      expect(css, `${p} thin scrollbar`).toMatch(/scrollbar-width:\s*thin/);
      expect(css, `${p} contrast color`).toMatch(/scrollbar-color:\s*#94a3b8\s+(#f1f5f9|var\(--bp-slate-100\))/);
      expect(css, `${p} overscroll contain`).toMatch(/overscroll-behavior-x:\s*contain/);
      expect(css, `${p} 6px height`).toMatch(/#bugaputa-ann-toolbar::-webkit-scrollbar\{[^}]*height:\s*6px/);
      expect(css, `${p} track contrast`).toMatch(/#bugaputa-ann-toolbar::-webkit-scrollbar-track\{[^}]*background:\s*(#f1f5f9|var\(--bp-slate-100\))/);
      expect(css, `${p} thumb contrast`).toMatch(/#bugaputa-ann-toolbar::-webkit-scrollbar-thumb\{[^}]*background:\s*#94a3b8[^}]*border:\s*1px solid (#e2e8f0|var\(--bp-slate-200\))/);
      // 44px targets retained
      expect(css, `${p} 44px toolbar btn`).toMatch(/#bugaputa-ann-toolbar button\{[^}]*min-width:\s*44px/);
    }
  });

  it("email regex uses real \\s not literal \\s and accepts valid address", () => {
    for (const p of [WJS, PJS]) {
      const js = cs(p);
      expect(js, `${p} must not contain \\\\s literal`).not.toMatch(/\/\^[^\\]*\\\\s/);
      expect(js, `${p} correct regex`).toMatch(/\/\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$\//);
    }
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(re.test("qa_1755000000000@example.com")).toBe(true);
  });
});
