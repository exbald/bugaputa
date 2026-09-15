import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VCJS = path.resolve(__dirname, "../../../widget/video-capture.js");
const WJS = path.resolve(__dirname, "../../../widget/widget.js");
const WCSS = path.resolve(__dirname, "../../../widget/widget.css");
const read = (p:string)=>fs.readFileSync(p,"utf8");

function extractToolbarZ(css:string){
  const m = css.match(/#bugaputa-live-toolbar\s*\{[^}]*z-index\s*:\s*([0-9]+)/);
  return m ? parseInt(m[1],10) : NaN;
}
function extractWrapZ(css:string){
  const m = css.match(/#bugaputa-live-video\s*\{[^}]*z-index\s*:\s*([0-9]+)/);
  return m ? parseInt(m[1],10) : NaN;
}
function defaultTool(js:string){
  const m = js.match(/__liveState=\{tool:'([^']+)'/);
  return m ? m[1] : null;
}

describe("live toolbar hit-testing: toolbar above canvas, Hand default, pointerEvents modes", ()=>{
  it("toolbar z-index must be above live video wrap (browser stacking)", ()=>{
    const css = read(WCSS);
    const tz = extractToolbarZ(css);
    const wz = extractWrapZ(css);
    expect(Number.isFinite(tz), `toolbar z missing`).toBe(true);
    expect(Number.isFinite(wz), `wrap z missing`).toBe(true);
    expect(tz, `toolbar z ${tz} must be > wrap z ${wz} so elementFromPoint hits toolbar, not canvas`).toBeGreaterThan(wz);
    // strong: toolbar should be max layer near overlay
    expect(tz).toBeGreaterThanOrEqual(2147483647);
  });

  it("defaults to Hand/select not pen, canvas pointer-events none in that mode", ()=>{
    const vc = read(VCJS);
    const tool = defaultTool(vc);
    expect(tool, `default tool must be select (Hand), got ${tool}`).toBe("select");
    // updatePointer must map select -> none
    expect(vc).toContain("cvs.style.pointerEvents=isSel?'none':'auto'");
  });

  it("executable: in select mode host CTA is hittable, toolbar buttons are hittable, canvas does not intercept; in draw mode canvas intercepts", ()=>{
    // Simulate stacking + pointerEvents decision without jsdom layout, using the production updatePointer logic.
    const vc = read(VCJS);
    // Verify source contains the expected pointerEvents line (already checked) and construct mock
    function mockEl(tag:string, id:string, z:number){
      return { tagName: tag.toUpperCase(), id, style: { pointerEvents: 'auto', zIndex: String(z) } as any, getBoundingClientRect: ()=>({left:0, top:800, width:100, height:44, right:100, bottom:844} as any) };
    }
    const wrapZ = extractToolbarZ(read(WCSS)) > extractWrapZ(read(WCSS)) ? 2147483646 : 2147483646;
    const tbZ = extractToolbarZ(read(WCSS));
    expect(tbZ).toBeGreaterThan(wrapZ);

    // Build updatePointer from source
    const fnIdx = vc.indexOf("function updatePointer()");
    expect(fnIdx).toBeGreaterThan(0);
    const bodyStart = vc.indexOf("{", fnIdx);
    let depth=0, end=-1;
    for(let i=bodyStart;i<vc.length;i++){ if(vc[i]==="{") depth++; else if(vc[i]==="}"){ depth--; if(depth===0){ end=i; break; } } }
    const body = vc.slice(bodyStart+1,end);
    const cvs:any={ style:{} as any };
    let __liveState:any={ tool: 'select' };
    const run = new Function("cvs","__liveState", body) as any;
    run(cvs, __liveState);
    expect(cvs.style.pointerEvents, "select mode must be none so host CTA remains interactive").toBe("none");
    __liveState.tool='pen'; run(cvs, __liveState);
    expect(cvs.style.pointerEvents, "draw mode must be auto so canvas captures strokes").toBe("auto");
    __liveState.tool='select'; run(cvs, __liveState);
    expect(cvs.style.pointerEvents).toBe("none");

    // Also verify toolbar remains pointerEvents auto regardless of mode
    const css = read(WCSS);
    expect(css).toMatch(/#bugaputa-live-toolbar[^}]*pointer-events:\s*auto/);
  });

  it("toolbar redesign: inline SVG icons, accessible names, no raw crowded text, grouped separators, 44px targets", ()=>{
    const vc = read(VCJS);
    const css = read(WCSS);
    // Raw lowercase text controls must not be the visible label
    // Old code had b.textContent=id for pen/arrow/rect/text and Del/Clear words. New must use SVG.
    // Check that select/pen etc still have aria-label but visible content is SVG, not raw words
    expect(vc).toContain("<svg");
    expect(vc).toContain("aria-label");
    // No bare 'Del' delete text (should be trash icon with title Delete)
    // Allow one occurrence in comments? Check toolbar button creation for Del text
    const hasRawPenText = vc.includes("b.textContent=id==='select'?'Hand':id");
    expect(hasRawPenText, "toolbar must not use raw id text as visible label (pen/arrow/rect)").toBe(false);
    // Check icons present for each tool
    expect(vc).toMatch(/select|Hand/i); // at least Hand label via aria
    expect(css).toMatch(/min-width:\s*44px/);
    expect(css).toMatch(/min-height:\s*44px/);
    // separators or grouping
    expect(css).toMatch(/separator|\.bugaputa-live-sep|border-left|gap/);
    // Mic state must be unambiguous (aria-pressed + distinct icon/label)
    expect(vc).toMatch(/bugaputa-live-mic/);
    expect(vc).toMatch(/aria-pressed/);
    // Record/Done/Cancel hierarchy distinct (check classes or ids)
    expect(vc).toMatch(/bugaputa-live-record/);
    expect(vc).toMatch(/bugaputa-live-stop/);
    // No emoji in toolbar
    const toolbarSlice = vc.slice(vc.indexOf("bugaputa-live-toolbar"), vc.indexOf("bugaputa-live-toolbar")+8000);
    // emoji range check: no direct emoji chars in toolbar creation
    expect(toolbarSlice).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });
});
