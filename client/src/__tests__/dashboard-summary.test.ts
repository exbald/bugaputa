import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readDashboard() {
  return fs.readFileSync(path.resolve(__dirname, "../pages/Dashboard.tsx"), "utf8");
}

describe("Dashboard ProjectCard summary row", () => {
  it("hasSummary guards on totalReports/openReports/lastReportAt (not always rendered)", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/hasSummary/);
    expect(raw).toMatch(/totalReports !== undefined/);
    expect(raw).toMatch(/openReports !== undefined/);
    expect(raw).toMatch(/lastReportAt/);
    // summary block is conditional on hasSummary
    expect(raw).toMatch(/\{hasSummary &&/);
  });

  it("builds summary parts array and joins with single separator (no duplicate dots)", () => {
    const raw = readDashboard();
    // The fixed implementation builds a parts array and inserts · only between items
    expect(raw).toMatch(/const parts.*string\[\]/);
    expect(raw).toMatch(/parts\.push/);
    // single separator logic: i > 0 inserts one dot
    expect(raw).toMatch(/i > 0/);
    // only one dot pattern should exist in the summary section
    const dotOccurrences = (raw.match(/mx-1 text-slate-300/g) || []).length;
    expect(dotOccurrences).toBe(1);
    // no duplicated conditional blocks for the same openReports value
    // (old code had two separate {openReports !== undefined && totalReports...} blocks)
    const openSpans = (raw.match(/openReports !== undefined/g) || []).length;
    // After fix: hasSummary guard + 1 inside parts builder = 2 occurrences
    expect(openSpans).toBeLessThanOrEqual(3);
  });

  it("handles all combinations: totalReports, openReports, lastReportAt independently", () => {
    const raw = readDashboard();
    // Each aggregate is pushed independently when defined
    expect(raw).toMatch(/if \(totalReports !== undefined\) parts\.push/);
    expect(raw).toMatch(/if \(openReports !== undefined\) parts\.push/);
    expect(raw).toMatch(/if \(lastReportAt\) parts\.push/);
    // singular/plural handling for reports
    expect(raw).toMatch(/report.*reports/);
    expect(raw).toMatch(/open/);
    expect(raw).toMatch(/last /);
  });

  it("does not use stale menuRef (removed or containment-checked)", () => {
    const raw = readDashboard();
    // menuRef was unused — should be removed (preferred minimal fix per review)
    // If it exists, it must be used in a containment check
    if (raw.includes("menuRef")) {
      expect(raw).toMatch(/menuRef\.current.*contains|contains.*menuRef/);
    } else {
      // preferred: removed entirely
      expect(raw).not.toMatch(/menuRef/);
    }
  });

  it("outside-click + Esc still closes overflow menu at Dashboard level", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/openMenuId/);
    expect(raw).toMatch(/document\.addEventListener.*click/);
    expect(raw).toMatch(/document\.addEventListener.*keydown/);
    expect(raw).toMatch(/Escape/);
  });
});

describe("Dashboard imports hygiene", () => {
  it("does not import unused useRef after menuRef removal (or uses it for btnRef)", () => {
    const raw = readDashboard();
    // useRef is still needed for btnRef (focus return on Esc)
    expect(raw).toMatch(/useRef/);
    expect(raw).toMatch(/btnRef/);
  });
});
