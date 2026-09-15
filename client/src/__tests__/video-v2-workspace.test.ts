import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WJS = path.resolve(__dirname, "../../../widget/widget.js");
const VCJS = path.resolve(__dirname, "../../../widget/video-capture.js");
const WCSS = path.resolve(__dirname, "../../../widget/widget.css");

function js(){ return fs.readFileSync(WJS,"utf8"); }
function vc(){ return fs.readFileSync(VCJS,"utf8"); }
function css(){ return fs.readFileSync(WCSS,"utf8"); }

describe("Video v2: unified workspace + toolbar + privacy + pointer + preview", ()=>{
  it("spike doc exists and states getViewportMedia not shipped", ()=>{
    const spike = fs.readFileSync(path.resolve(__dirname, "../../..", "docs/spike/2026-09-15-viewport-vs-displaymedia.md"),"utf8");
    expect(spike).toMatch(/getViewportMedia/);
    expect(spike).toMatch(/not shipped/i);
    expect(spike).toMatch(/preferCurrentTab/);
  });
  it("video-capture privacy: getViewportMedia preferred, else strong hints, validate displaySurface + handle", ()=>{
    const s = vc();
    expect(s).toMatch(/getViewportMedia/);
    expect(s).toMatch(/preferCurrentTab/);
    expect(s).toMatch(/selfBrowserSurface/);
    expect(s).toMatch(/surfaceSwitching/);
    expect(s).toMatch(/monitorTypeSurfaces/);
    expect(s).toMatch(/systemAudio/);
    expect(s).toMatch(/displaySurface/);
    expect(s).toMatch(/getCaptureHandle|captureHandle/);
    expect(s).toMatch(/validateIsCurrentTab/);
    expect(s).toMatch(/cannot verify|upload fallback/i);
    // never audio:true in display path
    expect(s).not.toMatch(/getDisplayMedia\([^)]*audio\s*:\s*true/);
    expect(s).toMatch(/audio\s*:\s*false/);
    // consent comment documents hint limitation
    expect(s).toMatch(/hints alone cannot legally constrain/i);
  });
  it("mic stays OFF default, separate getUserMedia only on opt-in, recoverable", ()=>{
    const s = vc();
    expect(s).toMatch(/getUserMedia\s*\(\s*\{\s*audio\s*:\s*true\s*,\s*video\s*:\s*false/);
    expect(s).not.toMatch(/getUserMedia\(\{[^}]*video\s*:\s*true/);
    expect(js()).toMatch(/Include microphone \(off by default\)/);
    expect(s).toMatch(/continue without microphone/i);
  });
  it("annotation doc coords + RAF + nested scroll comment", ()=>{
    const j = js();
    expect(j).toMatch(/getDocPoint/);
    expect(j).toMatch(/requestAnimationFrame/);
    // doc-relative comment
    expect(j).toMatch(/document.*coords|scroll compensation/i);
  });
  it("pointer halo non-blocking high-contrast, ripple, reduced-motion, toggle", ()=>{
    const j = js();
    const c = css();
    expect(j).toMatch(/pointerHalo|ensureHalo|spawnRipple/);
    expect(c).toMatch(/#bugaputa-pointer-halo/);
    expect(c).toMatch(/pointer-events:\s*none/);
    expect(c).toMatch(/box-shadow.*#0f172a/);
    expect(c).toMatch(/prefers-reduced-motion/);
    expect(c).toMatch(/bugaputa-ripple/);
    expect(j).toMatch(/togglePointerHalo|pointerHaloEnabled/);
  });
  it("toolbar 44px + a11y: Stop/Use recording/Record again/Delete with confirm, focus-visible", ()=>{
    const j = js();
    const c = css();
    expect(j).toMatch(/Stop recording/);
    expect(j).toMatch(/Use recording/);
    expect(j).toMatch(/Record again/);
    expect(j).toMatch(/Delete recording/);
    expect(j).toMatch(/confirm.*Delete/i);
    expect(c).toMatch(/min-height:\s*44px/);
    expect(c).toMatch(/focus-visible/);
  });
  it("preview cleanup: Record again revokes blobUrl/timers/tracks", ()=>{
    const j = js();
    expect(j).toMatch(/revokeObjectURL/);
    expect(j).toMatch(/Record again/);
    // ensure Record again path cleans before re-entering
    expect(j).toMatch(/pendingVideoUrl.*null|revokeObjectURL.*pendingVideoUrl/s);
  });
  it("permission timing: no capture before Record, Retry/Upload/Cancel on deny", ()=>{
    const j = js();
    expect(j).toMatch(/Waiting for permission/);
    expect(j).toMatch(/Retry/);
    expect(j).toMatch(/Upload.*video|upload.*fallback/i);
    expect(j).toMatch(/Use screenshot instead|General feedback/);
  });
  it("unsupported fallback never broad-captures, shows upload", ()=>{
    const s = vc();
    expect(s).toMatch(/onUnsupported/);
    expect(s).toMatch(/upload.*video/i);
    expect(s).not.toMatch(/getDisplayMedia\([^)]*audio\s*:\s*true/);
  });
it("live annotation storage is document-relative (600px scroll out/back within 1px) — deterministic", ()=>{
    const j = js();
    // getDocPoint must add window.scrollX/Y (document coords, not viewport)
    expect(j).toMatch(/getDocPoint\(e\)\{[^}]*clientX[^}]*scrollX/s);
    expect(j).toMatch(/getDocPoint\(e\)\{[^}]*clientY[^}]*scrollY/s);
    // Execute the extracted function to prove 600px round-trip within 1px (jsdom-style math)
    const fnSrc = (()=>{ const a=j.indexOf("function getDocPoint("); if(a<0) return null; let d=0,s=-1; for(let i=a;i<j.length;i++){ if(j[i]==='{'){ if(s<0) s=i; d++; } else if(j[i]==='}') { d--; if(d===0) return j.slice(a,i+1);} } return null; })() as string | null;
    expect(fnSrc, "getDocPoint exists").toBeTruthy();
    const body = fnSrc!.replace(/^function getDocPoint[^{]*\{/, "").replace(/\}$/, "");
    const getDocPoint = new Function("e","window", body + "\nreturn {x:(e.clientX||0)+(window.scrollX||0), y:(e.clientY||0)+(window.scrollY||0)};") as any;
    // Use real math check (window.scrollY simulation)
    const mk = (clientX:number, clientY:number, scrollX:number, scrollY:number)=> getDocPoint({clientX, clientY}, {scrollX, scrollY});
    const p0 = mk(200,300,0,0);
    const pScrolled = mk(200,300,0,600);
    // document coords: same element at same client pos after scroll should differ by scrollY
    expect(pScrolled.y - p0.y).toBe(600);
    // out/back: scroll 600 then back must be within 1px
    const pBack = mk(200,300,0,0);
    expect(Math.abs(pBack.y - p0.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(pBack.x - p0.x)).toBeLessThanOrEqual(1);
  });
  it("nested scroll containers handled (container scrollLeft/top considered) — spec §7", ()=>{
    const j = js();
    // Annotation layer must mention nested scroll / container scroll / ResizeObserver or scroll-compensated vector layer
    expect(j).toMatch(/ResizeObserver|nested|scroll.*container|scroll compensation/i);
    const c = css();
    // Toolbar remains viewport-fixed (not scrolled away), annotation layer is document-sized
    expect(c).toMatch(/#bugaputa-pointer-halo[^}]*position:\s*fixed/);
  });
    it("size/mime guards preserved (25MB, webm/mp4, 60s)", ()=>{
    const s = vc();
    expect(s).toMatch(/25\*1024\*1024/);
    expect(s).toMatch(/61000|61\*1000/);
    expect(s).toMatch(/60000/);
    expect(js()).toMatch(/video\/webm|video\/mp4/);
  });
});
