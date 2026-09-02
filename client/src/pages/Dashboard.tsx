import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { TopNav } from "../components/Layout";
import { CANONICAL_ORIGIN } from "../lib/canonical";
import { formatRecency, buildPresenceTooltip, presenceBadgeLabel } from "../lib/presence";
import type { PresenceStatus } from "../lib/presence";

function PresenceBadge({
  presenceStatus,
  lastSeenAt,
  lastSeenOrigin,
  presenceOriginCount,
}: {
  presenceStatus?: string;
  lastSeenAt?: string | null;
  lastSeenOrigin?: string | null;
  presenceOriginCount?: number | null;
}) {
  const status: PresenceStatus =
    presenceStatus === "connected" || presenceStatus === "inactive" || presenceStatus === "never"
      ? (presenceStatus as PresenceStatus)
      : "never";
  const recency = formatRecency(lastSeenAt ?? null);
  const label = presenceBadgeLabel(status);
  const primaryText = status === "never" || !recency ? label : `${label} · ${recency}`;
  const tooltip = buildPresenceTooltip({
    presenceStatus: status,
    lastSeenAt: lastSeenAt ?? null,
    lastSeenOrigin: lastSeenOrigin ?? null,
    presenceOriginCount: presenceOriginCount ?? 0,
  });

  const dotColor =
    status === "connected" ? "#22c55e" : status === "inactive" ? "#f59e0b" : "#94a3b8";
  const badgeClasses =
    status === "connected"
      ? "bg-green-50 border-green-200 text-green-800"
      : status === "inactive"
        ? "bg-amber-50 border-amber-200 text-amber-800"
        : "bg-slate-50 border-slate-200 text-slate-600";

  const dotPulse = status === "connected" ? " animate-pulse" : "";

  return (
    <span
      role="status"
      aria-label={tooltip}
      title={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none whitespace-nowrap max-w-[220px] ${badgeClasses}`}
      style={{ flexShrink: 0 }}
    >
      <span
        aria-hidden="true"
        className={`inline-block rounded-full${dotPulse}`}
        style={{ width: 8, height: 8, background: dotColor, flexShrink: 0 }}
      />
      <span className="truncate">{primaryText}</span>
    </span>
  );
}

export default function Dashboard() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const d: any = await api.listProjects();
      const arr = Array.isArray(d) ? d : d.projects || d.items || [];
      setProjects(arr);
    } catch (e: any) {
      setErr(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);
  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const p: any = await api.createProject(name.trim());
      const proj = p.project || p;
      setProjects((prev) => [proj, ...prev]);
      setName("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setCreating(false);
    }
  };
  const del = async (id: string) => {
    if (!confirm("Delete this project and all its reports? This cannot be undone.")) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p: any) => p.id !== id));
    } catch (e: any) {
      setErr(e.message);
    }
  };
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav />
      <main className="max-w-6xl mx-auto w-full px-4 py-8 flex-1">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <p className="text-sm text-slate-500 mt-1">Create a project to get your snippet.</p>
          </div>
          <form onSubmit={create} className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="border rounded-xl px-3 py-2.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-lime-500 bg-white"
            />
            <button
              disabled={creating || !name.trim()}
              className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 min-h-[44px]"
            >
              Create
            </button>
          </form>
        </div>
        {err && (
          <div
            role="alert"
            className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2"
          >
            {err}
          </div>
        )}
        {loading ? (
          <div className="mt-8 text-sm text-slate-500" aria-live="polite">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="mt-8 border-2 border-dashed rounded-2xl p-10 text-center bg-white">
            <div className="text-3xl">+</div>
            <h3 className="mt-2 font-semibold">No projects yet</h3>
            <p className="text-sm text-slate-500 mt-1">
              Create your first project to get the embed snippet.
            </p>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            {projects.map((p: any) => {
              const key = p.publicKey || p.public_key || "";
              const snippet =
                "<scr" +
                'ipt src="' +
                CANONICAL_ORIGIN +
                '/widget.js" data-project="' +
                key +
                '" data-api="' +
                CANONICAL_ORIGIN +
                '"></scr' +
                "ipt>";
              return (
                <div
                  key={p.id}
                  className="bg-white border rounded-2xl p-5 flex flex-col gap-3 min-w-0 overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <Link
                      to={"/p/" + p.id}
                      className="font-semibold hover:underline truncate block flex-1 min-w-0"
                    >
                      {p.name}
                    </Link>
                    <PresenceBadge
                      presenceStatus={p.presenceStatus}
                      lastSeenAt={p.lastSeenAt}
                      lastSeenOrigin={p.lastSeenOrigin}
                      presenceOriginCount={p.presenceOriginCount}
                    />
                    <button
                      onClick={() => del(p.id)}
                      className="flex-shrink-0 inline-flex items-center justify-center text-xs px-3 py-2 rounded-lg border hover:bg-red-50 hover:text-red-600 hover:border-red-200 min-h-[44px] min-w-[44px]"
                    >
                      Delete
                    </button>
                  </div>
                  <div className="text-xs text-slate-500">
                    Created {new Date(p.createdAt || p.created_at || Date.now()).toLocaleDateString()}
                  </div>
                  <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                    <code className="flex-1 min-w-0 bg-slate-900 text-lime-300 text-xs rounded-lg px-3 py-2 truncate overflow-hidden">
                      {key}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(key)}
                      className="px-3 py-2 rounded-lg border text-xs font-medium hover:bg-slate-50 min-h-[36px] flex-shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="bg-slate-50 border rounded-xl p-3 overflow-hidden">
                    <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">
                      Snippet
                    </div>
                    <code className="block mt-1 text-xs break-all text-slate-700 overflow-hidden">{snippet}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(snippet)}
                      className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                    >
                      Copy snippet
                    </button>
                  </div>
                  <Link to={"/p/" + p.id} className="text-sm font-medium text-lime-600 hover:underline">
                    View reports →
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
