import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";

export function TopNav() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const switcherBtnRef = useRef<HTMLButtonElement>(null);
  const accountBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (user)
      (api.listProjects() as Promise<any>)
        .then((d: any) => setProjects(Array.isArray(d) ? d : d.projects || d.items || []))
        .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!open && !accountOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (open && switcherRef.current && !switcherRef.current.contains(t)) setOpen(false);
      if (accountOpen && accountRef.current && !accountRef.current.contains(t)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (open) { setOpen(false); switcherBtnRef.current?.focus(); }
        if (accountOpen) { setAccountOpen(false); accountBtnRef.current?.focus(); }
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, accountOpen]);

  const initial = user ? String((user as any).email || "?").trim().charAt(0).toUpperCase() : "?";

  return (
    <header className="sticky top-0 z-30 w-full bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link
          to={user ? "/dashboard" : "/"}
          className="flex items-center gap-2 font-bold tracking-tight text-base text-slate-900 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 rounded-sm"
          aria-label="Bugaputa home"
        >
          <img src="/bugaputa-logo.svg" alt="" className="w-7 h-7 shrink-0" aria-hidden="true" />
          <span>Bugaputa</span>
        </Link>

        <div className="flex items-center gap-2 min-w-0">
          {user ? (
            <>
              <div ref={switcherRef} className="relative">
                <button
                  ref={switcherBtnRef}
                  type="button"
                  aria-label="Project switcher"
                  aria-haspopup="dialog"
                  aria-expanded={open}
                  onClick={() => { setOpen((v) => !v); setAccountOpen(false); }}
                  onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); switcherBtnRef.current?.focus(); } }}
                  className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] px-3 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 transition"
                >
                  <span className="hidden sm:inline">Projects</span>
                  <span className="sm:hidden truncate max-w-[72px]">Projects</span>
                  <span aria-hidden className="text-slate-400 text-xs leading-none">&#9662;</span>
                </button>
                {open && (
                  <div
                    aria-label="Project switcher"
                    className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="max-h-64 overflow-auto py-1">
                      {projects.length === 0 && (
                        <div className="px-3 py-3 text-sm text-slate-500">No projects yet</div>
                      )}
                      {projects.map((p: any) => (
                        <Link
                          key={p.id}
                          to={"/p/" + p.id}
                          onClick={() => setOpen(false)}
                          className="block px-3 py-2.5 text-sm text-slate-800 hover:bg-slate-50 border-b border-slate-100 last:border-0 truncate focus:outline-none focus-visible:bg-lime-50"
                        >
                          {p.name}
                        </Link>
                      ))}
                    </div>
                    <Link
                      to="/dashboard"
                      onClick={() => setOpen(false)}
                      className="block px-3 py-2.5 text-sm font-medium text-slate-900 bg-slate-50 hover:bg-slate-100 border-t border-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-500"
                    >
                      View all projects
                    </Link>
                  </div>
                )}
              </div>

              <div ref={accountRef} className="relative">
                <button
                  ref={accountBtnRef}
                  type="button"
                  aria-label="Account menu"
                  aria-haspopup="dialog"
                  aria-expanded={accountOpen}
                  onClick={() => { setAccountOpen((v) => !v); setOpen(false); }}
                  onKeyDown={(e) => { if (e.key === "Escape") { setAccountOpen(false); accountBtnRef.current?.focus(); } }}
                  className="inline-flex items-center gap-2 min-h-[44px] min-w-[44px] pl-1.5 pr-2.5 py-1 rounded-full border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 transition"
                >
                  <span aria-hidden className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-semibold shrink-0">
                    {initial}
                  </span>
                  <span className="hidden sm:inline text-sm text-slate-700 truncate max-w-[160px]">
                    {(user as any).email}
                  </span>
                  <span aria-hidden className="hidden sm:inline text-slate-400 text-xs leading-none">&#9662;</span>
                </button>
                {accountOpen && (
                  <div
                    aria-label="Account"
                    className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20 py-1"
                  >
                    <div className="px-3 py-2 border-b border-slate-100">
                      <div className="text-xs text-slate-500">Signed in as</div>
                      <div className="text-sm font-medium text-slate-900 truncate">{(user as any).email}</div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => { setAccountOpen(false); await logout(); nav("/login"); }}
                      className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-lime-500 min-h-[44px]"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center min-h-[44px] px-3 text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 rounded-xl"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center min-h-[44px] px-4 rounded-xl bg-lime-500 text-slate-900 text-sm font-bold hover:bg-lime-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2 transition"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
