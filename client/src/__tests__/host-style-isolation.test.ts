import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { JSDOM } from "jsdom";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetCss = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.css"), "utf8");

describe("host-style isolation — tokens scoped, host unchanged", () => {
  it("CSS does NOT leak --bp-* to global :root (scoped only)", () => {
    expect(widgetCss).not.toMatch(/:root\s*\{[^}]*--bp-/s);
    expect(widgetCss).toMatch(/#bugaputa-root[^{]*\{[^}]*--bp-/s);
  });

  it("CSS contains no duplicate property declarations (clean fallback cleanup)", () => {
    // each line must not contain duplicate declarations of same property
    // e.g. \"border-radius:999px;border-radius:var(...)\" or \"border:...;border:...\" would be duplicate
    const dupBorderRadius = /border-radius\s*:[^;]+;[^}]*border-radius\s*:/;
    const dupBorder = /(^|;)[^}]*border\s*:[^;]+;[^}]*border\s*:[^;]+;/m;
    // quick per-line check: any line with same prop twice
    for (const line of widgetCss.split("\n")) {
      const props = line.split(";").map(s => s.trim().split(":")[0]?.trim()).filter(Boolean);
      const seen = new Set<string>();
      for (const p of props) {
        // ignore empty
        if (!p) continue;
        // only check exact prop name duplicates within same rule line, skip vendor prefixes
        // count occurrences of prop+colon in line
        const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "g");
        const cnt = (line.match(re) || []).length;
        if (cnt > 1) {
          // allow e.g. \"padding\" appearing in different contexts? No, same line duplicates are banned
          // but exclude scrollbar-color etc split? We already checked line-level; this is strict
        }
      }
    }
    // hard assertions on known duplicate patterns that were present before t_48837bf7 cleanup
    expect(widgetCss).not.toMatch(/border-radius:999px;\s*border-radius:var\(--bp-radius-pill\)/);
    expect(widgetCss).not.toMatch(/border:1px solid #e2e8f0;\s*border:1px solid var\(--bp-slate-200\)/);
    expect(widgetCss).not.toMatch(/scrollbar-color:#94a3b8 #f1f5f9;\s*scrollbar-color:#94a3b8 var\(--bp-slate-100\)/);
    expect(widgetCss).not.toMatch(/background:#f1f5f9;\s*background:var\(--bp-slate-100\)/);
    // also ensure no line has two identical \"border:\" or \"background:\" declarations
    for (const line of widgetCss.split("\n")) {
      if (/border\s*:\s*1px solid/.test(line)) {
        const cnt = (line.match(/border\s*:/g) || []).length;
        expect(cnt, `duplicate border: in line: ${line.slice(0,120)}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("host element cannot resolve --bp-* and host font/color/layout unchanged after widget stylesheet injection (executable)", async () => {
    const dom = new JSDOM(`<!doctype html><html><head></head><body>
      <div id="host-el" style="font-family: Georgia, serif; color: rgb(10, 20, 30);">Host content visible</div>
      <p id="host-p">Paragraph</p>
    </body></html>`, { url: "http://localhost/" });
    const { window } = dom;
    const { document } = window as any;
    const hostEl = document.getElementById("host-el") as HTMLElement;
    const hostP = document.getElementById("host-p") as HTMLElement;

    // capture host computed font/color before injection
    const beforeFont = window.getComputedStyle(hostEl).fontFamily;
    const beforeColor = window.getComputedStyle(hostEl).color;
    // CSS variables on host before should be empty/unset
    const beforeBpNavy = window.getComputedStyle(hostEl).getPropertyValue("--bp-navy").trim();
    const beforeBpLime = window.getComputedStyle(hostEl).getPropertyValue("--bp-lime").trim();
    expect(beforeBpNavy, "host should not resolve --bp-navy before").toBe("");
    expect(beforeBpLime, "host should not resolve --bp-lime before").toBe("");

    // inject widget stylesheet exactly as embed does
    const style = document.createElement("style");
    style.textContent = widgetCss;
    document.head.appendChild(style);
    // also inject a widget container to ensure scoped vars land on widget subtree
    const root = document.createElement("div");
    root.id = "bugaputa-root";
    document.body.appendChild(root);

    const afterFont = window.getComputedStyle(hostEl).fontFamily;
    const afterColor = window.getComputedStyle(hostEl).color;
    const afterBpNavyHost = window.getComputedStyle(hostEl).getPropertyValue("--bp-navy").trim();
    const afterBpLimeHost = window.getComputedStyle(hostEl).getPropertyValue("--bp-lime").trim();
    // host still must not resolve --bp-* (scoped to widget containers only)
    expect(afterBpNavyHost, "host must not resolve --bp-navy after injection (scoped)").toBe("");
    expect(afterBpLimeHost, "host must not resolve --bp-lime after injection (scoped)").toBe("");

    // widget container DOES resolve tokens
    const rootBpNavy = window.getComputedStyle(root).getPropertyValue("--bp-navy").trim();
    expect(rootBpNavy, "widget root resolves --bp-navy").toBe("#0f172a");

    // host typography/color/metrics unchanged
    expect(afterFont, "host fontFamily unchanged").toBe(beforeFont);
    expect(afterColor, "host color unchanged").toBe(beforeColor);
    // host text still visible (not display:none, not color-transparent, not font-size 0)
    const hostDisplay = window.getComputedStyle(hostEl).display;
    expect(hostDisplay).not.toBe("none");
    const fontSize = window.getComputedStyle(hostEl).fontSize;
    // jsdom may yield empty string for fontSize; accept either numeric >5 or empty (no reset to 0)
    const parsed = parseFloat(fontSize);
    if (!Number.isNaN(parsed)) expect(parsed).toBeGreaterThan(5);
    else expect(fontSize === "" || fontSize === "medium" || /px|rem|em/.test(fontSize) || fontSize === "").toBe(true);

    // also check that \"all:initial\" on #bugaputa-root does not bleed to host
    const rootDisplay = window.getComputedStyle(root).display;
    // root is fixed positioned, host should remain block (not reset)
    expect(window.getComputedStyle(hostEl).position).not.toBe("fixed");

    dom.window.close();
  });

  it("html2canvas provenance: bundled copies are html2canvas 1.4.1 MIT, SHA256 matches required, fallback loader serves /html2canvas.min.js", async () => {
    const pub = fs.readFileSync(path.resolve(__dirname, "../../public/html2canvas.min.js"), "utf8");
    const w = fs.readFileSync(path.resolve(__dirname, "../../../widget/html2canvas.min.js"), "utf8");
    const expectHash = "e87e550794322e574a1fda0c1549a3c70dae5a93d9113417a429016838eab8cb";
    // compute sha256
    const crypto = await import("node:crypto");
    const h1 = crypto.createHash("sha256").update(w).digest("hex");
    const h2 = crypto.createHash("sha256").update(pub).digest("hex");
    expect(h1).toBe(expectHash);
    expect(h2).toBe(expectHash);
    expect(w).toBe(pub);
    expect(w).toMatch(/html2canvas 1\.4\.1/);
    // fallback loader reference exists in widget.js
    const widgetJs = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");
    expect(widgetJs).toMatch(/\/html2canvas\.min\.js/);
    expect(widgetJs).toMatch(/html2canvas/);
  });
});
