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
const VCJS = path.resolve(__dirname, "../../../widget/video-capture.js");
const VCP = path.resolve(__dirname, "../../public/video-capture.js");

// T9 mirror/bundle identity + size budget — executable, not source-regex-only:
// reads real files, does byte equality and real gzip.

describe("T9: widget mirrors byte-identical and gzip budget", () => {
  it("widget.js mirror byte-identical", () => {
    const a = fs.readFileSync(WJS);
    const b = fs.readFileSync(PJS);
    expect(a.equals(b), `widget.js mirror mismatch: ${a.length} vs ${b.length}`).toBe(true);
  });

  it("widget.css mirror byte-identical", () => {
    const a = fs.readFileSync(WCSS);
    const b = fs.readFileSync(PCSS);
    expect(a.equals(b), `widget.css mirror mismatch: ${a.length} vs ${b.length}`).toBe(true);
  });

  it("video-capture.js lazy mirror byte-identical", () => {
    const a = fs.readFileSync(VCJS);
    const b = fs.readFileSync(VCP);
    expect(a.equals(b), `video-capture.js mirror mismatch: ${a.length} vs ${b.length}`).toBe(true);
  });

  it("base widget.js gzip <=29696 reclaimed target and <30720 hard ceiling", () => {
    const gz = gzipSync(fs.readFileSync(WJS));
    expect(gz.length, `widget.js gzip ${gz.length} must be <=29696 (video-aware live-workspace stub) (reclaimed)`).toBeLessThanOrEqual(29696);
    expect(gz.length, `widget.js gzip ${gz.length} must be <30720 (ceiling)`).toBeLessThan(30720);
  });

  it("lazy video-capture.js gzip <8192 and stays separate chunk", () => {
    const gzLazy = gzipSync(fs.readFileSync(VCJS));
    expect(gzLazy.length, `video-capture.js gzip ${gzLazy.length} must be <8192`).toBeLessThan(8192);
    // base alone must stay under ceiling; combined is informational only
    const gzBase = gzipSync(fs.readFileSync(WJS));
    const combined = gzBase.length + gzLazy.length;
    expect(gzBase.length).toBeLessThan(30720);
    // informational: log but not gated at 30720+8192
    expect(combined).toBeLessThan(40000);
  });

  it("widget.css gzip reasonable (<4KB)", () => {
    const gz = gzipSync(fs.readFileSync(WCSS));
    expect(gz.length).toBeLessThan(4096);
  });
});
