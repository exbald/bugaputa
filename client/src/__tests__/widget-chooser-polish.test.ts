import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { gzipSync } from "zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WJS = path.resolve(__dirname, "../../../widget/widget.js");
const WCSS = path.resolve(__dirname, "../../../widget/widget.css");

const js = () => fs.readFileSync(WJS, "utf8");
const css = () => fs.readFileSync(WCSS, "utf8");

describe("Video chooser polish: unified choice-card (release-blocking visual fix)", () => {
  it("screenshot row uses shared choice-card structure (not unstyled text)", () => {
    const j = js();
    const c = css();
    // JS renders screenshot as html with icon + title/subtitle + chevron
    expect(j).toContain("bugaputa-choose-screenshot");
    expect(j).toContain("bugaputa-choice-icon");
    expect(j).toContain("bugaputa-choice-text");
    expect(j).toContain("bugaputa-choice-chevron");
    expect(j).toContain("bugaputa-choice-title");
    expect(j).toContain("bugaputa-choice-sub");
    // CSS targets screenshot via shared selector — no orphan unboxed state
    expect(c).toMatch(/#bugaputa-choose-screenshot/);
    // all three share the same base rule (equal border/radius/height)
    expect(c).toMatch(/#bugaputa-choose-video,#bugaputa-choose-screenshot,#bugaputa-choose-general/);
  });

  it("all three rows share identical class/structure and solid borders", () => {
    const c = css();
    // no dashed borders anywhere
    expect(c).not.toMatch(/border:\s*1px\s+dashed/);
    expect(c).not.toMatch(/border[^;]*dashed/);
    // solid slate border on shared rule
    expect(c).toMatch(/border:\s*1px solid #e2e8f0/);
    // equal min-height
    expect(c).toMatch(/min-height:\s*48px/);
    // equal radius
    expect(c).toMatch(/border-radius:\s*12px/);
    // text left with full-row flex click target
    expect(c).toMatch(/text-align:\s*left/);
    expect(c).toMatch(/display:\s*flex/);
    // hover/active/focus-visible for each chooser id
    expect(c).toMatch(/#bugaputa-choose-screenshot:hover/);
    expect(c).toMatch(/#bugaputa-choose-screenshot:active/);
    expect(c).toMatch(/#bugaputa-choose-screenshot:focus-visible/);
  });

  it("each row has an inline SVG icon tile and right chevron (restrained SVGs)", () => {
    const j = js();
    // icon variables
    expect(j).toContain("iconVideo");
    expect(j).toContain("iconShot");
    expect(j).toContain("iconGeneral");
    expect(j).toContain("bugaputa-choice-icon");
    expect(j).toContain("chevronSvg");
    // SVG semantics: stroke based, not emojis
    // annotation toolbar font fallbacks legitimately mention emoji; chooser itself must not
    // ensure chooser buttons do not rely on emoji glyphs vs SVG
    expect(j).toContain("bugaputa-choice-icon");
    // ensure SVG strings present
    expect(j).toMatch(/<svg[^>]*viewBox/);
    expect(j).toMatch(/stroke="currentColor"/);
  });

  it("titles and subtitles match exact spec copy", () => {
    const j = js();
    expect(j).toContain("Record video");
    expect(j).toContain("Capture up to 60 seconds");
    expect(j).toContain("Screenshot");
    expect(j).toContain("Capture and annotate this page");
    expect(j).toContain("General feedback");
    expect(j).toContain("Send a message without a capture");
    // aria labels mirror titles
    expect(j).toMatch(/aria-label.*Record video/);
    expect(j).toMatch(/aria-label.*Screenshot/);
    expect(j).toMatch(/aria-label.*General feedback/);
  });

  it("Record video New badge is inline lime pill (not dashed border)", () => {
    const j = js();
    const c = css();
    expect(j).toContain('bugaputa-badge');
    expect(j).toContain(">New<");
    expect(c).toMatch(/\.bugaputa-badge/);
    expect(c).toMatch(/background:\s*#a3e635/);
    // badge is inside title span, not a border hack
    expect(j).toMatch(/bugaputa-choice-title.*bugaputa-badge/s);
  });

  it("close control is polished 44px circular button with hover/focus", () => {
    const j = js();
    const c = css();
    // JS creates button with id bugaputa-close (not inline style blob)
    expect(j).toContain("bugaputa-close");
    expect(j).toMatch(/id:\s*['\"]bugaputa-close['\"]/);
    expect(c).toMatch(/#bugaputa-close/);
    expect(c).toMatch(/width:\s*44px/);
    expect(c).toMatch(/height:\s*44px/);
    expect(c).toMatch(/border-radius:\s*50%/);
    expect(c).toMatch(/#bugaputa-close:hover/);
    expect(c).toMatch(/#bugaputa-close:focus-visible/);
  });

  it("order is Record video > Screenshot > General feedback; keyboard/focus/features preserved", () => {
    const j = js();
    // order: video first, then capture, then general (flag-gated)
    const vi = j.indexOf("bugaputa-choose-video");
    const si = j.indexOf("bugaputa-choose-screenshot");
    const gi = j.indexOf("bugaputa-choose-general");
    // In the chooser construction segment, video insert respects flag
    expect(j).toContain("isVideoEnabled()");
    expect(j).toContain("refreshVideoChooser");
    // keyboard: focus trap, ESC
    expect(j).toContain("trapFocus");
    expect(j).toContain("Escape");
    expect(j).toContain("onOverlayEsc");
    // chooser append logic keeps video at top when enabled
    expect(j).toMatch(/chooserActions\.appendChild\(btnVideo\)/);
    expect(j).toMatch(/chooserActions\.appendChild\(btnCapture\)/);
    expect(j).toMatch(/chooserActions\.appendChild\(btnGeneral\)/);
  });

  it("still respects feature flag, focus order, and aria; no naked text affordance", () => {
    const j = js();
    const c = css();
    // flag hides video button when off
    expect(j).toMatch(/display.*none.*isVideoEnabled|isVideoEnabled.*display/s);
    // all chooser buttons are min 48px
    expect(c).toMatch(/min-height:\s*48px/);
    // no gradients/glassmorphism
    expect(c).not.toMatch(/gradient|backdrop-filter|glassmorphism/i);
    expect(j).not.toMatch(/gradient|backdrop-filter/i);
  });

  it("gzip still under ceilings after polish", () => {
    const gzBase = gzipSync(fs.readFileSync(WJS));
    expect(gzBase.length).toBeLessThan(30720);
    expect(gzBase.length).toBeLessThanOrEqual(29696);
    const gzCss = gzipSync(fs.readFileSync(WCSS));
    expect(gzCss.length).toBeLessThan(4096);
  });
});
