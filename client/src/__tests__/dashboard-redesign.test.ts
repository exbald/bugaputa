import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readDashboard() {
  return fs.readFileSync(path.resolve(__dirname, "../pages/Dashboard.tsx"), "utf8");
}

describe("Dashboard redesign — search, sort, summary, composer, rows", () => {
  it("search: client-side filter on project name with clear action", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/query/);
    expect(raw).toMatch(/setQuery/);
    expect(raw).toMatch(/Search projects/);
    expect(raw).toMatch(/filteredAndSorted/);
    expect(raw).toMatch(/toLowerCase\(\)/);
    expect(raw).toMatch(/includes/);
    expect(raw).toMatch(/Clear search/);
  });

  it("search empty state shows recovery CTA", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/No projects match/);
    expect(raw).toMatch(/Try a different search term/);
  });

  it("sort: offers name and open sorts, shows only when useful", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/Sort/);
    expect(raw).toMatch(/name-asc/);
    expect(raw).toMatch(/name-desc/);
    expect(raw).toMatch(/open-desc/);
    expect(raw).toMatch(/Most recent/);
    expect(raw).toMatch(/showSort|projects\.length > 2/);
  });

  it("overview strip derived only from available fields, not fabricated", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/summary/);
    expect(raw).toMatch(/Workspaces/);
    expect(raw).toMatch(/openTotal/);
    expect(raw).toMatch(/connectedCount/);
    // Not fabricating counts when not provided
    expect(raw).toMatch(/hasOpen|openReports/);
    expect(raw).toMatch(/hasPresence|presenceStatus/);
  });

  it("composer: inline revealed panel with autofocus, Esc, validation", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/composerOpen/);
    expect(raw).toMatch(/composerInputRef/);
    expect(raw).toMatch(/setComposerOpen/);
    expect(raw).toMatch(/New project/);
    expect(raw).toMatch(/Create project/);
    expect(raw).toMatch(/autoFocus|composerInputRef\.current\?\.focus/);
    expect(raw).toMatch(/Escape/);
    expect(raw).toMatch(/maxLength.*80|80.*maxLength/);
    expect(raw).toMatch(/composerErr/);
    expect(raw).toMatch(/aria-invalid/);
    expect(raw).toMatch(/Enter to create/);
  });

  it("rows: information-dense WorkspaceRow with accessible overflow delete", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/WorkspaceRow/);
    expect(raw).toMatch(/Open project|Open/);
    expect(raw).toMatch(/PresenceBadge/);
    expect(raw).toMatch(/Options for/);
    expect(raw).toMatch(/Delete project/);
    expect(raw).toMatch(/min-h-\[44px\]/);
    expect(raw).toMatch(/focus-visible:ring-2/);
  });

  it("overflow menu not clipped: WorkspaceRow container does not apply overflow-hidden", () => {
    const raw = readDashboard();
    // The absolute Delete menu must escape the row — previous overflow-hidden hid it entirely (P1)
    // Only the menu itself may use overflow-hidden for rounded corners; the row container must not clip
    const rowContainer = raw.match(/return\s*\(\s*<div className=\"group[^>]*>/);
    expect(rowContainer, "WorkspaceRow group container missing").toBeTruthy();
    expect(rowContainer![0]).not.toMatch(/overflow-hidden/);
  });

  it("composer Escape: handled on form/region with focus return to disclosure", () => {
    const raw = readDashboard();
    // P2: Escape must work from input, Cancel, and Create — not only the input field
    expect(raw).toMatch(/newProjectBtnRef/);
    expect(raw).toMatch(/newProjectBtnRef\.current\?\.focus/);
    // region owns Escape via bubbling (covers buttons even if input not focused)
    expect(raw).toMatch(/role=\"region\"/);
    expect(raw).toMatch(/aria-label=\"Create new project\"/);
    const regionIdx = raw.indexOf('role=\"region\"');
    const regionSlice = raw.slice(regionIdx, regionIdx + 600);
    expect(regionSlice).toMatch(/onKeyDown/);
    expect(regionSlice).toMatch(/Escape/);
    expect(regionSlice).toMatch(/newProjectBtnRef/);
  });

  it("composer disabled during initial load (prevents race with listProjects)", () => {
    const raw = readDashboard();
    // must not allow create while loading (mutationVersionRef race)
    expect(raw).toMatch(/disabled=\{creating \|\| loading/);
    // at least input + submit gated
    const hits = raw.match(/disabled=\{creating \|\| loading/g) || [];
    expect(hits.length).toBeGreaterThanOrEqual(2);
  });

  it("composer Cancel: restores focus to New project disclosure", () => {
    const raw = readDashboard();
    const cancelIdx = raw.indexOf("Cancel");
    expect(cancelIdx, "Cancel button missing").toBeGreaterThan(-1);
    // Cancel onClick must return focus to disclosure (already required for Escape)
    const cancelSlice = raw.slice(Math.max(0, cancelIdx - 1200), cancelIdx + 600);
    expect(cancelSlice).toMatch(/newProjectBtnRef\.current\?\.focus\(\)/);
  });

  it("loading announces with sr-only text inside live region", () => {
    const raw = readDashboard();
    const skelIdx = raw.indexOf("DashboardSkeleton");
    expect(skelIdx, "DashboardSkeleton missing").toBeGreaterThan(-1);
    const skelSlice = raw.slice(skelIdx, skelIdx + 1500);
    expect(skelSlice).toMatch(/sr-only/);
    expect(skelSlice).toMatch(/Loading projects/);
    expect(skelSlice).toMatch(/aria-busy/);
    expect(skelSlice).toMatch(/aria-live/);
  });

  it("loading uses skeleton, not lone text", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/DashboardSkeleton/);
    expect(raw).toMatch(/animate-pulse/);
    expect(raw).toMatch(/aria-busy/);
    // Old lone text fallback should not remain as only loading state
    expect(raw).not.toMatch(/Loading projects\.\.\./);
  });

  it("respects prefers-reduced-motion via motion-safe", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/motion-safe:animate-pulse/);
  });

  it("keeps header light workspace aesthetic (no slate-900 header)", () => {
    const layout = fs.readFileSync(path.resolve(__dirname, "../components/Layout.tsx"), "utf8");
    expect(layout).toMatch(/bg-white border-b border-slate-200/);
    expect(layout).toMatch(/<header className="[^"]*bg-white/);
    // header is light; allow bg-slate-900 elsewhere (e.g. avatar)
    expect(layout).not.toMatch(/<header className="[^"]*bg-slate-900/);
  });

  it("composer success: restores focus to New project disclosure", () => {
    const raw = readDashboard();
    // success closes composer while focus is on submit — must return to disclosure like Cancel/Escape
    const createIdx = raw.indexOf("setComposerOpen(false)");
    expect(createIdx, "setComposerOpen(false) missing").toBeGreaterThan(-1);
    const slice = raw.slice(createIdx, createIdx + 800);
    // at least one close path after create should focus disclosure (success path)
    // check broader window includes newProjectBtnRef focus near creation success
    const broader = raw.slice(raw.indexOf("await api.createProject"), raw.indexOf("await api.createProject") + 1200);
    expect(broader).toMatch(/newProjectBtnRef\.current\?\.focus\(\)/);
  });

  it("composer create error uses inline composer alert only (no double alert)", () => {
    const raw = readDashboard();
    const createStart = raw.indexOf("const create = async");
    const delStart = raw.indexOf("const del = async", createStart);
    const createBlock = raw.slice(createStart, delStart > -1 ? delStart : createStart + 2000);
    // error should set composerErr
    expect(createBlock).toMatch(/setComposerErr\(msg\)/);
    // should NOT also set global err on creation failure (double role=alert) — del's setErr is allowed
    expect(createBlock).not.toMatch(/setErr\(msg\)/);
  });

  it("preserves presence refresh and version gating", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/setInterval\(refresh, 60_000\)/);
    expect(raw).toMatch(/visibilitychange/);
    expect(raw).toMatch(/mutationVersionRef/);
    expect(raw).toMatch(/requestVersionRef/);
  });
});
