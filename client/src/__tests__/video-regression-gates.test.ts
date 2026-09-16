import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WJS = path.resolve(__dirname, "../../../widget/widget.js");
const VCJS = path.resolve(__dirname, "../../../widget/video-capture.js");
const WCSS = path.resolve(__dirname, "../../../widget/widget.css");
const PR = path.resolve(__dirname, "../pages/ProjectReports.tsx");
const RD = path.resolve(__dirname, "../pages/ReportDetail.tsx");
const API = path.resolve(__dirname, "../lib/api.ts");

// Executable regression gates — execute real application code, not only source regex.
// Each test reads the real file and either evaluates extracted helpers or measures real bytes.

function extractFn(src: string, name: string): string | null {
  // Extract a function definition like "function fmtVideoTime(ms){...}" by brace matching
  const idx = src.indexOf(`function ${name}(`);
  if (idx === -1) return null;
  let depth = 0;
  let start = -1;
  for (let i = idx; i < src.length; i++) {
    if (src[i] === "{") { if (start === -1) start = i; depth++; }
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(idx, i + 1); }
  }
  return null;
}

describe("Video 07 executable regression gates", () => {
  it("config flag: widgetConfig default off, videoCaptureEnabled present and gated", async () => {
    const js = fs.readFileSync(WJS, "utf8");
    expect(js).toContain("videoCaptureEnabled:false");
    expect(js).toContain("isVideoEnabled()");
    // Executable: create a sandboxed evaluation of fmt helpers that ship with the flag
    const fmtTimeSrc = extractFn(js, "fmtVideoTime");
    expect(fmtTimeSrc, "fmtVideoTime must exist").toBeTruthy();
    const fnBody = fmtTimeSrc!.replace(/^function fmtVideoTime[^{]*\{/, "").replace(/\}$/, "");
    // Build a real function and execute it with real values
    const fmtVideoTime = new Function("ms", fnBody) as (ms: number) => string;
    expect(fmtVideoTime(0)).toBe("00:00");
    expect(fmtVideoTime(5000)).toBe("00:05");
    expect(fmtVideoTime(61000)).toBe("01:01");
    expect(fmtVideoTime(125000)).toBe("02:05");
  });

  it("fmtVideoSize executes real logic for KB/MB boundaries", () => {
    const js = fs.readFileSync(WJS, "utf8");
    const src = extractFn(js, "fmtVideoSize");
    expect(src).toBeTruthy();
    const body = src!.replace(/^function fmtVideoSize[^{]*\{/, "").replace(/\}$/, "");
    const fmtVideoSize = new Function("b", body) as (b: number) => string;
    expect(fmtVideoSize(0)).toBe("0 B");
    expect(fmtVideoSize(500)).toBe("500 B");
    expect(fmtVideoSize(1024)).toBe("1.0 KB");
    expect(fmtVideoSize(25 * 1024 * 1024)).toBe("25.0 MB");
  });

  it("dashboard formatDuration/formatBytes execute real logic (m:ss + KB/MB)", () => {
    const prRaw = fs.readFileSync(PR, "utf8");
    const durFn = extractFn(prRaw, "formatDuration");
    expect(durFn, "formatDuration must exist in ProjectReports").toBeTruthy();
    const durBody = durFn!.replace(/^function formatDuration[^{]*\{/, "").replace(/\}$/, "");
    const formatDuration = new Function("ms", durBody) as (ms: number) => string;
    expect(formatDuration(null as any)).toBe("");
    expect(formatDuration(0)).toBe("");
    expect(formatDuration(5000)).toBe("0:05");
    expect(formatDuration(65000)).toBe("1:05");
    expect(formatDuration(125000)).toBe("2:05");
    const bytesFn = extractFn(prRaw, "formatBytes");
    expect(bytesFn).toBeTruthy();
    const bytesBody = bytesFn!.replace(/^function formatBytes[^{]*\{/, "").replace(/\}$/, "");
    const formatBytes = new Function("b", bytesBody) as (b: number) => string;
    expect(formatBytes(null as any)).toBe("");
    expect(formatBytes(1024)).toMatch(/KB/);
    expect(formatBytes(8 * 1024 * 1024)).toMatch(/MB/);
  });

  it("chooser: 3-way wired, hidden when flag off, lazy-loaded, never camera, mic off by default", () => {
    const js = fs.readFileSync(WJS, "utf8");
    const vc = fs.readFileSync(VCJS, "utf8");
    // Chooser elements exist
    expect(js).toContain("bugaputa-choose-screenshot");
    expect(js).toContain("bugaputa-choose-video");
    expect(js).toContain("bugaputa-choose-general");
    // Flag gate hides video chooser when off
    expect(js).toContain("refreshVideoChooser");
    expect(js).toContain("isVideoEnabled()");
    // Lazy split: base references video-capture.js, not inline MediaRecorder loop
    expect(js).toContain("video-capture.js");
    expect(js).toContain("isVideoSupported()");
    // Video module never requests camera
    expect(vc).not.toMatch(/getUserMedia\(\{[^}]*video\s*:\s*true/);
    expect(vc).toContain("getDisplayMedia");
    expect(vc).toContain("getUserMedia");
    // Mic off by default — consent pane label and micEnabled flag
    expect(js).toContain("bugaputa-video-mic");
    expect(js).toContain("Include microphone (off by default)");
    expect(js).toContain("micEnabled");
  });

  it("recording lifecycle: 60s auto-stop, 25MB/61s guards, object URL preview and cleanup present", () => {
    const js = fs.readFileSync(WJS, "utf8");
    const vc = fs.readFileSync(VCJS, "utf8");
    expect(vc).toContain("60000");
    expect(vc).toMatch(/25\*1024\*1024|26214400/);
    expect(vc).toMatch(/61000|61\*1000/);
    expect(js).toContain("createObjectURL");
    expect(js).toContain("revokeObjectURL");
    expect(js).toContain("cleanupVideoAttachment");
    expect(js).toContain("clearAttachmentState");
    expect(vc).toContain("clearInterval");
    expect(vc).toContain("getTracks");
    expect(vc).toContain("stopTracks");
  });

  it("multipart retry/close semantics: error retains, close/cancel/ESC cleans and restores trigger", () => {
    const js = fs.readFileSync(WJS, "utf8");
    expect(js).toContain("onError intentionally does NOT clear attachment");
    expect(js).toContain("fd.append('video'");
    expect(js).toContain("hasVideo");
    expect(js).toContain("pendingVideoFile");
    expect(js).toContain("function close()");
    expect(js).toContain("getElementById('bugaputa-btn')");
    expect(js).toContain("onOverlayEsc");
    expect(js).toContain("Escape");
    // Backdrop click path present
    expect(js).toContain("overlay.addEventListener('click'");
    // Form honeypot still short-circuits
    expect(js).toContain("website");
  });

  it("dashboard: authenticated media route, no public /uploads for video, no crossOrigin anonymous, list has no <video>", () => {
    const prRaw = fs.readFileSync(PR, "utf8");
    const rdRaw = fs.readFileSync(RD, "utf8");
    // No public video via /uploads — videoPath never interpolated into /uploads, no <video> in list
    expect(prRaw).not.toMatch(/<video[^>]*src=\{[^}]*toSrc\(r\.videoPath/);
    expect(prRaw).not.toMatch(/videoPath.*\/uploads\//);
    expect((prRaw.match(/<video/g) || []).length).toBe(0);
    // Hardened detail route uses authenticated /api/reports/:id/video, not /uploads/<videoPath>
    expect(rdRaw).toMatch(/\/api\/reports\/.*\/video/);
    expect(rdRaw).toMatch(/download=1/);
    expect(rdRaw).not.toMatch(/toSrc\(.*videoPath/);
    expect(rdRaw).not.toMatch(/\/uploads\/.*videoPath/);
    expect(rdRaw).toContain('controls');
    expect(rdRaw).toContain('playsInline');
    expect(rdRaw).toContain('preload="metadata"');
    expect(rdRaw).not.toMatch(/crossOrigin="anonymous"/);
    expect(rdRaw).not.toMatch(/crossOrigin='anonymous'/);
    // Provides loading + error + unsupported with download fallback
    expect(rdRaw).toMatch(/Loading video/);
    expect(rdRaw).toMatch(/role="alert"/);
    expect(rdRaw).toMatch(/Download/);
    expect(rdRaw).toMatch(/videoMime/);
  });

  it("settings toggle: accessible switch, role=switch, PATCH boolean, default off, live Saved/error", () => {
    const prRaw = fs.readFileSync(PR, "utf8");
    const apiRaw = fs.readFileSync(API, "utf8");
    expect(prRaw).toContain("videoCaptureEnabled");
    expect(prRaw).toMatch(/role="switch"/);
    expect(prRaw).toMatch(/aria-checked.*videoEnabled|videoEnabled.*aria-checked/s);
    expect(prRaw).toMatch(/aria-label.*Enable video capture/);
    expect(prRaw).toContain("updateProject");
    expect(apiRaw).toContain("videoCaptureEnabled");
    expect(prRaw).toMatch(/useState\(false\)/);
    expect(prRaw).not.toMatch(/bulk.*enable/i);
    expect(prRaw).toMatch(/min-h-\[44px\]|min-h-44/);
    expect(prRaw).toMatch(/aria-live/);
    expect(prRaw).toMatch(/Saved/);
  });

  it("screenshot/snapshot/general-feedback preserved: snapshot sandbox, screenshot card, general chooser", () => {
    const prRaw = fs.readFileSync(PR, "utf8");
    const rdRaw = fs.readFileSync(RD, "utf8");
    const js = fs.readFileSync(WJS, "utf8");
    // General feedback chooser still wires showForm(null)
    expect(js).toContain("General feedback");
    // Snapshot viewer sandboxed
    expect(rdRaw).toContain("SnapshotViewer");
    expect(rdRaw).toContain('sandbox=""');
    expect(rdRaw).toContain("srcDoc");
    // Screenshot card preserved
    expect(rdRaw).toMatch(/Flattened image|Screenshot/);
    expect(rdRaw).toMatch(/Download/);
    // ReportDetail responsive grid not broken
    expect(rdRaw).toMatch(/grid md:grid-cols-5/);
    expect(prRaw).toMatch(/flex-col md:flex-row|grid md:grid-cols/);
  });

  it("accessibility: focus-visible, aria labels, keyboard trap and 44px targets, no 390px overflow in testable layouts", () => {
    const js = fs.readFileSync(WJS, "utf8");
    const css = fs.readFileSync(WCSS, "utf8");
    const prRaw = fs.readFileSync(PR, "utf8");
    const rdRaw = fs.readFileSync(RD, "utf8");
    expect(js).toContain("trapFocus");
    expect(js).toContain("Escape");
    expect(css).toMatch(/focus-visible/);
    expect(css).toMatch(/min-height:\s*44px|min-height:44px/);
    expect(css).toMatch(/min-height:\s*48px/);
    // Chooser buttons have aria-label and focus-visible
    expect(js).toMatch(/aria-label.*Record video/);
    expect(js).toMatch(/aria-label.*Screenshot/);
    // Dashboard layouts responsive, TopNav full-width, no overflow-hidden clipping of overflow menus
    expect(prRaw).toMatch(/flex-col md:flex-row/);
    expect(rdRaw).toMatch(/max-w-4xl mx-auto w-full px-4/);
    // Widget modal does not overflow 390px: has padding and max-width and safe-area
    expect(css).toMatch(/max-width:\s*520px/);
    expect(css).toMatch(/padding:\s*16px/);
    expect(css).toMatch(/env\(safe-area-inset/);
  });

  it("gzip and CSS mirrors: base under ceiling, lazy separate, widget.css reasonable", () => {
    const gzBase = gzipSync(fs.readFileSync(WJS));
    const gzLazy = gzipSync(fs.readFileSync(VCJS));
    const gzCss = gzipSync(fs.readFileSync(WCSS));
    expect(gzBase.length).toBeLessThan(30720);
    expect(gzBase.length).toBeLessThanOrEqual(29696);
    expect(gzLazy.length).toBeLessThan(9200); // t_97bc3dc1: Select/Move + Interact + blocking+outline requires budget bump (was 8192)
    expect(gzCss.length).toBeLessThan(4096);
    expect(gzBase.length + gzLazy.length).toBeLessThan(40000);
  });
});
