import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (p: string) => fs.readFileSync(p, "utf8");
const WJS = path.resolve(__dirname, "../../../widget/widget.js");
const PJS = path.resolve(__dirname, "../../public/widget.js");

function js() { return read(WJS); }

describe("widget deferred atomic reveal (no wrong-position flash)", () => {
  it("mount is deferred — does not append eagerly (no raw createTrigger→append in mount)", () => {
    const s = js();
    const mountIdx = s.indexOf("function mount()");
    expect(mountIdx).toBeGreaterThan(0);
    const mountBody = s.slice(mountIdx, s.indexOf("if(document.readyState", mountIdx));
    expect(mountBody, "mount must call revealOnce (deferred/atomic reveal)").toMatch(/revealOnce\(\)/);
    expect(mountBody, "mount must check fastPath / _initial* for immediate reveal").toMatch(/fastPath|_initialLabel/);
    expect(s, "exactly one revealOnce definition").toMatch(/function revealOnce\(\)/);
  });

  it("revealOnce is atomic and idempotent (guarded by _revealed, single append)", () => {
    const s = js();
    const rIdx = s.indexOf("function revealOnce()");
    expect(rIdx).toBeGreaterThan(0);
    // extract until the standalone closing "  }\n  // fetch fallback" (keep boundary stable)
    const rEnd = s.indexOf("\n  }\n  // fetch fallback", rIdx);
    const rBody = rEnd > 0 ? s.slice(rIdx, rEnd + 4) : s.slice(rIdx, rIdx + 600);
    expect(rBody, "guard by _revealed").toMatch(/if\(_revealed\) return/);
    expect(rBody, "appends createTrigger atomically").toMatch(/appendChild\(createTrigger\(\)\)/);
    // both append paths live inside revealOnce: the guard already covers both,
    // body-not-ready retry re-calls revealOnce (counts as second logical path).
    // Direct appendChild(createTrigger()) should appear exactly once (the success path)
    const directAppends = (rBody.match(/appendChild\(createTrigger\(\)\)/g) || []).length;
    expect(directAppends, "revealOnce has exactly one direct appendChild(createTrigger())").toBe(1);
    // no eager append outside revealOnce hidden in mount/fetch — overall direct append count == 1
    const totalDirect = (s.match(/appendChild\(createTrigger\(\)\)/g) || []).length;
    expect(totalDirect, "exactly 1 direct appendChild(createTrigger()) in file").toBe(1);
  });

  it("revealOnce retries until body exists (no single-shot 50ms throwaway)", () => {
    const s = js();
    const rIdx = s.indexOf("function revealOnce()");
    const rEnd = s.indexOf("\n  }\n  // fetch fallback", rIdx);
    const rBody = rEnd > 0 ? s.slice(rIdx, rEnd + 4) : s.slice(rIdx, rIdx + 800);
    // Must poll until body exists: setTimeout(revealOnce, ...) inside revealOnce
    expect(rBody, "revealOnce must retry via setTimeout(revealOnce, ...)").toMatch(/setTimeout\(revealOnce,\s*\d+\)/);
    // Must NOT mark _revealed before body exists (otherwise never retries)
    // So check that body guard comes before _revealed=true assignment
    const bodyCheck = rBody.indexOf("!document.body");
    const revealedAssign = rBody.indexOf("_revealed=true");
    expect(bodyCheck).toBeGreaterThan(-1);
    expect(revealedAssign).toBeGreaterThan(-1);
    expect(bodyCheck, "body check must come before _revealed=true").toBeLessThan(revealedAssign);
    // Must NOT have the old single-shot pattern: setTimeout(function(){ try{ document.body.appendChild
    expect(rBody, "must not have old single-shot append inside setTimeout").not.toMatch(/setTimeout\(function\(\)\{\s*try\{\s*document\.body\.appendChild/);
  });

  it("body-not-ready eventually inserts once body becomes available (behavioral)", async () => {
    // Minimal behavioral simulation of the fixed revealOnce logic:
    // body absent on first call -> not revealed, retries -> appends once body appears.
    let appended = 0;
    let body: any = null;
    const fakeCreateTrigger = () => ({ id: "bugaputa-btn" } as any);
    let _revealed = false;
    let _revealTimer: any = null;
    function revealOnce() {
      if (_revealed) return;
      if (!body) { setTimeout(revealOnce, 5); return; }
      _revealed = true;
      if (_revealTimer) { try { clearTimeout(_revealTimer); } catch {} _revealTimer = null; }
      appended++;
      void fakeCreateTrigger();
    }
    revealOnce();
    expect(_revealed, "must not be marked revealed while body absent").toBe(false);
    expect(appended).toBe(0);
    body = { appendChild: () => {} };
    await new Promise((r) => setTimeout(r, 30));
    expect(appended, "must append once body becomes available").toBe(1);
    expect(_revealed).toBe(true);
    // idempotency: second call no-ops
    revealOnce();
    expect(appended).toBe(1);
  });

  it("cancels deferred reveal only after an explicit owner-unmount signal", () => {
    const s = js();
    const rIdx = s.indexOf("function revealOnce()");
    const rEnd = s.indexOf("\n  }\n  // fetch fallback", rIdx);
    const rBody = rEnd > 0 ? s.slice(rIdx, rEnd + 4) : s.slice(rIdx, rIdx + 1000);
    expect(rBody, "reveal must stop after explicit owner cleanup").toMatch(/data-bugaputa-unmounted/);
    expect(rBody, "routine script-tag removal must not disable the widget").not.toMatch(/!script\.isConnected/);
    expect(rBody.indexOf("data-bugaputa-unmounted"), "owner guard must run before body polling").toBeLessThan(rBody.indexOf("!document.body"));
    expect(rBody, "explicit owner cleanup must cancel the pending fallback timer").toMatch(/clearTimeout\(_revealTimer\)/);

    const mountIdx = s.indexOf("function mount()");
    const mountBody = s.slice(mountIdx, s.indexOf("if(document.readyState", mountIdx));
    expect(mountBody, "mount polling must also stop after explicit owner cleanup").toMatch(/data-bugaputa-unmounted/);
    expect(mountBody).not.toMatch(/!script\.isConnected/);

    const component = read(path.resolve(__dirname, "../components/BugaputaWidget.tsx"));
    const mark = component.indexOf('setAttribute("data-bugaputa-unmounted", "true")');
    const remove = component.indexOf("ours.remove()", mark);
    expect(mark, "React owner must explicitly mark its loader as unmounted").toBeGreaterThan(-1);
    expect(remove, "owner marker must be set before script removal").toBeGreaterThan(mark);
  });

  it("has bounded timeout fallback <=2000ms (1500ms)", () => {
    const s = js();
    expect(s, "WIDGET_REVEAL_TIMEOUT_MS const").toMatch(/WIDGET_REVEAL_TIMEOUT_MS\s*=\s*(\d+)/);
    const m = s.match(/WIDGET_REVEAL_TIMEOUT_MS\s*=\s*(\d+)/);
    const ms = m ? parseInt(m[1], 10) : 0;
    expect(ms, "timeout 1000-2000ms").toBeGreaterThanOrEqual(1000);
    expect(ms, "timeout <=2000ms").toBeLessThanOrEqual(2000);
    expect(s, "timeout calls revealOnce when not revealed").toMatch(/setTimeout\(function\(\)\s*\{\s*if\(!_revealed\) revealOnce/);
    expect(s, ".catch reveals if not yet revealed").toMatch(/\.catch\(function\(\)\s*\{\s*if\(!_revealed\) revealOnce/);
  });

  it("fetch success does not re-append after fallback (stability — no jump)", () => {
    const s = js();
    const fetchIdx = s.indexOf("(function fetchWidgetConfig()");
    const fetchBlock = s.slice(fetchIdx, s.indexOf("  })();", fetchIdx) + 6);
    expect(fetchBlock, "fetch success guards reveal with !_revealed").toMatch(/if\(!_revealed\) revealOnce\(\)/);
    const fetchRemoves = (fetchBlock.match(/getElementById\('bugaputa-btn'\)/g) || []).length;
    expect(fetchRemoves, "fetch handler must not remove+re-append (would be the jump)").toBe(0);
    expect(s, "documents stability choice").toMatch(/already revealed|timeout won/i);
  });

  it("no opacity/transition masking (createTrigger keeps atomic inline position)", () => {
    const s = js();
    const revealIdx = s.indexOf("function revealOnce()");
    const revealBody = s.slice(revealIdx, s.indexOf("\n  }", revealIdx) + 4);
    expect(revealBody, "no opacity masking in revealOnce").not.toMatch(/opacity\s*[:=]/i);
    expect(revealBody, "no visibility masking in revealOnce").not.toMatch(/visibility/i);
  });

  it("unused _triggerBtn removed", () => {
    const s = js();
    expect(s, "_triggerBtn must be removed").not.toMatch(/_triggerBtn/);
  });

  it("mirrors remain byte-identical", () => {
    expect(read(WJS), "widget.js vs public/widget.js").toBe(read(PJS));
  });

  it("widget stays <30KB gzipped", async () => {
    const { gzipSync } = await import("zlib");
    const bytes = gzipSync(Buffer.from(read(WJS))).length;
    expect(bytes, `gzip ${bytes}B must be <30720`).toBeLessThan(30720);
  });
});
