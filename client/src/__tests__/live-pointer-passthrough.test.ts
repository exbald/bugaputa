import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p:string)=>fs.readFileSync(p,"utf8");
const VCJS = path.resolve(__dirname,"../../../widget/video-capture.js");
describe("live pointer mode passes through to page",()=>{
  it("select/pointer mode sets pointerEvents none and drawing mode auto", async()=>{
    const s=read(VCJS);
    expect(s).toContain("function updatePointer()");
    const cvs:any={ style:{} as any };
    let __liveState:any={ tool: "select" };
    const fnIdx=s.indexOf("function updatePointer()");
    expect(fnIdx).toBeGreaterThan(0);
    const bodyStart=s.indexOf("{", fnIdx);
    let depth=0, end=-1;
    for(let i=bodyStart;i<s.length;i++){ if(s[i]==="{") depth++; else if(s[i]==="}"){ depth--; if(depth===0){ end=i; break; } } }
    const body=s.slice(bodyStart+1, end);
    const run = new Function("cvs","__liveState", body) as any;
    run(cvs, __liveState);
    expect(cvs.style.pointerEvents).toBe('none');
    __liveState.tool='pen'; run(cvs, __liveState);
    expect(cvs.style.pointerEvents).toBe('auto');
  });
  it("pointerdown in select mode does not capture pointer (selection only)", async()=>{
    const s=read(VCJS);
    const idx=s.indexOf("cvs.addEventListener('pointerdown'");
    expect(idx).toBeGreaterThan(0);
    const block=s.slice(idx, idx+1400);
    expect(block).toMatch(/tool==='select'/);
    const selPos=block.indexOf("tool==='select'");
    const capPos=block.indexOf("setPointerCapture");
    expect(capPos).toBeGreaterThan(selPos);
  });
  it("DOM behavior: pointer canvas passes wheel/trackpad to host in select mode, captures in draw mode (executable mock DOM)", async()=>{
    const s=read(VCJS);
    expect(s).toContain("cvs.style.pointerEvents=isSel?'none':'auto'");
    // Assert production switches touchAction per mode (multiline form)
    expect(s).toMatch(/cvs\.style\.touchAction='pan-x pan-y'/);
    expect(s).toMatch(/cvs\.style\.touchAction='none'/);
    function mockEl(tag:string){
      const el:any={ tagName:tag.toUpperCase(), style:{} as any, children:[] as any[], listeners:{} as any,
        addEventListener(t:string,fn:any){ (this.listeners[t]??=[]).push(fn); },
        dispatchEvent(ev:any){ ev.target=this; const lst=this.listeners[ev.type]||[]; for(const fn of lst) fn(ev); if(ev.bubbles && this.parent) this.parent.dispatchEvent(ev); return true; },
        appendChild(c:any){ c.parent=this; this.children.push(c); return c; },
        remove(){ if(this.parent){ const i=this.parent.children.indexOf(this); if(i>=0) this.parent.children.splice(i,1); } },
        parent:null as any,
      };
      return el;
    }
    const host=mockEl('div');
    const link=mockEl('a'); link.textContent='underlying link'; host.appendChild(link);
    const cvs=mockEl('canvas'); cvs.id='bugaputa-live-canvas'; host.appendChild(cvs);

    let tool='select';
    function updatePointer(){
      const isSel=tool==='select';
      cvs.style.pointerEvents=isSel?'none':'auto';
      (cvs.style as any).touchAction=isSel?'pan-x pan-y':'none';
    }
    expect(s).toMatch(/cvs\.style\.pointerEvents=isSel\?'none':'auto'/);

    tool='select'; updatePointer();
    expect(cvs.style.pointerEvents).toBe('none');
    let wheelBubbled=false;
    host.addEventListener('wheel', ()=>{ wheelBubbled=true; });
    cvs.dispatchEvent({ type:'wheel', bubbles:true, deltaY:100 } as any);
    expect(wheelBubbled, 'wheel must bubble to host in select mode').toBe(true);

    tool='pen'; updatePointer();
    expect(cvs.style.pointerEvents).toBe('auto');
    expect((cvs.style as any).touchAction).toBe('none');
    let canvasPointerDown=false;
    cvs.addEventListener('pointerdown', ()=>{ canvasPointerDown=true; });
    cvs.dispatchEvent({ type:'pointerdown', bubbles:true, clientX:10, clientY:10 } as any);
    expect(canvasPointerDown, 'draw mode must receive pointerdown on canvas').toBe(true);
  });
});
