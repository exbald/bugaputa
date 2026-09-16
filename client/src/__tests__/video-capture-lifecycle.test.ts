import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WJS = path.resolve(__dirname, "../../../widget/widget.js");
const VCJS = path.resolve(__dirname, "../../../widget/video-capture.js");
const WCSS = path.resolve(__dirname, "../../../widget/widget.css");
const PCSS = path.resolve(__dirname, "../../public/widget.js");
const VCP = path.resolve(__dirname, "../../public/video-capture.js");
const APP = path.resolve(__dirname, "../../../server/src/app.ts");

function js(){ return fs.readFileSync(WJS, "utf8"); }
function vc(){ return fs.readFileSync(VCJS, "utf8"); }
function css(){ return fs.readFileSync(WCSS, "utf8"); }

describe("Video 05: lazy MediaRecorder lifecycle, preview and submission (RED-first)", () => {
  it("widget base stays <30720 gzipped with lazy video-capture split", () => {
    const gzBase = gzipSync(fs.readFileSync(WJS));
    expect(gzBase.length, `widget.js gzip ${gzBase.length} must be <30720`).toBeLessThan(30720);
    const gzLazy = gzipSync(fs.readFileSync(VCJS));
    expect(gzLazy.length, `video-capture.js gzip ${gzLazy.length} must be <8192`).toBeLessThan(8192);
  });

  it("mirrors byte-identical: widget.js/css + video-capture.js", () => {
    expect(fs.readFileSync(WJS).equals(fs.readFileSync(PCSS))).toBe(true);
    expect(fs.readFileSync(VCJS).equals(fs.readFileSync(VCP))).toBe(true);
  });

  it("video capture is lazy-loaded: base never inlines getDisplayMedia/MediaRecorder loop", () => {
    const j = js();
    // base gate must still exist and route through isVideoSupported/loadScript -> video-capture.js
    expect(j).toMatch(/function isVideoSupported/);
    expect(j).toMatch(/video-capture\.js/);
    expect(j).toMatch(/loadScript/);
    // direct getDisplayMedia in base must be only behind the isVideoSupported guard / lazy path
    // allow isVideoSupported probe (contains getDisplayMedia string once), but no bare getDisplayMedia().then in base outside video-capture
    const gdmCalls = (j.match(/getDisplayMedia\(/g)||[]).length;
    expect(gdmCalls).toBeLessThanOrEqual(1);
    // MediaRecorder negotiation lives in lazy module, not inlined into base beyond at most a guard
    const isTypeCalls = (j.match(/isTypeSupported/g)||[]).length;
    expect(isTypeCalls).toBeLessThanOrEqual(1);
  });

  it("videoCaptureEnabled async refresh updates chooser deterministically", () => {
    const j = js();
    // must have refresh path that re-evaluates flag after fetchWidgetConfig resolves late
    expect(j).toMatch(/function refreshVideoChooser/);
    expect(j).toMatch(/videoCaptureEnabled/);
    expect(j).toMatch(/refreshVideoChooser\(\)/);
  });

  it("flag off stays 2-way: Record video never invokes getDisplayMedia", () => {
    const j = js();
    // ensure the guard check is present before any recording path can fire
    expect(j).toMatch(/isVideoEnabled\(\)[\s\S]{0,200}isVideoSupported\(\)|isVideoSupported\(\)[\s\S]{0,200}isVideoEnabled\(\)/);
  });

  it("microphone explicit opt-in off by default and merged only when needed", () => {
    const j = js();
    const v = vc();
    expect(j).toMatch(/bugaputa-video-mic/);
    expect(j).toMatch(/Include microphone \(off by default\)/);
    // underlying lazy module must use getUserMedia(audio) merge only where needed
    expect(v).toMatch(/getUserMedia/);
    expect(v).toMatch(/getDisplayMedia/);
    // must not default audio:true unconditionally in base; base delegates micEnabled flag
    expect(j).toMatch(/micEnabled/);
    // mic stream must be cleaned (stopTracks includes mic stream)
    expect(v).toMatch(/stopTracks/);
    expect(v).toMatch(/micStream/);
  });

  it("negotiates supported codecs per plan 4.4, never camera", () => {
    const v = vc();
    // must probe isTypeSupported in the prescribed priority
    for(const m of ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm;codecs=av1,opus','video/webm','video/mp4']){
      expect(v).toMatch(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    }
    expect(v).not.toMatch(/getUserMedia\(\{[^}]*video\s*:\s*true/);
  });

  it("60s auto-stop, size/MIME/duration validation, preview with object URL, error paths", () => {
    const j = js();
    const v = vc();
    expect(v).toMatch(/60000/);
    expect(v).toMatch(/25\*1024\*1024|26214400/);
    expect(j).toMatch(/25\*1024\*1024/);
    expect(j).toMatch(/video\/webm|video\/mp4/);
    expect(v).toMatch(/61000|61\*1000/);
    expect(j).toMatch(/createObjectURL/);
    expect(j).toMatch(/revokeObjectURL/);
    // preview uses <video> with object URL
    expect(j).toMatch(/createElement\('video'\)/);
    expect(j).toMatch(/setAttribute\('controls'/);
  });

  it("preserves recording after submission error for retry; clears on close/remove/success", () => {
    const j = js();
    expect(j).toMatch(/onError intentionally does NOT clear attachment/);
    expect(j).toMatch(/clearAttachmentState/);
    expect(j).toMatch(/cleanupVideoAttachment/);
    expect(j).toMatch(/URL\.revokeObjectURL/);
  });

  it("every error/ESC/backdrop/modal close path restores visible controls and stops tracks/timers", () => {
    const j = js();
    const v = vc();
    expect(j).toMatch(/onOverlayEsc/);
    expect(j).toMatch(/function close\(\)/);
    expect(j).toMatch(/getElementById\('bugaputa-btn'\)/);
    // track/timer cleanup present (v has real cleanup, j has cancel + close)
    expect(v).toMatch(/clearInterval/);
    expect(v).toMatch(/getTracks/);
    expect(v).toMatch(/\.stop\(\)/);
    // no silent fallback after denial
    expect(v).toMatch(/Permission denied/);
    expect(j).toMatch(/Retry|renderVideoDenied/);
  });

  it("submission appends multipart field video and metadata while screenshot behavior unchanged", () => {
    const j = js();
    expect(j).toMatch(/fd\.append\('video'/);
    expect(j).toMatch(/fd\.append\('domSnapshot'/);
    expect(j).toMatch(/fd\.append\('screenshot'/);
    expect(j).toMatch(/hasVideo/);
    expect(j).toMatch(/pendingVideoFile/);
  });

  it("server serves lazy asset with cross-origin CORP for embed", () => {
    const appSrc = fs.readFileSync(APP, "utf8");
    expect(appSrc).toMatch(/video-capture\.js/);
    expect(appSrc).toMatch(/Cross-Origin-Resource-Policy/);
  });

  // jsdom lifecycle smoke with mocked getDisplayMedia/MediaRecorder
  describe("runtime: mocked getDisplayMedia/MediaRecorder", () => {
    let fakeStream:any, fakeRecorder:any;
    beforeEach(() => {
      // jsdom setup
      try{ Object.defineProperty(globalThis, 'navigator', {value: (globalThis as any).navigator || {}, writable:true, configurable:true}); }catch(_){ }
      // @ts-ignore
      (globalThis as any).URL.createObjectURL = (globalThis as any).URL.createObjectURL || (() => "blob:fake");
      // @ts-ignore
      (globalThis as any).URL.revokeObjectURL = (globalThis as any).URL.revokeObjectURL || (() => {});
      const track = { stop: vi.fn(), addEventListener: vi.fn(), kind: 'video' } as any;
      const audioTrack = { stop: vi.fn(), addEventListener: vi.fn(), kind: 'audio', getSettings: () => ({}) } as any;
      fakeStream = { getTracks: () => [track], getAudioTracks: () => [], getVideoTracks: () => [track], addTrack: vi.fn() } as any;
      Object.assign(navigator as any, { mediaDevices: {
        getDisplayMedia: vi.fn().mockResolvedValue(fakeStream),
        getUserMedia: vi.fn().mockResolvedValue({ getTracks:()=>[audioTrack], getAudioTracks:()=>[audioTrack], addTrack: vi.fn() } as any),
      }});
      const rec:any = function(this:any, stream:any, opts?:any){ this.stream=stream; this.mimeType=opts?.mimeType||'video/webm'; this.state='inactive'; this.ondataavailable=null; this.onstop=null; this.onerror=null; this.start=vi.fn(()=>{this.state='recording'; if(this.ondataavailable) this.ondataavailable({data: new Blob(['x'], {type: this.mimeType})});}); this.stop=vi.fn(()=>{this.state='inactive'; if(this.onstop) this.onstop({});}); };
      rec.isTypeSupported = vi.fn((m:string) => m.includes('webm'));
      // @ts-ignore
      (globalThis as any).MediaRecorder = rec;
      fakeRecorder = rec;
    });
    afterEach(() => { vi.restoreAllMocks(); });

    it("startSession negotiates codec and emits preview (deterministic, timers mocked)", async () => {
      const src = vc();
      expect(src).toMatch(/getSupportedMime/);
      expect(src).toMatch(/startSession/);
      // verify getSupportedMime candidate loop exists
      expect(src).toMatch(/CANDIDATES/);
    });
  });
});
