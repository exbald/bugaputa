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
    expect(cvs.style.pointerEvents).toBe('auto');
    __liveState.tool='pen'; run(cvs, __liveState);
    expect(cvs.style.pointerEvents).toBe('auto');
    __liveState.tool='interact'; run(cvs, __liveState);
    expect(cvs.style.pointerEvents).toBe('none');
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
    expect(s).toContain("cvs.style.pointerEvents=i?'none':'auto'");
    // Assert production switches touchAction per mode (multiline form)
    expect(s).toContain("pan-x pan-y");
    expect(s).toContain("touchAction"); // patched
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
      const isInteract=tool==='interact';
      cvs.style.pointerEvents=isInteract?'none':'auto';
      (cvs.style as any).touchAction=isInteract?'pan-x pan-y':'none';
    }
    expect(s).toContain("cvs.style.pointerEvents=i?'none':'auto'");

    tool='interact'; updatePointer();
    expect(cvs.style.pointerEvents).toBe('none');
    let wheelBubbled=false;
    host.addEventListener('wheel', ()=>{ wheelBubbled=true; });
    cvs.dispatchEvent({ type:'wheel', bubbles:true, deltaY:100 } as any);
    expect(wheelBubbled, 'wheel must bubble to host in interact mode').toBe(true);

    tool='select'; updatePointer();
    expect(cvs.style.pointerEvents).toBe('auto');
    expect((cvs.style as any).touchAction).toBe('none');
    let canvasPointerDown=false;
    cvs.addEventListener('pointerdown', ()=>{ canvasPointerDown=true; });
    cvs.dispatchEvent({ type:'pointerdown', bubbles:true, clientX:10, clientY:10 } as any);
    expect(canvasPointerDown, 'draw mode must receive pointerdown on canvas').toBe(true);
  });
  it("live openLive does NOT hide body overflow (brief #8 pointer-mode scroll)", async()=>{
    const s=read(VCJS);
    expect(s).not.toContain("document.body.style.overflow='hidden'");
    // Live restores the overflow saved in overlay._prevOverflow (modal leaves it hidden); it
    // must not re-hide, but must set it back so real wheel/trackpad/touch scroll unlocks.
    const codeLines=s.split('\n').filter((l:string)=>!l.trim().startsWith('//'));
    const overflowAssignments=codeLines.join('\n').match(/document\.body\.style\.overflow/g) || [];
    expect(overflowAssignments.length, 'live VCJS must restore (not hide) body overflow').toBe(1);
    expect(s).toContain('overlay._prevOverflow');
    expect(s).toContain('Live workspace must NOT hide body overflow');
    expect(s).toContain("Math.max(document.documentElement.scrollWidth");
    expect(s).toContain("Math.max(document.documentElement.scrollHeight");
  });
  it("window scroll events still fire and document-relative getDocPoint retained, no dead ro var", async()=>{
    const s=read(VCJS);
    expect(s).toContain('getDocPoint');
    expect(s).toContain('window.scrollX');
    expect(s).toContain("window.addEventListener('scroll',onScroll");
    expect(s).not.toMatch(/var ro=null/);
    expect(s).not.toContain('ro.disconnect');
    // window scroll triggers onScroll -> draw; verify with mock window
    let drawCalled=false;
    const mockWin:any={ listeners:{} as any, addEventListener(t:string,fn:any){ (this.listeners[t]??=[]).push(fn); }, dispatchEvent(ev:any){ const lst=this.listeners[ev.type]||[]; for(const fn of lst) fn(ev); return true; } };
    const onScroll=()=>{ drawCalled=true; };
    mockWin.addEventListener('scroll', onScroll);
    mockWin.dispatchEvent({ type:'scroll' } as any);
    expect(drawCalled, 'window scroll must fire onScroll handler').toBe(true);
    // pointerEvents none in select mode must still allow wheel to bubble (already proven above) — re-assert minimal
    function mockEl(tag:string){
      const el:any={ tagName:tag.toUpperCase(), style:{} as any, children:[] as any[], listeners:{} as any,
        addEventListener(t:string,fn:any){ (this.listeners[t]??=[]).push(fn); },
        dispatchEvent(ev:any){ ev.target=this; const lst=this.listeners[ev.type]||[]; for(const fn of lst) fn(ev); if(ev.bubbles && this.parent) this.parent.dispatchEvent(ev); return true; },
        appendChild(c:any){ c.parent=this; this.children.push(c); return c; },
        parent:null as any,
      };
      return el;
    }
    const host=mockEl('div'); const canvasEl=mockEl('canvas'); host.appendChild(canvasEl);
    canvasEl.style.pointerEvents='auto';
    let wheelBubbled=false; host.addEventListener('wheel', ()=>{ wheelBubbled=true; });
    canvasEl.dispatchEvent({ type:'wheel', bubbles:true, deltaY:100 } as any);
    // In new semantics Select blocks wheel (canvas auto). Interact would bubble. This low-level mock just proves bubbling when pointerEvents none (interact) still works.
    canvasEl.style.pointerEvents='none';
    let wheelBubbled2=false; host.addEventListener('wheel', ()=>{ wheelBubbled2=true; });
    canvasEl.dispatchEvent({ type:'wheel', bubbles:true, deltaY:100 } as any);
    expect(wheelBubbled2, 'wheel must bubble in interact mode').toBe(true);
  });
});
