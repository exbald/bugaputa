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
    // mount must not do bare createTrigger()+append; it must use revealOnce or guarded path
    // We extract mount body and assert it contains revealOnce or no direct append
    const mountIdx = s.indexOf("function mount()");
    expect(mountIdx).toBeGreaterThan(0);
    const mountBody = s.slice(mountIdx, s.indexOf("if(document.readyState", mountIdx));
    // mount must reference revealOnce (deferred path) and fastPath
    expect(mountBody, "mount must call revealOnce (deferred/atomic reveal)").toMatch(/revealOnce\(\)/);
    expect(mountBody, "mount must check fastPath / _initial* for immediate reveal").toMatch(/fastPath|_initialLabel/);
    // mount must NOT do unconditional appendChild(createTrigger())
    // (fastPath may, but generic must be via revealOnce)
    // Ensure overall file has exactly one place that appends via revealOnce as primary trigger
    expect(s, "exactly one revealOnce definition").toMatch(/function revealOnce\(\)/);
  });

  it("revealOnce is atomic and idempotent (guarded by _revealed, single append)", () => {
    const s = js();
    const rIdx = s.indexOf("function revealOnce()");
    expect(rIdx).toBeGreaterThan(0);
    const rBody = s.slice(rIdx, s.indexOf("\n  }", rIdx) + 4);
    expect(rBody, "guard by _revealed").toMatch(/if\(_revealed\) return/);
    expect(rBody, "appends createTrigger atomically").toMatch(/appendChild\(createTrigger\(\)\)/);
    // both appends live inside revealOnce (main + body-not-ready retry via setTimeout)
    const appends = (s.match(/appendChild\(createTrigger\(\)\)/g) || []).length;
    expect(appends, "exactly 2 appendChild(createTrigger()) — both inside revealOnce").toBe(2);
    // no append outside revealOnce (mount + fetch must not append directly)
    const mountFetchSlice = s.slice(s.indexOf("function mount()"));
    expect(mountFetchSlice, "mount must not append directly").not.toMatch(/appendChild\(createTrigger\(\)\)/);
  });

  it("has bounded timeout fallback <=2000ms (1500ms)", () => {
    const s = js();
    // constant + setTimeout use
    expect(s, "WIDGET_REVEAL_TIMEOUT_MS const").toMatch(/WIDGET_REVEAL_TIMEOUT_MS\s*=\s*(\d+)/);
    const m = s.match(/WIDGET_REVEAL_TIMEOUT_MS\s*=\s*(\d+)/);
    const ms = m ? parseInt(m[1], 10) : 0;
    expect(ms, "timeout 1000-2000ms").toBeGreaterThanOrEqual(1000);
    expect(ms, "timeout <=2000ms").toBeLessThanOrEqual(2000);
    // timeout schedules revealOnce if not revealed
    expect(s, "timeout calls revealOnce when not revealed").toMatch(/setTimeout\(function\(\)\s*\{\s*if\(!_revealed\) revealOnce/);
    // failure path also reveals
    expect(s, ".catch reveals if not yet revealed").toMatch(/\.catch\(function\(\)\s*\{\s*if\(!_revealed\) revealOnce/);
  });

  it("fetch success does not re-append after fallback (stability — no jump)", () => {
    const s = js();
    // fetch handler block should contain: if(!_revealed) revealOnce() and NOT remove()+append after revealed
    const fetchIdx = s.indexOf("(function fetchWidgetConfig()");
    const fetchBlock = s.slice(fetchIdx, s.indexOf("  })();", fetchIdx) + 6);
    expect(fetchBlock, "fetch success guards reveal with !_revealed").toMatch(/if\(!_revealed\) revealOnce\(\)/);
    // Regression: must not do remove()+re-append (the old jump). There should be zero
    // getElementById('bugaputa-btn') + remove + createTrigger in the same handler.
    // The only allowed remove is inside createTrigger's own dedup, not a remove-then-append in fetch handler.
    const fetchRemoves = (fetchBlock.match(/getElementById\('bugaputa-btn'\)/g) || []).length;
    expect(fetchRemoves, "fetch handler must not remove+re-append (would be the jump)").toBe(0);
    // Late fetch comment present
    expect(s, "documents stability choice").toMatch(/already revealed|timeout won/i);
  });

  it("no opacity/transition masking (createTrigger keeps atomic inline position)", () => {
    const s = js();
    // The file should not introduce opacity:0 -> 1 trick or visibility:hidden on the trigger
    // (toolbar opacity toggles elsewhere are allowed)
    const revealIdx = s.indexOf("function revealOnce()");
    const revealBody = s.slice(revealIdx, s.indexOf("\n  }", revealIdx) + 4);
    expect(revealBody, "no opacity masking in revealOnce").not.toMatch(/opacity\s*[:=]/i);
    expect(revealBody, "no visibility masking in revealOnce").not.toMatch(/visibility/i);
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
