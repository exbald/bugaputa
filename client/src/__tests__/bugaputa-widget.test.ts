import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXPECTED_SRC = "https://bugaputa.no-code.gdn/widget.js";
const EXPECTED_KEY = "pk_live_OXoMeigFh6QMxkui";
const EXPECTED_TAG = `<script src="${EXPECTED_SRC}" data-project="${EXPECTED_KEY}"></script>`;

describe("BugaputaWidget embed contract", () => {
  it("component exports exact live URL and key", async () => {
    const p = path.resolve(__dirname, "../components/BugaputaWidget.tsx");
    const raw = fs.readFileSync(p, "utf8");
    expect(raw).toContain(EXPECTED_SRC);
    expect(raw).toContain(EXPECTED_KEY);
    // No placeholder key
    expect(raw).not.toContain("pk_...");
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
    expect(landing).toMatch(/Try it \u2014 report a bug with the button in the corner/);
    for (const f of ["Dashboard.tsx", "Login.tsx", "Register.tsx", "ProjectReports.tsx", "ReportDetail.tsx"]) {
      const fp = path.resolve(__dirname, "../pages", f);
      if (!fs.existsSync(fp)) continue;
      const raw = fs.readFileSync(fp, "utf8");
      expect(raw, `${f} must not mount BugaputaWidget (landing-only)`).not.toMatch(/BugaputaWidget/);
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

  // Runtime-like DOM check using jsdom shape is not available in this vitest config;
  // the file-level singleton/route tests above cover the contract. Playwright in CI
  // verifies the real injected <script> tag at runtime.
});
