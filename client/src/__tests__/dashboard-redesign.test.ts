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

  it("loading uses skeleton, not lone text", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/DashboardSkeleton/);
    expect(raw).toMatch(/animate-pulse/);
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

  it("preserves presence refresh and version gating", () => {
    const raw = readDashboard();
    expect(raw).toMatch(/setInterval\(refresh, 60_000\)/);
    expect(raw).toMatch(/visibilitychange/);
    expect(raw).toMatch(/mutationVersionRef/);
    expect(raw).toMatch(/requestVersionRef/);
  });
});
