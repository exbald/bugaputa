import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { TopNav } from "../components/Layout";

type Project = {
  id: string;
  name: string;
  createdAt?: string;
  created_at?: string;
  totalReports?: number;
  openReports?: number;
  lastReportAt?: string | null;
  [k: string]: unknown;
};

function formatDate(v: string | undefined) {
  if (!v) return "";
  try {
    return new Date(v).toLocaleDateString();
  } catch {
    return "";
  }
}

function ProjectCard({
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
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

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
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col min-h-[132px] hover:border-slate-300 hover:shadow-sm transition">
      {/* top row: name + overflow */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={"/p/" + project.id}
            className="font-semibold text-slate-900 hover:text-slate-700 truncate block leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 rounded-sm"
            title={project.name}
          >
            {project.name}
          </Link>
          <div className="text-xs text-slate-500 mt-1">
            Created {formatDate((project.createdAt ?? project.created_at) as string | undefined) || "—"}
          </div>
        </div>

        <div className="relative flex-shrink-0" ref={menuRef}>
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
            className="w-8 h-8 inline-flex items-center justify-center rounded-lg border border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-100 hover:border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-1 transition"
          >
            <span aria-hidden className="text-base leading-none">
              …
            </span>
          </button>

          {isMenuOpen && (
            <div
              role="menu"
              aria-label={`Actions for ${project.name}`}
              className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-10 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                role="menuitem"
                type="button"
                autoFocus
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
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 focus:outline-none focus-visible:bg-red-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-200"
              >
                Delete project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* optional summary row — only when backend provides aggregates */}
      {hasSummary && (
        <div className="mt-3 text-xs text-slate-500 leading-relaxed">
          {totalReports !== undefined && (
            <span>
              {totalReports} {totalReports === 1 ? "report" : "reports"}
            </span>
          )}
          {openReports !== undefined && totalReports !== undefined && (
            <span className="mx-1 text-slate-300">·</span>
          )}
          {openReports !== undefined && totalReports === undefined && (
            <span>{openReports} open</span>
          )}
          {openReports !== undefined && totalReports !== undefined && (
            <span>{openReports} open</span>
          )}
          {lastReportAt && (
            <>
              {(totalReports !== undefined || openReports !== undefined) && (
                <span className="mx-1 text-slate-300">·</span>
              )}
              <span>last {formatDate(lastReportAt)}</span>
            </>
          )}
        </div>
      )}

      {/* spacer pushes CTA to bottom for consistent height */}
      <div className="flex-1" />

      <div className="mt-4">
        <Link
          to={"/p/" + project.id}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-900 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 rounded-sm"
        >
          Open project <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const d: unknown = await api.listProjects();
      const obj = d as Record<string, unknown>;
      const arr = Array.isArray(d)
        ? (d as Project[])
        : ((obj.projects ?? obj.items ?? []) as Project[]);
      setProjects(arr);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  // close overflow on outside click / Esc
  useEffect(() => {
    if (!openMenuId) return;
    const onDocClick = () => setOpenMenuId(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenuId]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const p: unknown = await api.createProject(name.trim());
      const proj = (p as Record<string, unknown>).project ?? p;
      setProjects((prev) => [proj as Project, ...prev]);
      setName("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to create";
      setErr(msg);
    } finally {
      setCreating(false);
    }
  };
  const del = async (id: string) => {
    if (!confirm("Delete this project and all its reports? This cannot be undone.")) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      setErr(msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav />
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500 mt-1">
              Each project is a workspace for its feedback inbox, widget, and install snippet.
            </p>
          </div>
          <form onSubmit={create} className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              aria-label="Project name"
              className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-lime-500 bg-white"
            />
            <button
              disabled={creating || !name.trim()}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 transition"
            >
              Create
            </button>
          </form>
        </div>
        {err && (
          <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
            {err}
          </div>
        )}
        {loading ? (
          <div className="mt-8 text-sm text-slate-500" aria-live="polite">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-8 border-2 border-dashed rounded-2xl p-10 text-center bg-white">
            <div className="text-3xl" aria-hidden>
              +
            </div>
            <h3 className="mt-2 font-semibold text-slate-900">No projects yet</h3>
            <p className="text-sm text-slate-500 mt-1">
              Create your first workspace to start collecting feedback.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onDelete={del}
                isMenuOpen={openMenuId === p.id}
                onToggleMenu={() =>
                  setOpenMenuId((cur) => (cur === p.id ? null : p.id))
                }
                onCloseMenu={() => setOpenMenuId(null)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
