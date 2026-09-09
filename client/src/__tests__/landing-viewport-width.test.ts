import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), "utf8");
}

describe("landing viewport-width contract", () => {
  it("does not constrain the document or React root width", () => {
    const css = read("../index.css");

    expect(css).toMatch(/html,\s*body,\s*#root\s*\{[^}]*width:\s*100%/s);
    expect(css).toMatch(/html,\s*body,\s*#root\s*\{[^}]*max-width:\s*none/s);
  });

  it("keeps the landing shell and shared navigation full width", () => {
    const landing = read("../pages/Landing.tsx");
    const layout = read("../components/Layout.tsx");

    expect(landing).toMatch(/min-h-screen w-full flex flex-col/);
    expect(layout).toMatch(/<header className="[^"]*\bw-full\b/);
  });
});