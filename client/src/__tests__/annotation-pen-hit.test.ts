import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const widgetJs = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");
const publicJs = fs.readFileSync(path.resolve(__dirname, "../../../client/public/widget.js"), "utf8");

function distToSeg(p:{x:number,y:number}, a:{x:number,y:number}, b:{x:number,y:number}){
  const A=p.x-a.x, B=p.y-a.y, C=b.x-a.x, D=b.y-a.y;
  const dot=A*C+B*D, len=C*C+D*D; let t=len?dot/len:0; t=Math.max(0,Math.min(1,t));
  return Math.hypot(p.x-(a.x+C*t), p.y-(a.y+D*t));
}
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
  const dd=Math.hypot(pts[0][0]-pts[pts.length-1][0], pts[0][1]-pts[pts.length-1][1]);
  if(dd>=25) return false;
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
function modelTolFor(scale:number){
  return Math.min(18, Math.max(10, 14/scale));
}

describe("pen stroke hit-testing", () => {
  it("widget pair is byte-identical (mirror parity)", () => {
    expect(widgetJs).toBe(publicJs);
  });

  it("pen branch contains segment-distance check with screen-aware tolerance", () => {
    const penIdx = widgetJs.indexOf("} else if(a.type==='pen'){");
    expect(penIdx).toBeGreaterThan(0);
    const next = widgetJs.indexOf("} else if(a.type==='text')", penIdx);
    const penBranch = widgetJs.slice(penIdx, next);
    // screen-aware tolerance is computed at top of hitTest, shared by arrow+pen
    const hitTestStart = widgetJs.indexOf("function hitTest(pt){");
    const hitTestHead = widgetJs.slice(hitTestStart, penIdx);
    expect(hitTestHead).toMatch(/getBoundingClientRect/);
    expect(hitTestHead).toMatch(/modelTol/);
    expect(widgetJs).toMatch(/capturedDims\.cssW/);
    expect(penBranch).toMatch(/modelTol/);
    expect(penBranch).toMatch(/distToSeg/);
    expect(penBranch).toMatch(/pointInPolygon/);
  });

  it("open stroke mid-segment selects via segment distance, prior point-only would miss", () => {
    // sparse polyline: two vertices far apart; midpoint is 20px from either endpoint?
    // Use horizontal segment 0,0 -> 50,0 ; midpoint at 25,0
    // But to ensure point-only 12px misses, pick query 5px off segment at midpoint: (25, 8)
    // Distance to segment = 8 (< modelTol 14), distance to nearest endpoint = sqrt(25^2+8^2) ~26 >12
    const pts:number[][] = [[0,0],[50,0],[100,0]];
    const pt = {x:25, y:8};
    const dSeg = distToSeg(pt, {x:0,y:0},{x:50,y:0});
    expect(dSeg).toBeCloseTo(8, 5);
    const tol = modelTolFor(1); // desktop scale 1 => 14
    expect(dSeg).toBeLessThan(tol);
    // point-only check would miss:
    const pointHit = pts.some(([x,y])=>Math.hypot(x-pt.x,y-pt.y)<12);
    expect(pointHit).toBe(false);
    // segment check hits
    let segHit=false;
    for(let i=0;i<pts.length-1;i++){
      if(distToSeg(pt, {x:pts[i][0],y:pts[i][1]}, {x:pts[i+1][0],y:pts[i+1][1]}) < tol) segHit=true;
    }
    expect(segHit).toBe(true);
  });

  it("mobile fitted scale keeps tolerance forgiving (14 screen px -> larger model px)", () => {
    // 390 mobile fitted, cssW 1280 => scale 0.3
    const tol = modelTolFor(390/1280);
    expect(tol).toBeGreaterThan(14);
    expect(tol).toBeLessThanOrEqual(18);
    // mid-segment still hits even with slightly larger offset
    const pts:number[][]=[[0,100],[120,100]];
    const pt={x:60,y:108}; // 8px off segment
    expect(distToSeg(pt,{x:0,y:100},{x:120,y:100})).toBeLessThan(tol);
  });

  it("closed loop center hits via interior (even if stroke distant)", () => {
    const closed=circlePoints(200,200,50,24);
    expect(pointInPolygon({x:200,y:200}, closed)).toBe(true);
    // interior hit should be considered regardless of segment proximity
  });

  it("single-dot pen still hits near point", () => {
    const pts:number[][]=[[80,80]];
    const pt={x:84,y:82};
    const tol=modelTolFor(1);
    const hit = pts.some(([x,y])=>Math.hypot(x-pt.x,y-pt.y)<tol);
    expect(hit).toBe(true);
  });

  it("far click does not steal nearby annotation", () => {
    const pts:number[][]=[[10,10],[60,10]];
    const pt={x:10,y:60};
    const d=distToSeg(pt,{x:10,y:10},{x:60,y:10});
    expect(d).toBeGreaterThan(modelTolFor(1));
  });

  it("arrow also uses screen-aware tolerance", () => {
    const arrowIdx = widgetJs.indexOf("} else if(a.type==='arrow'){");
    const arrowEnd = widgetJs.indexOf("} else if(a.type==='pen')", arrowIdx);
    const arrowBranch = widgetJs.slice(arrowIdx, arrowEnd);
    expect(arrowBranch).toMatch(/modelTol/);
  });
});
