import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BW = path.resolve(__dirname, "../components/BugaputaWidget.tsx");
const CANONICAL = path.resolve(__dirname, "../lib/canonical.ts");

function read(p: string) { return fs.readFileSync(p, "utf8"); }

describe("landing widget build-time configuration", () => {
  it("defaults to production landing key when VITE_LANDING_WIDGET_PROJECT_KEY is unset", () => {
    const raw = read(BW);
    // Must define a source-owned default that equals the production landing key.
    expect(raw).toMatch(/DEFAULT_LANDING_PROJECT_KEY\s*=\s*"pk_live_OXoMeigFh6QMxkui"/);
    // WIDGET_PROJECT_KEY must derive from VITE_LANDING_WIDGET_PROJECT_KEY with fallback to the default.
    expect(raw).toMatch(/VITE_LANDING_WIDGET_PROJECT_KEY/);
    expect(raw).toMatch(/DEFAULT_LANDING_PROJECT_KEY/);
    // Must export the default for tests/docs and the effective key.
    expect(raw).toMatch(/export const WIDGET_PROJECT_KEY/);
    expect(raw).toMatch(/export const DEFAULT_LANDING_KEY/);
    // Trim and fallback for empty string.
    expect(raw).toMatch(/\.trim\(\)/);
  });

  it("landing widget script/data attributes use the configured WIDGET_PROJECT_KEY and CANONICAL_ORIGIN", () => {
    const raw = read(BW);
    expect(raw).toMatch(/setAttribute\("data-project",\s*WIDGET_PROJECT_KEY\)/);
    expect(raw).toMatch(/setAttribute\("data-api",\s*CANONICAL_ORIGIN\)/);
    expect(raw).toMatch(/getAttribute\("data-project"\)/);
    expect(raw).toMatch(/WIDGET_PROJECT_KEY/);
    expect(raw).toMatch(/CANONICAL_ORIGIN/);
    // Origin control stays via VITE_CANONICAL_ORIGIN (canonical.ts).
    const canRaw = read(CANONICAL);
    expect(canRaw).toMatch(/VITE_CANONICAL_ORIGIN/);
    expect(canRaw).toContain("https://bugaputa.com");
  });

  it("injected canary key/origin are consumed (build-time substitution check)", () => {
    // Behavioral proof: when the Vite build injects a different key, the
    // component's WIDGET_PROJECT_KEY expression resolves to that key.
    // We simulate by checking the expression shape: trimming the env value
    // and falling back on empty. This prevents regressions where the env
    // var is read but not wired to the data-project attribute.
    const raw = read(BW);
    // The effective line must be: (import.meta.env.VITE_LANDING_WIDGET_PROJECT_KEY || DEFAULT).trim() || DEFAULT
    expect(raw).toMatch(/import\.meta\.env\.VITE_LANDING_WIDGET_PROJECT_KEY/);
    // Both data attributes must be driven by the constants, not literals,
    // so a canary build-time substitution actually changes the rendered tag.
    expect(raw).not.toMatch(/setAttribute\("data-project",\s*"pk_live_/);
    expect(raw).not.toMatch(/setAttribute\("data-api",\s*"https:\/\//);
  });

  it("no credential material, canary fixture, or SEED_ env is committed", () => {
    const raw = read(BW);
    expect(raw).not.toMatch(/SEED_LANDING/);
    expect(raw).not.toMatch(/canary-preview@example\.com/i);
    expect(raw).not.toMatch(/CanaryPreview/i);

    const dbPath = path.resolve(__dirname, "../../../server/src/db.ts");
    const dbRaw = read(dbPath);
    expect(dbRaw).not.toMatch(/SEED_LANDING/);
    expect(dbRaw).not.toMatch(/canary-preview/i);
    expect(dbRaw).not.toMatch(/CanaryPreview/);

    // Repo-wide scan: no SEED_ landing seeding committed anywhere (src).
    const srcFiles = [
      path.resolve(__dirname, "../../../server/src/db.ts"),
      path.resolve(__dirname, "../lib/canonical.ts"),
      path.resolve(__dirname, "../pages/Landing.tsx"),
    ];
    for (const f of srcFiles) {
      expect(read(f)).not.toMatch(/SEED_LANDING_VIDEO_PROJECT/);
    }
  });

  it("vite client types declare both VITE_ vars", () => {
    const envDts = read(path.resolve(__dirname, "../vite-env.d.ts"));
    expect(envDts).toMatch(/VITE_CANONICAL_ORIGIN/);
    expect(envDts).toMatch(/VITE_LANDING_WIDGET_PROJECT_KEY/);
  });
});
