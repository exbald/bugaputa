import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPECTED_SRC = "https://bugaputa.com/widget.js";
const EXPECTED_API = "https://bugaputa.com";
const EXPECTED_KEY = "pk_live_OXoMeigFh6QMxkui";
const EXPECTED_TAG = `<script src="${EXPECTED_SRC}" data-project="${EXPECTED_KEY}" data-api="${EXPECTED_API}"></script>`;

describe("BugaputaWidget embed contract", () => {
  it("component exports exact live URL, key, and api origin (single source)", async () => {
    const p = path.resolve(__dirname, "../components/BugaputaWidget.tsx");
    const raw = fs.readFileSync(p, "utf8");
    expect(raw).toContain(EXPECTED_SRC);
    expect(raw).toContain(EXPECTED_KEY);
    expect(raw).toContain(EXPECTED_API);
    expect(raw).toMatch(/CANONICAL_ORIGIN/);
    expect(raw).toContain("data-api");
    expect(raw).not.toContain("pk_...");
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
      const hasConstant = raw.includes("CANONICAL_ORIGIN");
      const hasLiteral = raw.includes(EXPECTED_API);
      expect(hasConstant || hasLiteral, `${rel} must reference CANONICAL_ORIGIN or origin`).toBe(true);
    }
    for (const rel of ["../pages/Dashboard.tsx", "../pages/ProjectReports.tsx"]) {
      const raw = fs.readFileSync(path.resolve(__dirname, rel), "utf8");
      expect(raw).toMatch(/CANONICAL_ORIGIN/);
    }
    const landingRaw = fs.readFileSync(path.resolve(__dirname, "../pages/Landing.tsx"), "utf8");
    expect(landingRaw).toMatch(/CANONICAL_ORIGIN/);

    const prRaw = fs.readFileSync(path.resolve(__dirname, "../pages/ProjectReports.tsx"), "utf8");
    expect(prRaw).not.toContain("Simplified snippet");

    const readmeRaw = fs.readFileSync(path.resolve(__dirname, "../../../README.md"), "utf8");
    expect(readmeRaw).toContain('data-api="https://bugaputa.com"');
    expect(readmeRaw).toContain('data-project="pk_live_..." data-api');
  });

  it("BugaputaWidget loader sets data-api on both new tag and existing correction path", () => {
    const p = path.resolve(__dirname, "../components/BugaputaWidget.tsx");
    const raw = fs.readFileSync(p, "utf8");
    expect(raw).toMatch(/setAttribute\("data-api"/);
    expect(raw).toMatch(/getAttribute\("data-api"\)/);
    expect(raw).toMatch(/CANONICAL_ORIGIN/);
    expect(raw).toContain('data-api');
  });

  it("component uses singleton injection (querySelector guard before append)", async () => {
    const p = path.resolve(__dirname, "../components/BugaputaWidget.tsx");
    const raw = fs.readFileSync(p, "utf8");
    expect(raw).toMatch(/querySelector/);
    expect(raw).toMatch(/appendChild/);
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
    expect(js).toContain(EXPECTED_API);
    expect(js).toContain("/widget.js");
    expect(js).toContain(EXPECTED_KEY);
    expect(js).toContain("data-api");
  });
});
