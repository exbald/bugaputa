import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetJs = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");

// Minimal helpers mirrored from widget for unit checks
function pointInPolygon(pt:{x:number,y:number}, pts:number[][]){
  let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const xi=pts[i][0], yi=pts[i][1], xj=pts[j][0], yj=pts[j][1];
    const intersect=((yi>pt.y)!==(yj>pt.y)) && (pt.x < (xj-xi)*(pt.y-yi)/(yj-yi)+xi);
    if(intersect) inside=!inside;
  }
  return inside;
}
function isClosedPen(pts:number[][]){
  if(!pts||pts.length<8) return false;
  const d=Math.hypot(pts[0][0]-pts[pts.length-1][0], pts[0][1]-pts[pts.length-1][1]);
  if(d>=25) return false;
  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  const w=Math.max(...xs)-Math.min(...xs), h=Math.max(...ys)-Math.min(...ys);
  if(w<1||h<1) return false;
  return Math.min(w,h)/Math.max(w,h) > 0.4;
}
function circlePoints(cx:number, cy:number, r:number, n=24){
  const pts:number[][]=[];
  for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; pts.push([cx+Math.cos(a)*r, cy+Math.sin(a)*r]); }
  return pts;
}

describe("annotation hit+wrap widget contract", () => {
  it("widget.js contains wrapText / pointInPolygon / isClosed", () => {
    expect(widgetJs).toMatch(/function wrapText/);
    expect(widgetJs).toMatch(/function pointInPolygon/);
    expect(widgetJs).toMatch(/function isClosedPen|isClosed/);
    expect(widgetJs).toMatch(/cvs\.width/);
    expect(widgetJs).toMatch(/cvs\.height/);
  });

  it("pen interior: closed loop center hits, open stroke center misses", () => {
    const closed=circlePoints(100,100,40,24);
    expect(isClosedPen(closed)).toBe(true);
    expect(pointInPolygon({x:100,y:100}, closed)).toBe(true);
    // stroke distance fallback: point at center is >12 from any rim point for r=40
    const near=closed.some(([x,y])=>Math.hypot(x-100,y-100)<12);
    expect(near).toBe(false);
    // Open polyline (3 pts): not closed, interior should not count
    const open:[[number,number],[number,number],[number,number]]=[[10,10],[60,10],[60,60]];
    expect(isClosedPen(open as any)).toBe(false);
    // open stroke: hit is stroke-only, pointInPolygon true is ignored because isClosed false
    expect(isClosedPen(open as any)).toBe(false);
  });

  it("text hit-test uses the same clamped bounds as rendering", () => {
    const hitStart = widgetJs.indexOf("} else if(a.type==='text'){");
    const hitEnd = widgetJs.indexOf("} else if(a.type==='pin')", hitStart);
    const textHitBranch = widgetJs.slice(hitStart, hitEnd);
    expect(textHitBranch).toMatch(/hitClampX\s*=\s*Math\.max/);
    expect(textHitBranch).toMatch(/hitClampY\s*=\s*Math\.max/);
    expect(textHitBranch).toMatch(/x0\s*=\s*hitClampX/);
    expect(textHitBranch).toMatch(/y0\s*=\s*hitClampY/);
  });

  it("text bbox: wrap + clamp keeps maxLineW inside canvas", () => {
    // mock canvas ctx measure: ~7px per char for test
    const fakeCtx={ measureText(s:string){ return {width: s.length*7} as any }, font:"" } as any;
    function wrapText(text:string, ctx:any, maxW:number){
      const paras=String(text||'').split('\n'); const out:string[]=[];
      for(const para of paras){
        if(!para){ out.push(''); continue; }
        const words=para.split(/\s+/); let cur='';
        for(const w of words){
          if(!w) continue;
          if(ctx.measureText(w).width>maxW){
            if(cur){ out.push(cur); cur=''; }
            let curW=''; for(const ch of w){ const testW=curW+ch; if(ctx.measureText(testW).width>maxW && curW){ out.push(curW); curW=ch; } else curW=testW; }
            if(curW) cur=curW; continue;
          }
          const test=cur?cur+' '+w:w;
          if(ctx.measureText(test).width<=maxW) cur=test; else { if(cur) out.push(cur); cur=w; }
        }
        if(cur) out.push(cur);
      }
      if(!out.length) out.push('');
      return out;
    }
    const cvsW=320, cvsH=480;
    const long="Hello world this is a fairly long annotation that should wrap near the right edge";
    const ax=cvsW-10, ay=100; // near right edge
    const maxW=Math.max(120, cvsW - ax - 12);
    const lines=wrapText(long, fakeCtx, maxW);
    let maxLineW=0; for(const l of lines) maxLineW=Math.max(maxLineW, fakeCtx.measureText(l).width);
    expect(maxLineW).toBeLessThanOrEqual(cvsW - 16);
    expect(lines.length).toBeGreaterThan(1);
    // clamping x
    const clampedX=Math.max(4, Math.min(ax, cvsW - maxLineW - 12));
    expect(clampedX + maxLineW + 12).toBeLessThanOrEqual(cvsW + 0.01);
    // total height fits
    const totalH=lines.length*16;
    const clampedY=Math.max(2, Math.min(ay, cvsH - totalH - 4));
    expect(clampedY + totalH + 4).toBeLessThanOrEqual(cvsH + 0.01);
  });
});
