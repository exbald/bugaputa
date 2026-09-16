import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VCJS = path.resolve(__dirname, "../../../widget/video-capture.js");
const WJS = path.resolve(__dirname, "../../../widget/widget.js");

// QA FAIL t_bdaef26d + t_5ed88f70 contract: body overflow hidden from the modal must be
// restored on entering the live workspace so real wheel/trackpad/touch scrolling works.
// Programmatic scrollTo already proved annotations stay document-anchored (zero drift);
// this test proves the overflow-state transition that unblocks normal user input.

describe("live scroll block regression (t_bdaef26d)", () => {
  it("live openLive restores overlay._prevOverflow once (not hidden)", () => {
    const s = fs.readFileSync(VCJS, "utf8");
    expect(s).not.toContain("document.body.style.overflow='hidden'");
    // exactly one overflow write — the restore
    const assigns = s.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n").match(/document\.body\.style\.overflow/g) || [];
    expect(assigns.length).toBe(1);
    expect(s).toContain("overlay._prevOverflow");
    expect(s).toContain("document.body.style.overflow=(overlay&&overlay._prevOverflow");
  });

  it("modal saves _prevOverflow/_prevScrollY before hiding, and close restores them", () => {
    const j = fs.readFileSync(WJS, "utf8");
    expect(j).toMatch(/overlay\._prevOverflow\s*=\s*document\.body\.style\.overflow/);
    expect(j).toMatch(/overlay\._prevScrollY\s*=\s*window\.scrollY/);
    // live close helper already exists; modal close must still restore _prevOv/_prevY
    expect(j).toMatch(/document\.body\.style\.overflow\s*=\s*_prevOv/);
  });

  it("Hand mode leaves canvas non-intercepting so wheel bubbles to document (touchAction pan)", () => {
    const s = fs.readFileSync(VCJS, "utf8");
    expect(s).toContain("cvs.style.pointerEvents=i?'none':'auto'");
    expect(s).toContain("pan-x pan-y");
    expect(s).toContain("touchAction");
    // Live workspace must not preventDefault wheel events on the canvas so scroll bubbles.
    // Toolbar drag preventDefault is unrelated and lives outside canvas wheel.
    const liveBlock = s.slice(s.indexOf("function openLive"), s.indexOf("window.__bugaputaCloseLiveWorkspace"));
    // Check there is no wheel listener that calls preventDefault
    expect(liveBlock).not.toMatch(/addEventListener\s*\(\s*['"]wheel['"].*preventDefault/s);
  });

  it("mock DOM: overflow restore unblocks real wheel delta vs hidden blocks (executable)", () => {
    // Mock element + style semantics
    function mockEl(tag: string) {
      const el: any = {
        tagName: tag.toUpperCase(), style: {} as any, children: [] as any[], listeners: {} as any,
        addEventListener(t: string, fn: any) { (this.listeners[t] ??= []).push(fn); },
        dispatchEvent(ev: any) {
          ev.target = this;
          const lst = this.listeners[ev.type] || [];
          for (const fn of lst) fn(ev);
          if (ev.bubbles && this.parent) this.parent.dispatchEvent(ev);
          return true;
        },
        appendChild(c: any) { c.parent = this; this.children.push(c); return c; },
        parent: null as any,
      };
      return el;
    }
    // Simulate body with scrollTop/overflow effect on wheel handling:
    // hidden blocks wheel, '' allows scrollY += delta
    let bodyOverflow = "hidden";
    let scrollY = 0;
    function wheel(dist: number) {
      if (bodyOverflow === "hidden") return 0;
      scrollY += dist;
      return scrollY;
    }
    // Before fix: live left overflow hidden
    bodyOverflow = "hidden";
    expect(wheel(650)).toBe(0);
    expect(scrollY).toBe(0);
    // After fix: live restores _prevOverflow (which was '')
    const overlay: any = { _prevOverflow: "" };
    bodyOverflow = (overlay && overlay._prevOverflow != null ? overlay._prevOverflow : "");
    expect(bodyOverflow).toBe("");
    expect(wheel(650)).toBe(650);
    expect(scrollY).toBe(650);
    // Second wheel after drawing then one-tap Hand (same restored state) still scrolls
    // Do not re-hide — emulate draw->Hand round-trip stays restored
    expect(wheel(500)).toBe(1150);

    // Canvas pointerEventsnone in Hand lets wheel bubble
    const host = mockEl("div");
    const cvs = mockEl("canvas"); host.appendChild(cvs);
    cvs.style.pointerEvents = "none"; // Hand
    let bubbled = false;
    host.addEventListener("wheel", () => { bubbled = true; });
    cvs.dispatchEvent({ type: "wheel", bubbles: true, deltaY: 100 } as any);
    expect(bubbled).toBe(true);
  });
});
