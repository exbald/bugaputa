import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VCJS = path.resolve(__dirname, "../../../widget/video-capture.js");
const VCP = path.resolve(__dirname, "../../public/video-capture.js");

describe("Capture Handle permittedOrigins correction (t_15e551d6)", () => {
  const fakeLocation = { origin: "https://widget.test" };
  const src = () => fs.readFileSync(VCJS, "utf8");

  function makeTrack(kind: string, displaySurface: string, getCaptureHandle?: () => any) {
    const base: any = { kind, id: kind + "-track", stop: vi.fn(), addEventListener: vi.fn(), label: kind };
    if (kind === "video") {
      base.getSettings = () => ({ displaySurface });
      base.getCaptureHandle = getCaptureHandle || (() => null);
    }
    return base as any;
  }
  function makeStream(tracks: any[]) {
    return {
      getTracks: () => tracks.slice(),
      getAudioTracks: () => tracks.filter((t: any) => t.kind === "audio"),
      getVideoTracks: () => tracks.filter((t: any) => t.kind === "video"),
      addTrack: (t: any) => tracks.push(t),
      _tracks: tracks,
    } as any;
  }
  function loadCap(opts: {
    displaySurface?: string;
    captureHandleValue?: any; // null means getCaptureHandle returns null, undefined means default matching behavior
    captureHandleMode?: "matching" | "mismatch" | "wrong-origin" | "null" | "missing-handle-field";
  } = {}) {
    const displaySurface = opts.displaySurface ?? "browser";
    let configuredHandle = "";
    let configuredPermittedOrigins: any = "__not_called__";
    let configuredExposeOrigin: any = "__not_called__";
    // capture handle to return from track
    const mkHandle = () => {
      if (opts.captureHandleValue !== undefined) return opts.captureHandleValue;
      if (opts.captureHandleMode === "null") return null;
      if (opts.captureHandleMode === "mismatch") return { origin: fakeLocation.origin, handle: "other-session-token" };
      if (opts.captureHandleMode === "wrong-origin") return { origin: "https://evil.test", handle: configuredHandle };
      if (opts.captureHandleMode === "missing-handle-field") return { origin: fakeLocation.origin }; // no handle field
      // matching
      return { origin: fakeLocation.origin, handle: configuredHandle };
    };
    const displayTrack = makeTrack("video", displaySurface, mkHandle);
    const displayStream = makeStream([displayTrack]);
    const gdmOptsCapture: any[] = [];
    const getDisplayMedia = vi.fn((o: any) => {
      gdmOptsCapture.push(o);
      return Promise.resolve(displayStream);
    });
    const setCaptureHandleConfig = vi.fn((config: any) => {
      configuredHandle = config.handle;
      configuredPermittedOrigins = config.permittedOrigins;
      configuredExposeOrigin = config.exposeOrigin;
    });
    const med: any = { getDisplayMedia, setCaptureHandleConfig };
    const fakeNavigator: any = { mediaDevices: med };
    function MR(this: any, stream: any, o?: any) {
      this.stream = stream;
      this.mimeType = o?.mimeType || "video/webm;codecs=vp9,opus";
      this.state = "inactive";
      this.ondataavailable = null as any;
      this.onstop = null as any;
      this.onerror = null as any;
      this.start = vi.fn(() => { this.state = "recording"; });
      this.stop = vi.fn(() => {
        this.state = "inactive";
        if (this.ondataavailable) this.ondataavailable({ data: new Blob(["x"], { type: this.mimeType }) });
        if (this.onstop) this.onstop({});
      });
    }
    (MR as any).isTypeSupported = vi.fn((m: string) => m.includes("webm"));
    const fakeURL: any = { createObjectURL: vi.fn(() => "blob:fake-url"), revokeObjectURL: vi.fn(() => {}) };
    const s = src();
    const win: any = {};
    const exec = new Function("window", "navigator", "MediaRecorder", "Blob", "File", "URL", "document", "location", s + "\nreturn window.__bugaputaVideoCapture;");
    const cap = exec(win, fakeNavigator, MR as any, Blob, File, fakeURL, {} as any, fakeLocation);
    return { cap, gdmOptsCapture, getDisplayMedia, displayStream, displayTrack, setCaptureHandleConfig, get configuredHandle() { return configuredHandle; }, get configuredPermittedOrigins() { return configuredPermittedOrigins; }, get configuredExposeOrigin() { return configuredExposeOrigin; } };
  }

  async function flush() {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 10));
  }

  it("mirror byte-identical", () => {
    expect(fs.readFileSync(VCJS).equals(fs.readFileSync(VCP))).toBe(true);
  });

  it("source sets permittedOrigins to same-origin [location.origin] via setCaptureHandleConfig", () => {
    const s = src();
    // must not wildcard, must include permittedOrigins
    expect(s).toMatch(/setCaptureHandleConfig\s*\(\s*\{[^}]*permittedOrigins\s*:\s*\[location\.origin\]/);
    expect(s).not.toMatch(/permittedOrigins\s*:\s*\[\s*['\"]\*['\"]\s*\]/);
    // gdmOpts must NOT carry captureHandleConfig (invalid GDM option)
    expect(s).not.toMatch(/gdmOpts\.captureHandleConfig/);
    expect(s).not.toMatch(/captureHandleConfig\s*:/);
  });

  it("deterministic: inspects actual config arg — fails when permittedOrigins omitted/empty/wildcard/wrong-origin; passes only for same-origin", async () => {
    const { cap, gdmOptsCapture, setCaptureHandleConfig } = loadCap();
    // trigger setupCaptureHandle via startSession -> chooseCaptureStream
    cap.startSession({ micEnabled: false, onDenied: vi.fn(), onPreview: vi.fn(), onError: vi.fn(), onUnsupported: vi.fn() });
    await flush();
    expect(setCaptureHandleConfig).toHaveBeenCalledTimes(1);
    const cfg = setCaptureHandleConfig.mock.calls[0][0];
    // must be same-origin, not empty, not wildcard, not wrong-origin
    expect(cfg.exposeOrigin).toBe(true);
    expect(cfg.handle).toMatch(/^bugaputa-/);
    expect(cfg.permittedOrigins).toEqual([fakeLocation.origin]);
    expect(cfg.permittedOrigins).not.toEqual([]);
    expect(cfg.permittedOrigins).not.toEqual(["*"]);
    expect(cfg.permittedOrigins).not.toEqual(["https://evil.test"]);
    expect(cfg.permittedOrigins.length).toBe(1);
    expect(cfg.permittedOrigins[0]).toBe(fakeLocation.origin);
    // gdmOpts must not contain captureHandleConfig and must preserve privacy hints
    expect(gdmOptsCapture[0]).toBeTruthy();
    expect(gdmOptsCapture[0].captureHandleConfig).toBeUndefined();
    expect(gdmOptsCapture[0].preferCurrentTab).toBe(true);
    expect(gdmOptsCapture[0].selfBrowserSurface).toBe("include");
    expect(gdmOptsCapture[0].surfaceSwitching).toBe("exclude");
    expect(gdmOptsCapture[0].monitorTypeSurfaces).toBe("exclude");
    expect(gdmOptsCapture[0].systemAudio).toBe("exclude");
    expect(gdmOptsCapture[0].audio).toBe(false);
    expect(gdmOptsCapture[0].video).toEqual({ displaySurface: "browser" });
  });

  it("validateIsCurrentTab success only for browser displaySurface + same-origin token match", async () => {
    const { cap, displayTrack } = loadCap({ displaySurface: "browser", captureHandleMode: "matching" });
    const onUnsupported = vi.fn();
    const onPreview = vi.fn();
    cap.startSession({ micEnabled: false, onDenied: vi.fn(), onPreview, onError: vi.fn(), onUnsupported });
    await flush();
    expect(onUnsupported).not.toHaveBeenCalled();
    // should proceed to recording (onPreview not yet unless we stop, but unsupported not called)
    expect(displayTrack.stop).not.toHaveBeenCalled();
  });

  it("validateIsCurrentTab rejects wrong token", async () => {
    const { cap, displayTrack } = loadCap({ displaySurface: "browser", captureHandleMode: "mismatch" });
    const onUnsupported = vi.fn();
    cap.startSession({ micEnabled: false, onDenied: vi.fn(), onPreview: vi.fn(), onError: vi.fn(), onUnsupported });
    await flush();
    expect(onUnsupported).toHaveBeenCalledTimes(1);
    expect(String(onUnsupported.mock.calls[0][0])).toMatch(/token mismatch/i);
    expect(displayTrack.stop).toHaveBeenCalled();
  });

  it("validateIsCurrentTab rejects wrong origin", async () => {
    const { cap, displayTrack } = loadCap({ displaySurface: "browser", captureHandleMode: "wrong-origin" });
    const onUnsupported = vi.fn();
    cap.startSession({ micEnabled: false, onDenied: vi.fn(), onPreview: vi.fn(), onError: vi.fn(), onUnsupported });
    await flush();
    expect(onUnsupported).toHaveBeenCalledTimes(1);
    expect(String(onUnsupported.mock.calls[0][0])).toMatch(/origin mismatch/i);
    expect(displayTrack.stop).toHaveBeenCalled();
  });

  it("validateIsCurrentTab rejects null handle (permittedOrigins default would cause null)", async () => {
    const { cap, displayTrack } = loadCap({ displaySurface: "browser", captureHandleMode: "null" });
    const onUnsupported = vi.fn();
    cap.startSession({ micEnabled: false, onDenied: vi.fn(), onPreview: vi.fn(), onError: vi.fn(), onUnsupported });
    await flush();
    expect(onUnsupported).toHaveBeenCalledTimes(1);
    expect(String(onUnsupported.mock.calls[0][0])).toMatch(/Capture Handle unavailable|upload fallback|handle token missing/i);
    expect(displayTrack.stop).toHaveBeenCalled();
  });

  it("validateIsCurrentTab rejects screen displaySurface even with matching handle", async () => {
    const { cap, displayTrack } = loadCap({ displaySurface: "monitor", captureHandleMode: "matching" });
    const onUnsupported = vi.fn();
    cap.startSession({ micEnabled: false, onDenied: vi.fn(), onPreview: vi.fn(), onError: vi.fn(), onUnsupported });
    await flush();
    expect(onUnsupported).toHaveBeenCalledTimes(1);
    expect(String(onUnsupported.mock.calls[0][0])).toMatch(/displaySurface is monitor/i);
    expect(displayTrack.stop).toHaveBeenCalled();
  });

  it("validateIsCurrentTab rejects window displaySurface", async () => {
    const { cap, displayTrack } = loadCap({ displaySurface: "window", captureHandleMode: "matching" });
    const onUnsupported = vi.fn();
    cap.startSession({ micEnabled: false, onDenied: vi.fn(), onPreview: vi.fn(), onError: vi.fn(), onUnsupported });
    await flush();
    expect(onUnsupported).toHaveBeenCalledTimes(1);
    expect(String(onUnsupported.mock.calls[0][0])).toMatch(/displaySurface is window/i);
    expect(displayTrack.stop).toHaveBeenCalled();
  });

  it("validateIsCurrentTab rejects missing handle field (empty handle)", async () => {
    const { cap, displayTrack } = loadCap({ displaySurface: "browser", captureHandleMode: "missing-handle-field" });
    const onUnsupported = vi.fn();
    cap.startSession({ micEnabled: false, onDenied: vi.fn(), onPreview: vi.fn(), onError: vi.fn(), onUnsupported });
    await flush();
    expect(onUnsupported).toHaveBeenCalledTimes(1);
    expect(String(onUnsupported.mock.calls[0][0])).toMatch(/handle token missing|upload fallback/i);
    expect(displayTrack.stop).toHaveBeenCalled();
  });

  it("permission timing: only Record triggers capture (no getDisplayMedia at load), mic OFF default, no camera/system audio", () => {
    const s = src();
    // source must not call getDisplayMedia at top-level; it is inside chooseCaptureStream/startSession
    // check that getDisplayMedia appears only inside function bodies, not as top-level invocation
    // we verify via exec: loading module does not call getDisplayMedia
    const { getDisplayMedia } = loadCap();
    expect(getDisplayMedia).not.toHaveBeenCalled();
    // invariants from task
    expect(s).toMatch(/audio\s*:\s*false/);
    expect(s).toMatch(/systemAudio\s*:\s*['\"]exclude['\"]/);
    expect(s).not.toMatch(/getUserMedia\s*\(\s*\{\s*audio\s*:\s*true\s*,\s*video\s*:\s*true/);
    expect(s).not.toMatch(/getDisplayMedia\([^)]*audio\s*:\s*true/);
    // mic via getUserMedia only after opt-in — check that startSession with mic false never calls getUserMedia (covered elsewhere) but source contains correct pattern
    expect(s).toMatch(/getUserMedia\s*\(\s*\{\s*audio\s*:\s*true\s*,\s*video\s*:\s*false/);
  });
});
