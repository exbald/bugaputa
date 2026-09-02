import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { formatRecency, buildPresenceTooltip, presenceBadgeLabel } from "../lib/presence";
import type { PresenceStatus } from "../lib/presence";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("presence helpers", () => {
  describe("formatRecency", () => {
    it("just now for <60s", () => {
      const now = Date.now();
      const iso = new Date(now - 10_000).toISOString();
      expect(formatRecency(iso, now)).toBe("just now");
    });
    it("minutes", () => {
      const now = Date.now();
      const iso = new Date(now - 2 * 60_000).toISOString();
      expect(formatRecency(iso, now)).toBe("2m ago");
    });
    it("hours", () => {
      const now = Date.now();
      const iso = new Date(now - 3 * 3600_000).toISOString();
      expect(formatRecency(iso, now)).toBe("3h ago");
    });
    it("days", () => {
      const now = Date.now();
      const iso = new Date(now - 2 * 86400_000).toISOString();
      expect(formatRecency(iso, now)).toBe("2d ago");
    });
    it("null returns null", () => {
      expect(formatRecency(null)).toBeNull();
      expect(formatRecency(undefined)).toBeNull();
    });
    it("caps at days (no weeks)", () => {
      const now = Date.now();
      const iso = new Date(now - 30 * 86400_000).toISOString();
      expect(formatRecency(iso, now)).toBe("30d ago");
    });
  });

  describe("presenceBadgeLabel", () => {
    it("maps statuses", () => {
      expect(presenceBadgeLabel("never")).toBe("Not connected");
      expect(presenceBadgeLabel("connected")).toBe("Connected");
      expect(presenceBadgeLabel("inactive")).toBe("Inactive");
    });
  });

  describe("buildPresenceTooltip", () => {
    it("never -> not connected message", () => {
      const t = buildPresenceTooltip({
        presenceStatus: "never",
        lastSeenAt: null,
        lastSeenOrigin: null,
        presenceOriginCount: 0,
      });
      expect(t).toMatch(/Not connected/i);
    });
    it("connected with origin and extra count", () => {
      const iso = new Date("2026-09-02T12:03:00.000Z").toISOString();
      const t = buildPresenceTooltip({
        presenceStatus: "connected",
        lastSeenAt: iso,
        lastSeenOrigin: "example.com",
        presenceOriginCount: 2,
      });
      expect(t).toMatch(/Last seen/i);
      expect(t).toMatch(/example\.com/);
      expect(t).toMatch(/\+1 more/);
    });
    it("single origin has no +more", () => {
      const iso = new Date("2026-09-02T12:03:00.000Z").toISOString();
      const t = buildPresenceTooltip({
        presenceStatus: "connected",
        lastSeenAt: iso,
        lastSeenOrigin: "example.com",
        presenceOriginCount: 1,
      });
      expect(t).toMatch(/example\.com/);
      expect(t).not.toMatch(/\+.*more/);
    });
    it("null origin omits domain", () => {
      const iso = new Date("2026-09-02T12:03:00.000Z").toISOString();
      const t = buildPresenceTooltip({
        presenceStatus: "inactive",
        lastSeenAt: iso,
        lastSeenOrigin: null,
        presenceOriginCount: 1,
      });
      expect(t).toMatch(/Last seen/i);
      expect(t).not.toMatch(/on .*example/);
    });
    it("unknown bucket treated as null domain handled upstream; tooltip omits domain when null", () => {
      const iso = new Date().toISOString();
      const t = buildPresenceTooltip({
        presenceStatus: "connected",
        lastSeenAt: iso,
        lastSeenOrigin: null,
        presenceOriginCount: 2,
      });
      expect(t).toMatch(/\+1 more/);
      expect(t).not.toMatch(/on example/);
    });
  });

  describe("Dashboard presence badge (static checks)", () => {
    it("Dashboard.tsx contains PresenceBadge with required a11y and visuals", () => {
      const p = path.resolve(__dirname, "../pages/Dashboard.tsx");
      const raw = fs.readFileSync(p, "utf8");
      expect(raw).toMatch(/PresenceBadge/);
      expect(raw).toMatch(/role="status"/);
      expect(raw).toMatch(/aria-label/);
      expect(raw).toMatch(/title=\{tooltip\}/);
      expect(raw).toMatch(/formatRecency/);
      expect(raw).toMatch(/buildPresenceTooltip/);
      // dot colors
      expect(raw).toMatch(/#22c55e/);
      expect(raw).toMatch(/#f59e0b/);
      expect(raw).toMatch(/#94a3b8/);
      // pulse animation for connected
      expect(raw).toMatch(/animate-pulse/);
      expect(raw).toMatch(/aria-hidden/);
      // rendered verbatim presenceStatus (never default), not recomputed
      expect(raw).toMatch(/presenceStatus/);
      expect(raw).toMatch(/lastSeenAt/);
      expect(raw).toMatch(/lastSeenOrigin/);
      expect(raw).toMatch(/presenceOriginCount/);
      // layout: badge between name (flex-1) and Delete, flex-shrink-0
      expect(raw).toMatch(/flex-1 min-w-0/);
      expect(raw).toMatch(/flex-shrink-0/);
      // grid stays md:grid-cols-2 with explicit mobile track + containment
      expect(raw).toMatch(/md:grid-cols-2/);
      expect(raw).toMatch(/grid-cols-1/);
      expect(raw).toMatch(/min-w-0/);
      expect(raw).toMatch(/overflow-hidden/);
      // Delete action is 44px touch target and row flex is constrained
      expect(raw).toMatch(/min-h-\[44px\]/);
      expect(raw).toMatch(/min-w-\[44px\]/);
      expect(raw).toMatch(/flex items-start justify-between gap-2/);
      // Presence and relative recency refresh without a full page reload.
      expect(raw).toMatch(/setInterval\(refresh, 60_000\)/);
      expect(raw).toMatch(/visibilitychange/);
      expect(raw).toMatch(/load\(false\)/);
      expect(raw).toMatch(/mutationVersionRef\.current \+= 1/);
      expect(raw).toMatch(/requestVersion === requestVersionRef\.current/);
      expect(raw).toMatch(/prev\.filter\(\(item\) => item\.id !==/);
      expect(raw).toMatch(/disabled=\{loading \|\| creating\}/);
    });
  });

  describe("widget heartbeat (static)", () => {
    it("widget.js contains non-blocking presence beacon with required behaviour", () => {
      const raw = fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js"), "utf8");
      expect(raw).toMatch(/presence heartbeat/);
      expect(raw).toMatch(/\/api\/presence\/heartbeat/);
      expect(raw).toMatch(/keepalive:\s*!0|keepalive:\s*true/);
      expect(raw).toMatch(/sendBeacon/);
      expect(raw).toMatch(/new Blob\(\[d\],\{type:'application\/json'\}\)/);
      expect(raw).toMatch(/\.catch\(function\(\)\{q\(h,d\)\}\)/);
      expect(raw).toMatch(/MutationObserver/);
      expect(raw).toMatch(/removeEventListener\('visibilitychange',l\)/);
      expect(raw).toMatch(/bugaputa-presence-ts:/);
      expect(raw).toMatch(/5\s*\*\s*60\s*\*1000/);
      expect(raw).toMatch(/requestIdleCallback/);
      expect(raw).toMatch(/visibilitychange/);
      expect(raw).toMatch(/visibilityState/);
      expect(raw).toMatch(/data-bugaputa-unmounted/);
      expect(raw).toMatch(/location\.hostname/);
      // must be public api fetch, no credentials
      expect(raw).toMatch(/credentials:\s*['\"]omit['\"]/);
    });
    it("widget mirrors remain byte-identical", () => {
      expect(
        fs.readFileSync(path.resolve(__dirname, "../../../widget/widget.js")).equals(
          fs.readFileSync(path.resolve(__dirname, "../../public/widget.js"))
        )
      ).toBe(true);
    });
  });
});
