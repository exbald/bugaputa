import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(__dirname, "..");
function collectFiles(dir: string, exts: string[]): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...collectFiles(p, exts));
    else if (exts.some(x => p.endsWith(x))) out.push(p);
  }
  return out;
}
describe("Unicode rendering regression", () => {
  it("no literal \\uXXXX sequences in JSX source", () => {
    const files = collectFiles(srcDir, [".tsx", ".ts"]);
    const bad: string[] = [];
    const re = /\\u[0-9a-fA-F]{4}/g;
    for (const f of files) {
      if (f.includes("__tests__")) continue;
      const raw = fs.readFileSync(f, "utf8");
      const hits = [...raw.matchAll(re)];
      if (hits.length) bad.push(`${path.relative(srcDir,f)}: ${hits.map(h=>h[0]).join(", ")}`);
    }
    expect(bad, `Literal \\uXXXX found — use real Unicode chars. Offenders:\n${bad.join("\n")}`).toEqual([]);
  });
  it("built JS renders real chars not literals (spot-check)", async () => {
    const distDir = path.resolve(srcDir, "../dist/assets");
    if (!fs.existsSync(distDir)) return;
    const jsFiles = fs.readdirSync(distDir).filter(f=>f.endsWith(".js")).map(f=>path.join(distDir,f));
    if (!jsFiles.length) return;
    const js = fs.readFileSync(jsFiles[0], "utf8");
    expect(js).toContain("Visual website feedback");
    expect(js).toContain("See the bug. Get the context. Fix it faster.");
    expect(js).toContain("Bugaputa \u2014 visual website feedback and bug reporting");
    expect(js).toContain("Free up to 50 reports/month \u00b7 No credit card");
    expect(js).toContain("\u00a9 ");
    expect(js).not.toContain("Bugaputa \\u2014");
    expect(js).not.toContain("Lightweight \\u00B7");
  });
  it("email regex accepts standard valid emails", () => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(re.test("exbald@gmail.com")).toBe(true);
    expect(re.test("qa_1755000000000@example.com")).toBe(true);
    expect(re.test("a@b.co")).toBe(true);
    expect(re.test("user+tag@sub.domain.com")).toBe(true);
    expect(re.test("")).toBe(false);
    expect(re.test("no-at")).toBe(false);
    expect(re.test("@missing-local.com")).toBe(false);
  });
});
