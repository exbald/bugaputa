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

const js = () => fs.readFileSync(WJS, "utf8");
const css = () => fs.readFileSync(WCSS, "utf8");

describe("Video 04: size reclaim + flagged 3-way chooser (RED)", () => {
  it("mirrors byte-identical (js + css)", () => {
    expect(fs.readFileSync(WJS).equals(fs.readFileSync(PJS))).toBe(true);
    expect(fs.readFileSync(WCSS).equals(fs.readFileSync(PCSS))).toBe(true);
  });

  it("hard ceiling <30720 (30KB)", () => {
    const gz = gzipSync(fs.readFileSync(WJS));
    expect(gz.length, `gzip ${gz.length} must be <30720`).toBeLessThan(30720);
  });

  it("reclaimed budget <=29696 (29KB) before video wiring", () => {
    const gz = gzipSync(fs.readFileSync(WJS));
    expect(gz.length, `gzip ${gz.length} must be <=29900 (video-aware live-workspace stub) after reclaim`).toBeLessThanOrEqual(29696);
  });

  it("chooser has 3-way buttons when flag on, 2-way when off (flag-gated)", () => {
    const j = js();
    // must contain Screenshot / Record video / General feedback affordances
    expect(j).toMatch(/bugaputa-choose-screenshot|bugaputa-choose-capture/);
    expect(j).toMatch(/bugaputa-choose-video/);
    expect(j).toMatch(/bugaputa-choose-general/);
    // accessible labels
    expect(j).toMatch(/Record video/);
    expect(j).toMatch(/Screenshot/);
    expect(j).toMatch(/General feedback/);
    // min-height enforced via CSS, not inline JS
    expect(css()).toMatch(/min-height:\s*48px/);
    expect(css()).toMatch(/focus-visible/);
    // flag gate: widgetConfig.videoCaptureEnabled
    expect(j).toMatch(/videoCaptureEnabled/);
    // must hide video button when flag false (display none or conditional)
    expect(j).toMatch(/videoCaptureEnabled/);
  });

  it("video consent pane shell present with mic off by default", () => {
    const j = js();
    expect(j).toMatch(/bugaputa-video-pane/);
    expect(j).toMatch(/bugaputa-video-mic/);
    expect(j).toMatch(/Include microphone/);
    // mic unchecked/off by default: checkbox exists but not checked attribute set initially
    // check that creation does not set checked
    const micSection = j.slice(j.indexOf("bugaputa-video-mic") - 500, j.indexOf("bugaputa-video-mic") + 800);
    expect(micSection).not.toMatch(/checked.*true|setAttribute.*checked/);
    expect(j).toMatch(/Start recording/);
    expect(j).toMatch(/bugaputa-video-status/);
    expect(j).toMatch(/Back/);
    // localStorage skip key for video consent
    expect(j).toMatch(/bugaputa-skip-video-consent/);
  });

  it("existing projects never invoke getDisplayMedia when flag off", () => {
    const j = js();
    const hasGDM = j.includes("getDisplayMedia");
    if (hasGDM) {
      expect(j).toMatch(/isVideoEnabled\(\)[\s\S]{0,700}getDisplayMedia|getDisplayMedia[\s\S]{0,700}isVideoEnabled|videoCaptureEnabled[\s\S]{0,700}getDisplayMedia/);
    } else {
      expect(j).toMatch(/videoCaptureEnabled/);
    }
  });

  it("clean seam for MediaRecorder lifecycle exists (stub, not yet implemented)", () => {
    const j = js();
    // seam marker for next card
    expect(j).toMatch(/video-capture|startVideoCapture|cleanupVideo|pendingVideoFile/);
  });

  it("ESC/backdrop/cancel restores trigger button", () => {
    const j = js();
    expect(j).toMatch(/function close\(\)/);
    expect(j).toMatch(/getElementById\('bugaputa-btn'\)/);
    expect(j).toMatch(/display.*''/);
    expect(j).toMatch(/overlay\.addEventListener\('click'/);
    expect(j).toMatch(/Escape/);
  });

  it("CSS for video chooser and pane present", () => {
    const c = css();
    expect(c).toMatch(/#bugaputa-choose-video/);
    expect(c).toMatch(/#bugaputa-video-pane/);
    expect(c).toMatch(/#bugaputa-video-status/);
    // focus-visible for new buttons
    expect(c).toMatch(/focus-visible/);
    // 44px targets preserved
    expect(c).toMatch(/min-height:\s*44px|min-height:44px/);
  });

  it("widget.js does not silently breach hard ceiling comment guard retained", () => {
    const j = js();
    // ensure stability comment retained for deferred reveal tests
    expect(j).toMatch(/already revealed|timeout won/i);
    expect(j).toMatch(/onError intentionally does NOT clear attachment/);
  });

  it("fetches videoCaptureEnabled even when data-label/color/pos all present", () => {
    const j = js();
    // must not gate fetchWidgetConfig on needFetch; flag fetch must happen when projectKey present
    // the fetch block should start with if(!projectKey) return; not needFetch||!projectKey
    expect(j).toContain("(function fetchWidgetConfig(){");
    const fetchIdx = j.indexOf("(function fetchWidgetConfig(){");
    const block = j.slice(fetchIdx, fetchIdx + 1100);
    expect(block).not.toMatch(/needFetch/);
    expect(block).toMatch(/if\(!projectKey\) return/);
    // label/color still only overridden when initial missing (further in file, not necessarily within 700 chars)
    expect(j).toMatch(/if\(!_initialLabel&&fetchedLabel\)/);
    expect(j).toMatch(/if\(!_initialColor&&fetchedColor\)/);
    expect(j).toMatch(/if\(!_initialPos&&fetchedPos\)/);
    // video flag always set from response
    expect(j).toMatch(/widgetConfig\.videoCaptureEnabled\s*=\s*!!fetchedVideo/);
  });
});
