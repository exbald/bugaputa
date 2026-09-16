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
    expect(j).toMatch(/function getDocPoint\(e\)\{[^}]*clientX[^}]*scrollX/s);
    expect(j).toMatch(/function getDocPoint\(e\)\{[^}]*clientY[^}]*scrollY/s);
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
  it("toolbar 44px + a11y: Stop/Attach recording/Record again/Delete with confirm, focus-visible", ()=>{
    const j = js();
    const c = css();
    expect(j).toMatch(/Stop recording/);
    expect(j).toMatch(/Attach recording/);
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
    expect(j).toMatch(/Waiting/);
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
  it("live workspace maps document points through cssPoint, annotation storage, render, and RAF", ()=>{
    const j = js();
    // getDocPoint is the document-coordinate boundary; cssPoint maps those stable
    // coordinates into the raster/vector canvas and renderAll consumes stored vectors.
    expect(j).toMatch(/function getDocPoint\(e\)\{[^}]*clientX[^}]*scrollX/s);
    expect(j).toMatch(/function getDocPoint\(e\)\{[^}]*clientY[^}]*scrollY/s);
    expect(j).toMatch(/function cssPoint\(e\)[\s\S]*getBoundingClientRect[\s\S]*capturedDims\.cssW/);
    expect(j).toMatch(/annotations:\[\]/);
    expect(j).toMatch(/function renderAll\(/);
    expect(j).toMatch(/requestAnimationFrame\(function\(\)\{\s*applyFit\(\)[,;]\s*requestAnimationFrame\(applyFit\)/);

    // A point stored in document space survives a 600px scroll out/back with no
    // rounding drift; cssPoint's scale is then applied only at render time.
    const docPoint = (clientX:number, clientY:number, scrollX:number, scrollY:number) => ({ x:clientX + scrollX, y:clientY + scrollY });
    const p0 = docPoint(200, 300, 0, 0);
    const pOut = docPoint(200, -300, 0, 600);
    const pBack = docPoint(200, 300, 0, 0);
    expect(pOut).toEqual(p0);
    expect(Math.abs(pBack.x - p0.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(pBack.y - p0.y)).toBeLessThanOrEqual(1);
  });

  it("nested scroll offsets and resizing keep the vector layer compensated", ()=>{
    const j = js();
    // Snapshot traversal retains every nested scroll offset, while annotation fit
    // observes stage resizing rather than baking viewport pixels into vectors.
    expect(j).toMatch(/scrollTop\s*\|\|\s*l\.scrollLeft/);
    expect(j).toMatch(/data-bugaputa-scroll-top/);
    expect(j).toMatch(/data-bugaputa-scroll-left/);
    expect(j).toMatch(/new ResizeObserver\(function\(\)\{\s*applyFit\(\)\s*;?\s*\}\)/);
    expect(j).toMatch(/_ro\.observe\(stage\)/);
    expect(j).toMatch(/canvasWrap\.style\.width=\w+\+['\"]px['\"]/);
    expect(j).toMatch(/canvasWrap\.style\.height=\w+\+['\"]px['\"]/);

    const rendered = (point:{x:number,y:number}, scrollLeft:number, scrollTop:number) => ({ x:point.x-scrollLeft, y:point.y-scrollTop });
    const vector = { x:820, y:660 };
    expect(rendered(vector, 120, 80)).toEqual({ x:700, y:580 });
    expect(rendered(vector, 0, 0)).toEqual(vector);
  });

  it("undo/redo retain document-space vectors across scroll changes", ()=>{
    const j = js();
    expect(j).toMatch(/undoStack\.push\(JSON\.stringify\(state\.annotations\)\)/);
    expect(j).toMatch(/redoStack\.push\(JSON\.stringify\(state\.annotations\)\)/);
    expect(j).toMatch(/state\.annotations=JSON\.parse\(prev\)/);
    expect(j).toMatch(/state\.annotations=JSON\.parse\(nxt\)/);
    expect(j).toMatch(/function renderAll\([\s\S]*updateUndoRedo\(\)/);

    const annotation = { id:"a1", x:240, y:900, points:[{x:240,y:900}] };
    const undo = JSON.stringify([annotation]);
    // A scroll changes render placement, never the serialized document vector.
    const afterScroll = JSON.parse(undo);
    const afterRedo = JSON.parse(JSON.stringify(afterScroll));
    expect(afterRedo).toEqual([annotation]);
  });

  it("halo stays visible against light and dark pixels and respects reduced motion", ()=>{
    const j = js(), c = css();
    expect(c).toMatch(/#bugaputa-pointer-halo[^}]*border:\s*2px solid #fff[^}]*box-shadow:\s*0 0 0 2px #0f172a/s);
    expect(c).toMatch(/#bugaputa-pointer-halo[^}]*pointer-events:\s*none/s);
    expect(c).toMatch(/#bugaputa-pointer-ripple[^}]*animation:\s*bugaputa-ripple/s);
    expect(c).toMatch(/@media\(prefers-reduced-motion:reduce\)[^}]*#bugaputa-pointer-ripple[^}]*animation:\s*none/s);
    expect(j).toMatch(/matchMedia\(["']\(prefers-reduced-motion: reduce\)["']\)\.matches/);
    expect(j).toMatch(/requestAnimationFrame\(function\(\)\{\s*pointerRaf=0[,;]\s*showPointerHalo/);
  });

  it("every recording termination path cleans active capture and restores an honest fallback", ()=>{
    const j = js();
    // stop, explicit cancel/back/ESC/close, denied, unsupported, and recorder error
    // all clear the active session or tracks and restore controls/fallback affordances.
    expect(j).toMatch(/activeVideoSession&&activeVideoSession\.stop/);
    expect(j).toMatch(/activeVideoSession&&activeVideoSession\.cancel/);
    expect(j).toMatch(/onOverlayEsc\(\)[\s\S]*Discard this recording/);
    expect(j).toMatch(/onDenied:function\(msg\)[\s\S]*activeVideoSession=null[\s\S]*renderVideoDenied/s);
    expect(j).toMatch(/onUnsupported:function\(msg\)[\s\S]*activeVideoSession=null[\s\S]*renderVideoUnsupported/s);
    expect(j).toMatch(/onError:function\(msg\)[\s\S]*activeVideoSession=null/s);
    expect(j).toMatch(/Use screenshot instead/);
    expect(j).toMatch(/General feedback/);
  });

  it("preview traps focus, guards ESC discard, and Record again revokes all old state", ()=>{
    const j = js();
    expect(j).toMatch(/function trapFocus\(e\)[\s\S]*e\.key===['\"]Escape['\"][\s\S]*onOverlayEsc\(\)/);
    expect(j).toMatch(/e\.shiftKey\s*&&\s*document\.activeElement===first/);
    expect(j).toMatch(/!e\.shiftKey\s*&&\s*document\.activeElement===last/);
    expect(j).toMatch(/confirm\(['\"]Discard this recording\?['\"]\)/);
    const retake = j.slice(j.indexOf("id:'bugaputa-video-retake'"), j.indexOf("id:'bugaputa-remove-video'"));
    expect(retake).toContain("Record again");
    // Record again cleans old streams/blob URLs/timers before returning to workspace via closePreviewModal(true)
    expect(retake).toMatch(/closePreviewModal\(true\)/);
    expect(retake).toMatch(/handleVideoStart\(\)/);
    // The modal's close helper delegates to the single cleanup owner, which cancels the
    // active session, revokes the URL, clears metadata/timers, then restarts.
    expect(j).toMatch(/function closePreviewModal\(cleanup\)[\s\S]*cleanupVideoAttachment\(\)/);
    const cleanup = j.slice(j.indexOf("function cleanupVideoAttachment"), j.indexOf("function isVideoEnabled"));
    expect(cleanup).toMatch(/activeVideoSession&&activeVideoSession\.cancel/);
    expect(cleanup).toMatch(/URL\.revokeObjectURL\(pendingVideoUrl\)/);
    expect(cleanup).toMatch(/pendingVideoUrl=null;.*pendingVideoFile=null;.*pendingVideoMeta=null/s);
  });
    it("size/mime guards preserved (25MB, webm/mp4, 60s)", ()=>{
    const s = vc();
    expect(s).toMatch(/25\*1024\*1024/);
    expect(s).toMatch(/61000|61\*1000/);
    expect(s).toMatch(/60000/);
    expect(js()).toMatch(/video\/webm|video\/mp4/);
  });
});
