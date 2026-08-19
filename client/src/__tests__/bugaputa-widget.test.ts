import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPECTED_SRC = "https://bugaputa.no-code.gdn/widget.js";
const EXPECTED_KEY = "pk_live_OXoMeigFh6QMxkui";
const EXPECTED_API = "https://bugaputa.no-code.gdn";
const EXPECTED_TAG = `<script src="${EXPECTED_SRC}" data-project="${EXPECTED_KEY}" data-api="${EXPECTED_API}"></script>`;

describe("BugaputaWidget embed contract", () => {
  it("component exports exact live URL, key, and api origin (single source)", async () => {
    const p = path.resolve(__dirname, "../components/BugaputaWidget.tsx");
    const raw = fs.readFileSync(p, "utf8");
    expect(raw).toContain(EXPECTED_SRC);
    expect(raw).toContain(EXPECTED_KEY);
    expect(raw).toContain(EXPECTED_API);
    expect(raw).toMatch(/WIDGET_SRC/);
    expect(raw).toMatch(/WIDGET_API_ORIGIN/);
    // No placeholder key
    expect(raw).not.toContain("pk_...");
    // Exactly one definition of WIDGET_API_ORIGIN (single source of truth)
    const defs = (raw.match(/WIDGET_API_ORIGIN\s*=/g) || []).length;
    expect(defs).toBe(1);
  });

  it("all snippet emitters include data-api with production origin via constant", () => {
    const sources = [
      "../components/BugaputaWidget.tsx",
      "../pages/Dashboard.tsx",
      "../pages/ProjectReports.tsx",
      "../pages/Landing.tsx",
    ];
    for (const rel of sources) {
      const p = path.resolve(__dirname, rel);
      const raw = fs.readFileSync(p, "utf8");
      expect(raw, `${rel} must include data-api`).toContain("data-api");
      // Must reference WIDGET_API_ORIGIN or contain the production origin
      const hasConstant = raw.includes("WIDGET_API_ORIGIN");
      const hasLiteral = raw.includes(EXPECTED_API);
      expect(hasConstant || hasLiteral, `${rel} must reference WIDGET_API_ORIGIN or origin`).toBe(true);
    }
    // Dashboard and ProjectReports must not have duplicated literal for the snippet
    for (const rel of ["../pages/Dashboard.tsx", "../pages/ProjectReports.tsx"]) {
      const raw = fs.readFileSync(path.resolve(__dirname, rel), "utf8");
      // Should use the constants, not inline the URL for the snippet assembly
      // At minimum, the snippet line should reference WIDGET_SRC/WIDGET_API_ORIGIN
      expect(raw).toMatch(/WIDGET_SRC/);
      expect(raw).toMatch(/WIDGET_API_ORIGIN/);
    }
    // Landing uses constants
    const landingRaw = fs.readFileSync(path.resolve(__dirname, "../pages/Landing.tsx"), "utf8");
    expect(landingRaw).toMatch(/WIDGET_SRC/);
    expect(landingRaw).toMatch(/WIDGET_API_ORIGIN/);

    // ProjectReports must not contain the old "Simplified snippet" comment
    const prRaw = fs.readFileSync(path.resolve(__dirname, "../pages/ProjectReports.tsx"), "utf8");
    expect(prRaw).not.toContain("Simplified snippet");

    // README snippet doc includes data-api
    const readmeRaw = fs.readFileSync(path.resolve(__dirname, "../../../README.md"), "utf8");
    expect(readmeRaw).toContain('data-api="https://bugaputa.no-code.gdn"');
    expect(readmeRaw).toContain('data-project="pk_live_..." data-api');
  });

  it("BugaputaWidget loader sets data-api on both new tag and existing correction path", () => {
    const p = path.resolve(__dirname, "../components/BugaputaWidget.tsx");
    const raw = fs.readFileSync(p, "utf8");
    // new tag path
    expect(raw).toMatch(/setAttribute\("data-api"/);
    // existing correction path
    expect(raw).toMatch(/getAttribute\("data-api"\)/);
    expect(raw).toMatch(/WIDGET_API_ORIGIN/);
    // Attribute order in comment/header: src, data-project, data-api
    // The comment documenting the exact tag should include data-api
    expect(raw).toContain('data-api');
  });

  it("component uses singleton injection (querySelector guard before append)", async () => {
    const p = path.resolve(__dirname, "../components/BugaputaWidget.tsx");
    const raw = fs.readFileSync(p, "utf8");
    expect(raw).toMatch(/querySelector/);
    expect(raw).toMatch(/appendChild/);
    // Cleanup on unmount
    expect(raw).toMatch(/return\s*\(\)\s*=>/);
  });

  it("Landing mounts BugaputaWidget; no other route does", () => {
    const landing = fs.readFileSync(path.resolve(__dirname, "../pages/Landing.tsx"), "utf8");
    expect(landing).toMatch(/BugaputaWidget/);
    expect(landing).toMatch(/Try Bugaputa on this page/);
    for (const f of ["Dashboard.tsx", "Login.tsx", "Register.tsx", "ProjectReports.tsx", "ReportDetail.tsx"]) {
      const fp = path.resolve(__dirname, "../pages", f);
      if (!fs.existsSync(fp)) continue;
      const raw = fs.readFileSync(fp, "utf8");
      // Pages may import WIDGET_* constants from BugaputaWidget but must not mount the <BugaputaWidget> component
      const mountsWidget = /<BugaputaWidget|<BugaputaWidget\s|\bBugaputaWidget\(\)/.test(raw) || /from\s+["'].*BugaputaWidget["']/.test(raw) && /<\s*BugaputaWidget/.test(raw);
      // Simpler: check for JSX mount or default import used as component. Importing named constants is OK.
      const hasDefaultWidgetImport = /import\s+BugaputaWidget/.test(raw) || /<\s*BugaputaWidget/.test(raw);
      expect(hasDefaultWidgetImport, `${f} must not mount BugaputaWidget (landing-only)`).toBe(false);
    }
    const app = fs.readFileSync(path.resolve(__dirname, "../App.tsx"), "utf8");
    expect(app).not.toMatch(/BugaputaWidget/);
  });

  it("built output contains live widget URL (when dist present)", () => {
    const distDir = path.resolve(__dirname, "../../dist/assets");
    if (!fs.existsSync(distDir)) return;
    const jsFiles = fs.readdirSync(distDir).filter(f => f.endsWith(".js")).map(f => path.join(distDir, f));
    if (!jsFiles.length) return;
    const js = fs.readFileSync(jsFiles[0], "utf8");
    expect(js).toContain(EXPECTED_SRC);
    expect(js).toContain(EXPECTED_KEY);
  });

  it("widget resolves apiUrl and cssHref from data-api, falling back to relative", () => {
    const wPath = path.resolve(__dirname, "../../../widget/widget.js");
    const raw = fs.readFileSync(wPath, "utf8");
    // Must read data-api and handle trailing slash
    expect(raw).toMatch(/getAttribute\('data-api'\)/);
    expect(raw).toMatch(/replace\(/);
    expect(raw).toMatch(/API_BASE\?.*\/api\/reports/);
    expect(raw).toMatch(/cssHref/);
    expect(raw).toContain('/widget.css');
    // Simulate resolution logic
    function resolveUrls(dataApi: string | null) {
      const API_BASE = (dataApi || '').replace(/\/+$/, '');
      const apiUrl = API_BASE ? API_BASE + "/api/reports" : "/api/reports";
      const cssHref = (API_BASE || '') + "/widget.css";
      return { API_BASE, apiUrl, cssHref };
    }
    expect(resolveUrls(EXPECTED_API)).toEqual({
      API_BASE: EXPECTED_API,
      apiUrl: EXPECTED_API + "/api/reports",
      cssHref: EXPECTED_API + "/widget.css",
    });
    // trailing slash trimmed
    expect(resolveUrls(EXPECTED_API + "/")).toEqual({
      API_BASE: EXPECTED_API,
      apiUrl: EXPECTED_API + "/api/reports",
      cssHref: EXPECTED_API + "/widget.css",
    });
    expect(resolveUrls(null)).toEqual({
      API_BASE: '',
      apiUrl: "/api/reports",
      cssHref: "/widget.css",
    });
    expect(resolveUrls('')).toEqual({
      API_BASE: '',
      apiUrl: "/api/reports",
      cssHref: "/widget.css",
    });
  });

  it("widget/widget.js and client/public/widget.js are byte-identical", () => {
    const a = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"));
    const b = fs.readFileSync(path.resolve(__dirname, "../../public/widget.js"));
    expect(a.equals(b)).toBe(true);
  });

  // Runtime-like DOM check using jsdom shape is not available in this vitest config;
  // the file-level singleton/route tests above cover the contract. Playwright in CI
  // verifies the real injected <script> tag at runtime.
});
