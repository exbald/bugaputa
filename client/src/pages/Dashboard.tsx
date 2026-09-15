import { useEffect, useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { TopNav } from "../components/Layout";
import { formatRecency, buildPresenceTooltip, presenceBadgeLabel } from "../lib/presence";
import type { PresenceStatus } from "../lib/presence";

type Project = {
  id: string;
  name: string;
  createdAt?: string;
  created_at?: string;
  totalReports?: number;
  openReports?: number;
  lastReportAt?: string | null;
  presenceStatus?: PresenceStatus;
  lastSeenAt?: string | null;
  lastSeenOrigin?: string | null;
  presenceOriginCount?: number;
  [k: string]: unknown;
};

type SortKey = "recent" | "name-asc" | "name-desc" | "open-desc";

function formatDate(v: string | undefined | null) {
  if (!v) return "";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return "";
  }
}

function buildSummaryParts(
  project: { totalReports?: number; openReports?: number; lastReportAt?: string | null },
  fmt: (v: string | null) => string,
) {
  const parts: string[] = [];
  if (typeof project.totalReports === "number")
    parts.push(`${project.totalReports} ${project.totalReports === 1 ? "report" : "reports"}`);
  if (typeof project.openReports === "number") parts.push(`${project.openReports} open`);
  if (project.lastReportAt) parts.push(`last ${fmt(project.lastReportAt)}`);
  return parts;
}

function PresenceBadge({ project }: { project: Project }) {
  const status: PresenceStatus =
    project.presenceStatus === "connected" ||
    project.presenceStatus === "inactive" ||
    project.presenceStatus === "never"
      ? project.presenceStatus
      : "never";
  const recency = formatRecency(project.lastSeenAt ?? null);
  const label = presenceBadgeLabel(status);
  const primaryText = status === "never" || !recency ? label : `${label} · ${recency}`;
  const tooltip = buildPresenceTooltip({
    presenceStatus: status,
    lastSeenAt: project.lastSeenAt ?? null,
    lastSeenOrigin: project.lastSeenOrigin ?? null,
    presenceOriginCount: project.presenceOriginCount ?? 0,
  });
  const dotColor =
    status === "connected" ? "#22c55e" : status === "inactive" ? "#f59e0b" : "#94a3b8";
  const badgeClasses =
    status === "connected"
      ? "bg-green-50 border-green-200 text-green-800"
      : status === "inactive"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-slate-50 border-slate-200 text-slate-600";

  return (
    <span
      role="status"
      aria-label={tooltip}
      title={tooltip}
      className={`inline-flex flex-shrink-0 max-w-[200px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none whitespace-nowrap ${badgeClasses}`}
    >
      <span
        aria-hidden="true"
        className={`inline-block rounded-full${status === "connected" ? " motion-safe:animate-pulse" : ""}`}
        style={{ width: 8, height: 8, background: dotColor, flexShrink: 0 }}
      />
      <span className="truncate">{primaryText}</span>
    </span>
  );
}

function WorkspaceRow({
  project,
  onDelete,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
}: {
  project: Project;
  onDelete: (id: string) => void;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onCloseMenu();
      btnRef.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseMenu();
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isMenuOpen, onCloseMenu]);

  const totalReports =
    typeof project.totalReports === "number" ? project.totalReports : undefined;
  const openReports =
    typeof project.openReports === "number" ? project.openReports : undefined;
  const lastReportAt =
    typeof project.lastReportAt === "string" ? project.lastReportAt : null;

  const hasSummary =
    totalReports !== undefined ||
    openReports !== undefined ||
    Boolean(lastReportAt);

  return (
    <div className="group bg-white border border-slate-200 rounded-xl sm:rounded-2xl hover:border-slate-300 hover:shadow-sm transition min-w-0">
      {/* Desktop: dense horizontal row. Mobile: compact stacked panel */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 py-4 sm:px-5 sm:py-4 min-w-0">
        {/* Primary: name + meta + presence */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex-1 min-w-0">
              <Link
                to={"/p/" + project.id}
                className="font-semibold text-[15px] leading-tight text-slate-900 hover:text-slate-700 truncate block focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 rounded-sm"
                title={project.name}
              >
                {project.name}
              </Link>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 min-w-0">
                <span className="text-xs text-slate-500">
                  Created {formatDate((project.createdAt ?? project.created_at) as string | undefined) || "—"}
                </span>
                {hasSummary && (
                  <span className="inline-flex flex-wrap items-center gap-1 text-xs text-slate-500 min-w-0">
                    <span className="text-slate-300" aria-hidden>
                      {"·"}
                    </span>
                    {buildSummaryParts({ totalReports, openReports, lastReportAt }, formatDate).map(
                      (text, i) => (
                        <span key={i} className="inline-flex items-center gap-1">
                          {i > 0 && <span className="mx-1 text-slate-300">{"·"}</span>}
                          <span>{text}</span>
                        </span>
                      ),
                    )}
                  </span>
                )}
              </div>
            </div>
            <div className="hidden sm:block flex-shrink-0">
              <PresenceBadge project={project} />
            </div>
          </div>
          <div className="sm:hidden">
            <PresenceBadge project={project} />
          </div>
        </div>

        {/* Actions: open + overflow */}
        <div className="flex items-center gap-2 shrink-0 sm:ml-2">
          <Link
            to={"/p/" + project.id}
            className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-900 hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 transition flex-1 sm:flex-none"
          >
            Open <span aria-hidden>{"→"}</span>
          </Link>

          <div className="relative flex-shrink-0">
            <button
              ref={btnRef}
              type="button"
              aria-label={`Options for ${project.name}`}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={(e) => {
                e.stopPropagation();
                onToggleMenu();
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  onCloseMenu();
                  btnRef.current?.focus();
                }
              }}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1 transition"
            >
              <span aria-hidden className="text-base leading-none">
                {"…"}
              </span>
            </button>

            {isMenuOpen && (
              <div
                ref={menuRef}
                role="menu"
                aria-label={`Actions for ${project.name}`}
                className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-10 overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  role="menuitem"
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                    onDelete(project.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.stopPropagation();
                      onCloseMenu();
                      btnRef.current?.focus();
                    }
                  }}
                  className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 focus:outline-none focus-visible:bg-red-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-200 min-h-[44px]"
                >
                  Delete project
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-6 space-y-3" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading projects…</span>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-white border border-slate-200 rounded-xl sm:rounded-2xl px-4 py-4 sm:px-5 sm:py-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0 space-y-3">
              <div className="h-4 w-40 bg-slate-100 rounded motion-safe:animate-pulse" />
              <div className="h-3 w-56 bg-slate-100 rounded motion-safe:animate-pulse" />
              <div className="h-5 w-32 bg-slate-100 rounded-full motion-safe:animate-pulse sm:hidden" />
            </div>
            <div className="hidden sm:block h-6 w-28 bg-slate-100 rounded-full motion-safe:animate-pulse shrink-0" />
            <div className="flex gap-2">
              <div className="h-11 w-24 bg-slate-100 rounded-xl motion-safe:animate-pulse" />
              <div className="h-11 w-11 bg-slate-100 rounded-xl motion-safe:animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerErr, setComposerErr] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const composerInputRef = useRef<HTMLInputElement>(null);
  const newProjectBtnRef = useRef<HTMLButtonElement>(null);
  const mutationVersionRef = useRef(0);
  const requestVersionRef = useRef(0);

  const nameTrimmed = name.trim();
  const nameValid = nameTrimmed.length > 0 && nameTrimmed.length <= 80;

  const load = async (showLoading = true) => {
    const requestVersion = ++requestVersionRef.current;
    const mutationVersion = mutationVersionRef.current;
    if (showLoading) setLoading(true);
    setErr("");
    try {
      const d: unknown = await api.listProjects();
      const obj = d as Record<string, unknown>;
      const arr = Array.isArray(d)
        ? (d as Project[])
        : ((obj.projects ?? obj.items ?? []) as Project[]);
      if (
        requestVersion === requestVersionRef.current &&
        mutationVersion === mutationVersionRef.current
      )
        setProjects(arr);
    } catch (e: unknown) {
      if (requestVersion === requestVersionRef.current) {
        const msg = e instanceof Error ? e.message : "Failed to load";
        setErr(msg);
      }
    } finally {
      if (requestVersion === requestVersionRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  useEffect(() => {
    if (composerOpen) composerInputRef.current?.focus();
  }, [composerOpen]);

  // overflow menu outside-click + Escape handled per-row via WorkspaceRow mousedown+contains with focus return

  const create = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nameTrimmed) {
      setComposerErr("Enter a project name.");
      composerInputRef.current?.focus();
      return;
    }
    if (nameTrimmed.length > 80) {
      setComposerErr("Project name must be 80 characters or fewer.");
      return;
    }
    setCreating(true);
    setComposerErr("");
    mutationVersionRef.current += 1;
    try {
      const p: unknown = await api.createProject(nameTrimmed);
      const proj = (p as Record<string, unknown>).project ?? p;
      mutationVersionRef.current += 1;
      setProjects((prev) => [
        proj as Project,
        ...prev.filter((item) => item.id !== (proj as Project).id),
      ]);
      setName("");
      setComposerOpen(false);
      setComposerErr("");
    } catch (e: unknown) {
      mutationVersionRef.current += 1;
      const msg = e instanceof Error ? e.message : "Failed to create";
      setComposerErr(msg);
      setCreating(false);
      setTimeout(() => composerInputRef.current?.focus(), 0);
      return;
    }
    setCreating(false);
    // Focus after re-enabling disclosure (disabled={creating}) so .focus() not ignored — next tick
    setTimeout(() => newProjectBtnRef.current?.focus(), 0);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this project and all its reports? This cannot be undone.")) return;
    mutationVersionRef.current += 1;
    try {
      await api.deleteProject(id);
      mutationVersionRef.current += 1;
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e: unknown) {
      mutationVersionRef.current += 1;
      const msg = e instanceof Error ? e.message : "Failed to delete";
      setErr(msg);
    }
  };

  // Overview derived only from available fields — no fabricated values
  const summary = useMemo(() => {
    const total = projects.length;
    let openTotal: number | null = null;
    let connectedCount: number | null = null;
    let hasOpen = false;
    let hasPresence = false;
    for (const p of projects) {
      if (typeof p.openReports === "number") {
        hasOpen = true;
        openTotal = (openTotal ?? 0) + p.openReports;
      }
      if (p.presenceStatus === "connected" || p.presenceStatus === "inactive" || p.presenceStatus === "never") {
        hasPresence = true;
      }
    }
    if (hasPresence) {
      connectedCount = projects.filter((p) => p.presenceStatus === "connected").length;
    }
    return {
      total,
      openTotal: hasOpen ? openTotal : null,
      connectedCount: hasPresence ? connectedCount : null,
    };
  }, [projects]);

  const filteredAndSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : [...projects];
    if (sort === "name-asc") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "name-desc") list.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === "open-desc")
      list.sort((a, b) => (b.openReports ?? 0) - (a.openReports ?? 0) || a.name.localeCompare(b.name));
    // "recent" preserves backend order (createdAt DESC)
    return list;
  }, [projects, query, sort]);

  const showSort = projects.length > 2;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav />
      <main className="max-w-6xl mx-auto w-full px-4 py-6 sm:py-8 flex-1 min-w-0">
        {/* Page header — concise hierarchy with dominant primary action */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-[22px] sm:text-2xl font-bold tracking-tight text-slate-900 leading-tight">
                Projects
              </h1>
              <p className="text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
                Each project is a workspace for its feedback inbox, widget, and install snippet.
              </p>
            </div>
            <button
              ref={newProjectBtnRef}
              type="button"
              disabled={creating}
              onClick={() => {
                if (creating) return;
                setComposerOpen((v) => !v);
                setComposerErr("");
              }}
              aria-expanded={composerOpen}
              aria-controls="new-project-composer"
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-xl bg-lime-500 text-slate-900 text-sm font-semibold hover:bg-lime-400 active:bg-lime-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 transition shrink-0 shadow-sm disabled:opacity-60"
            >
              <span aria-hidden className="text-base leading-none">
                +
              </span>
              New project
            </button>
          </div>

          {/* Inline composer — revealed, no navigation, autofocus, Enter/Esc, validation */}
          {composerOpen && (
            <div
              id="new-project-composer"
              className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm"
              role="region"
              aria-label="Create new project"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setComposerOpen(false);
                  setName("");
                  setComposerErr("");
                  newProjectBtnRef.current?.focus();
                }
              }}
            >
              <form
                onSubmit={create}
                className="flex flex-col sm:flex-row gap-3 sm:items-start"
                noValidate
              >
                <div className="flex-1 min-w-0">
                  <label htmlFor="project-name-input" className="sr-only">
                    Project name
                  </label>
                  <input
                    id="project-name-input"
                    ref={composerInputRef}
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (composerErr) setComposerErr("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.stopPropagation();
                        setComposerOpen(false);
                        setName("");
                        setComposerErr("");
                        newProjectBtnRef.current?.focus();
                      }
                    }}
                    disabled={creating || loading}
                    placeholder="Project name"
                    aria-label="Project name"
                    aria-invalid={Boolean(composerErr)}
                    aria-describedby={composerErr ? "composer-error" : undefined}
                    maxLength={80}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500 disabled:opacity-50"
                  />
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <div className="min-h-[18px] flex-1">
                      {composerErr && (
                        <p id="composer-error" role="alert" className="text-xs text-red-600">
                          {composerErr}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 tabular-nums shrink-0" aria-hidden>
                      {nameTrimmed.length}/80
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setComposerOpen(false);
                      setName("");
                      setComposerErr("");
                      newProjectBtnRef.current?.focus();
                    }}
                    disabled={creating || loading}
                    className="min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || loading || !nameValid}
                    className="min-h-[44px] px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 transition"
                  >
                    {creating ? "Creating…" : "Create project"}
                  </button>
                </div>
              </form>
              <p className="text-xs text-slate-500 mt-3">Press Enter to create, Esc to cancel.</p>
            </div>
          )}
        </div>

        {/* Global error — stable, no layout jump for empty/loading siblings */}
        {err && (
          <div
            role="alert"
            className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3.5 py-3"
          >
            {err}
          </div>
        )}

        {/* Loading skeleton — stable structure, not a lone text line */}
        {loading ? (
          <DashboardSkeleton />
        ) : projects.length === 0 ? (
          <div className="mt-6 border-2 border-dashed border-slate-200 rounded-2xl p-8 sm:p-10 text-center bg-white">
            <div className="mx-auto w-11 h-11 rounded-xl bg-lime-500 flex items-center justify-center text-slate-900 font-bold text-xl" aria-hidden>
              +
            </div>
            <h2 className="mt-4 font-semibold text-slate-900">No projects yet</h2>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
              Create your first workspace to start collecting feedback. Your widget snippet appears inside the project.
            </p>
            {!composerOpen && (
              <button
                type="button"
                onClick={() => setComposerOpen(true)}
                className="mt-5 inline-flex items-center justify-center min-h-[44px] px-5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 transition"
              >
                Create your first project
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Compact overview strip — only from available fields */}
            <div
              className="mt-6 bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
              aria-label="Workspace overview"
            >
              <span className="inline-flex items-center gap-2">
                <span className="text-slate-500">Workspaces</span>
                <span className="font-semibold text-slate-900 tabular-nums">{summary.total}</span>
              </span>
              {summary.openTotal !== null && (
                <span className="inline-flex items-center gap-2">
                  <span className="hidden sm:inline text-slate-300" aria-hidden>
                    {"·"}
                  </span>
                  <span className="text-slate-500">Open feedback</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{summary.openTotal}</span>
                </span>
              )}
              {summary.connectedCount !== null && (
                <span className="inline-flex items-center gap-2">
                  <span className="hidden sm:inline text-slate-300" aria-hidden>
                    {"·"}
                  </span>
                  <span className="text-slate-500">Connected</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{summary.connectedCount}</span>
                </span>
              )}
              <span className="ml-auto text-xs text-slate-400 hidden sm:inline">Updates every minute</span>
            </div>

            {/* Search + sort — progressive, no toolbar clutter */}
            <div className="mt-4 flex flex-col sm:flex-row gap-3 sm:items-center min-w-0">
              <label className="relative flex-1 min-w-0 max-w-full sm:max-w-sm">
                <span className="sr-only">Search projects</span>
                <span
                  aria-hidden
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-70">
                    <path
                      d="M11.5 11.5L14 14M12.5 7.5A5 5 0 1 1 2.5 7.5a5 5 0 0 1 10 0Z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects"
                  aria-label="Search projects"
                  className="w-full border border-slate-200 rounded-xl pl-9 pr-8 py-2.5 text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500 min-h-[44px]"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery("")}
                    className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500"
                  >
                    <span aria-hidden>{"×"}</span>
                  </button>
                )}
              </label>

              {showSort && (
                <label className="inline-flex items-center gap-2 text-sm shrink-0">
                  <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Sort</span>
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    aria-label="Sort projects"
                    className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-lime-500 min-h-[44px] min-w-[160px]"
                  >
                    <option value="recent">Most recent</option>
                    <option value="name-asc">Name A to Z</option>
                    <option value="name-desc">Name Z to A</option>
                    {summary.openTotal !== null && <option value="open-desc">Most open</option>}
                  </select>
                </label>
              )}
            </div>

            {/* Workspace rows */}
            {filteredAndSorted.length === 0 ? (
              <div className="mt-6 bg-white border border-slate-200 rounded-xl p-6 text-center">
                <p className="text-sm font-medium text-slate-900">No projects match &ldquo;{query.trim()}&rdquo;</p>
                <p className="text-sm text-slate-500 mt-1">Try a different search term.</p>
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="mt-4 inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3 min-w-0">
                {filteredAndSorted.map((p) => (
                  <WorkspaceRow
                    key={p.id}
                    project={p}
                    onDelete={del}
                    isMenuOpen={openMenuId === p.id}
                    onToggleMenu={() => setOpenMenuId((cur) => (cur === p.id ? null : p.id))}
                    onCloseMenu={() => setOpenMenuId(null)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
