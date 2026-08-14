import {useEffect,useState,useCallback} from "react";
import {useParams,Link} from "react-router-dom";
import {api} from "../lib/api";
import {TopNav} from "../components/Layout";
function toSrc(p: string|null){ if(!p) return null; return p.startsWith("http")||p.startsWith("/") ? p : "/uploads/"+p; }
const STATUSES=["","open","in_progress","resolved","archived"] as const;

type TabKey = "issues" | "widget" | "snippet";
const TABS: { key: TabKey; label: string }[] = [
  { key: "issues", label: "Issues" },
  { key: "widget", label: "Widget" },
  { key: "snippet", label: "Install Snippet" },
];

function Badge({s}:{s:string}){
  const map:any={open:"bg-amber-100 text-amber-800 border-amber-200", in_progress:"bg-blue-100 text-blue-800 border-blue-200", resolved:"bg-green-100 text-green-800 border-green-200", archived:"bg-slate-100 text-slate-600 border-slate-200"};
  return <span className={'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border '+(map[s]||"bg-slate-100")}>{s}</span>
}

const WIDGET_POSITIONS = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "bottom-left", label: "Bottom Left" },
  { value: "bottom-right", label: "Bottom Right" },
] as const;
const WIDGET_DEFAULTS = { label: "Feedback", color: "#171717", position: "right" };
function isValidHex(v: string){ return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v); }

function WidgetPreview({ label, color, position }: { label: string; color: string; position: string }){
  const displayLabel = label.trim() || WIDGET_DEFAULTS.label;
  const displayColor = isValidHex(color) ? color : WIDGET_DEFAULTS.color;
  const pos = (["left","right","bottom-left","bottom-right"] as string[]).includes(position) ? position : WIDGET_DEFAULTS.position;
  const tabBase: React.CSSProperties = {
    position: "absolute", backgroundColor: displayColor, color: "#fff", border: "none",
    fontFamily: "Inter,system-ui,sans-serif", fontSize: "12px", fontWeight: 600, letterSpacing: "0.02em",
    lineHeight: 1, whiteSpace: "nowrap", userSelect: "none" as const,
    boxShadow: "0 2px 10px rgba(0,0,0,0.18)", display: "flex", alignItems: "center", justifyContent: "center",
  };
  let tabStyle: React.CSSProperties = { ...tabBase };
  if(pos === "left"){ tabStyle = { ...tabBase, left: 0, top: "50%", transform: "translateY(-50%) rotate(180deg)", writingMode: "vertical-rl" as const, borderRadius: "0 8px 8px 0", width: 28, minHeight: 72, padding: "10px 0" };
  } else if(pos === "right"){ tabStyle = { ...tabBase, right: 0, top: "50%", transform: "translateY(-50%)", writingMode: "vertical-rl" as const, borderRadius: "8px 0 0 8px", width: 28, minHeight: 72, padding: "10px 0" };
  } else if(pos === "bottom-left"){ tabStyle = { ...tabBase, bottom: 0, left: 16, borderRadius: "8px 8px 0 0", padding: "8px 14px", minHeight: 30 };
  } else { tabStyle = { ...tabBase, bottom: 0, right: 16, borderRadius: "8px 8px 0 0", padding: "8px 14px", minHeight: 30 }; }
  return (
    <div className="relative h-40 bg-slate-50 border rounded-xl overflow-hidden">
      <div className="absolute inset-0 p-3 opacity-[0.35]">
        <div className="h-3 w-20 bg-slate-200 rounded mb-2" />
        <div className="h-2 w-full bg-slate-200 rounded mb-1.5" />
        <div className="h-2 w-3/4 bg-slate-200 rounded mb-1.5" />
        <div className="h-2 w-5/6 bg-slate-200 rounded" />
      </div>
      <div style={tabStyle}>{displayLabel}</div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 tracking-wide uppercase font-medium">Preview</div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }){
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <button onClick={handleCopy} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition min-h-[36px]">
      {copied ? (
        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>Copied!</>
      ) : (
        <><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>{label}</>
      )}
    </button>
  );
}

export default function ProjectReports(){
  const {id}=useParams();
  const [activeTab, setActiveTab] = useState<TabKey>("widget");
  const [project,setProject]=useState<any>(null);
  const [reports,setReports]=useState<any[]>([]);
  const [total,setTotal]=useState(0);
  const [status,setStatus]=useState("");
  const [q,setQ]=useState("");
  const [qDebounced,setQDebounced]=useState("");
  const [page,setPage]=useState(1);
  const limit=10;
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");
  const [wLabel,setWLabel]=useState(WIDGET_DEFAULTS.label);
  const [wColor,setWColor]=useState(WIDGET_DEFAULTS.color);
  const [wPos,setWPos]=useState(WIDGET_DEFAULTS.position);
  const [wSaving,setWSaving]=useState(false);
  const [wSaved,setWSaved]=useState(false);
  const [wErr,setWErr]=useState("");
  useEffect(()=>{ const t=setTimeout(()=> setQDebounced(q), 350); return ()=> clearTimeout(t); },[q]);
  useEffect(()=>{ setPage(1); },[status,qDebounced]);
  const loadProject=useCallback(async()=>{
    if(!id) return;
    try{
      const d:any=await api.getProject(id);
      const proj=d.project||d;
      setProject(proj);
      setWLabel(proj.widget_label || proj.widgetLabel || WIDGET_DEFAULTS.label);
      setWColor(proj.widget_color || proj.widgetColor || WIDGET_DEFAULTS.color);
      setWPos(proj.widget_position || proj.widgetPosition || WIDGET_DEFAULTS.position);
    } catch(e:any){ setErr(e.message); }
  },[id]);
  const loadReports=useCallback(async()=>{
    if(!id) return;
    setLoading(true); setErr("");
    try{
      const d:any=await api.listReports(id, {status, q:qDebounced, page, limit});
      const items=d.items||d.reports||(Array.isArray(d)?d:[]);
      setReports(items);
      setTotal(d.total??items.length);
    }catch(e:any){ setErr(e.message); }
    finally{ setLoading(false); }
  },[id,status,qDebounced,page]);
  useEffect(()=>{ loadProject(); },[loadProject]);
  useEffect(()=>{ loadReports(); },[loadReports]);
  const pk=project?.publicKey||project?.public_key||"";
  // Simplified snippet: data-project only — settings sync from server
  const snippet=pk?'<script src="https://bugaputa.no-code.gdn/widget.js" data-project="'+pk+'"></script>':"";
  const handleSaveWidget=async()=>{
    if(!id) return;
    const trimmedLabel=wLabel.trim();
    if(!trimmedLabel || trimmedLabel.length>30){ setWErr("Label must be 1-30 characters."); return; }
    if(!isValidHex(wColor)){ setWErr("Color must be a valid hex e.g. #171717"); return; }
    if(!["left","right","bottom-left","bottom-right"].includes(wPos)){ setWErr("Invalid position."); return; }
    setWSaving(true); setWErr(""); setWSaved(false);
    try{
      const d:any=await api.updateProject(id, { widget_label: trimmedLabel, widget_color: wColor, widget_position: wPos });
      const updated=d.project||d;
      setProject(updated);
      if(updated.widget_label) setWLabel(updated.widget_label);
      if(updated.widget_color) setWColor(updated.widget_color);
      if(updated.widget_position) setWPos(updated.widget_position);
      setWSaved(true);
      setTimeout(()=> setWSaved(false), 2500);
    }catch(e:any){ setWErr(e.message || "Failed to save"); }
    finally{ setWSaving(false); }
  };
  const totalPages=Math.max(1, Math.ceil(total/limit));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav/>
      <main className="max-w-6xl mx-auto w-full px-4 py-6 flex-1">
        <Link to="/dashboard" className="text-sm text-slate-500 hover:text-slate-700 transition">&larr; All projects</Link>

        {project && (
          <div className="mt-3">
            <h1 className="text-xl font-bold text-slate-900">{project.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="bg-slate-900 text-lime-300 text-xs rounded-lg px-3 py-1.5 font-mono">{pk}</code>
              <CopyButton text={pk} label="Copy key" />
            </div>
          </div>
        )}

        {/* ── Tab bar ── */}
        {project && (
          <nav className="mt-6 border-b border-slate-200" role="tablist" aria-label="Project sections">
            <div className="flex gap-0 -mb-px">
              {TABS.map(t=>(
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={activeTab === t.key}
                  onClick={()=> setActiveTab(t.key)}
                  className={
                    'relative px-4 py-2.5 text-sm font-medium transition min-h-[44px] ' +
                    (activeTab === t.key
                      ? 'text-slate-900 after:absolute after:left-0 after:right-0 after:bottom-[-1px] after:h-[2px] after:bg-slate-900 after:rounded-full'
                      : 'text-slate-500 hover:text-slate-700')
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </nav>
        )}

        {/* ── Issues tab ── */}
        {project && activeTab === "issues" && (
          <div className="mt-6" role="tabpanel" aria-label="Issues">
            <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
              <div className="flex gap-1.5 flex-wrap">
                {STATUSES.map(s=>(
                  <button key={s||"all"} onClick={()=> setStatus(s)} className={'px-3 py-1.5 rounded-full text-xs font-medium border min-h-[32px] transition '+(status===s?"bg-slate-900 text-white border-slate-900":"bg-white hover:bg-slate-50")}>{s||"all"}</button>
                ))}
              </div>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search message / email / URL" className="border rounded-xl px-3 py-2 text-sm w-full md:w-72 bg-white focus:outline-none focus:ring-2 focus:ring-lime-500 transition" />
            </div>
            {err && <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{err}</div>}
            {loading ? <div className="mt-6 text-sm text-slate-500" aria-live="polite">Loading reports...</div> : reports.length===0 ? (
              <div className="mt-6 border-2 border-dashed rounded-2xl p-10 text-center bg-white">
                <div className="text-2xl">+</div>
                <h3 className="mt-2 font-semibold">No reports yet</h3>
                <p className="text-sm text-slate-500 mt-1">Install the snippet and submit a test report — it will appear here within seconds.</p>
              </div>
            ) : (
              <>
                <div className="mt-4 space-y-3">
                  {reports.map((r:any)=>(
                    <Link key={r.id} to={"/r/"+r.id} className="block bg-white border rounded-xl p-4 hover:shadow-sm transition">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm leading-relaxed line-clamp-2 flex-1">{r.message}</p>
                        {(r.screenshotPath||r.screenshotUrl||r.screenshot) ? (()=>{ const s=toSrc(r.screenshotPath||r.screenshotUrl||r.screenshot); return s ? <img src={s} alt="Screenshot thumbnail" className="w-16 h-16 object-cover rounded-lg border flex-shrink-0 bg-slate-50" onError={e=> (e.currentTarget.style.display="none")} /> : null; })() : null}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge s={r.status||"open"} />
                        <span>{new Date(r.createdAt||r.created_at).toLocaleString()}</span>
                        {r.contactEmail && <span className="truncate max-w-[200px]">{r.contactEmail}</span>}
                        {r.pageUrl && <span className="truncate max-w-[200px]">{r.pageUrl}</span>}
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{total} report{total!==1?"s":""} · page {page} of {totalPages}</span>
                  <div className="flex gap-2">
                    <button disabled={page<=1} onClick={()=> setPage(p=>p-1)} className="px-3 py-1.5 rounded-lg border bg-white text-sm disabled:opacity-40 min-h-[36px] transition">Prev</button>
                    <button disabled={page>=totalPages} onClick={()=> setPage(p=>p+1)} className="px-3 py-1.5 rounded-lg border bg-white text-sm disabled:opacity-40 min-h-[36px] transition">Next</button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Widget tab (default) ── */}
        {project && activeTab === "widget" && (
          <div className="mt-6" role="tabpanel" aria-label="Widget settings">
            <div className="bg-white border rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-slate-900">Widget Settings</h2>
              <p className="text-xs text-slate-500 mt-1">Customize the feedback tab label, color, and position. Changes take effect on next page load.</p>
              <div className="mt-4 grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label htmlFor="widget-label" className="block text-xs font-semibold text-slate-700 mb-1.5">Tab label</label>
                    <input id="widget-label" type="text" maxLength={30} value={wLabel} onChange={e=> setWLabel(e.target.value)} placeholder="Feedback" className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500 transition" />
                    <div className="text-[11px] text-slate-400 mt-1">{wLabel.length}/30 characters</div>
                  </div>
                  <div>
                    <label htmlFor="widget-color-hex" className="block text-xs font-semibold text-slate-700 mb-1.5">Tab color</label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={isValidHex(wColor) ? wColor : WIDGET_DEFAULTS.color} onChange={e=> setWColor(e.target.value)} className="h-10 w-10 rounded-lg border p-1 bg-white cursor-pointer flex-shrink-0" aria-label="Pick tab color" />
                      <input id="widget-color-hex" type="text" value={wColor} onChange={e=> setWColor(e.target.value)} placeholder="#171717" pattern="^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$" className="flex-1 border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lime-500 focus:border-lime-500 font-mono transition" />
                    </div>
                    {wColor && !isValidHex(wColor) && (<div className="text-[11px] text-amber-600 mt-1">Enter a valid hex color, e.g. #171717</div>)}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tab position</label>
                    <div className="grid grid-cols-2 gap-2">
                      {WIDGET_POSITIONS.map(opt=>(
                        <button key={opt.value} type="button" onClick={()=> setWPos(opt.value)} className={'px-3 py-2.5 rounded-xl text-sm font-medium border transition text-center min-h-[44px] '+(wPos===opt.value ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50")}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-1">
                    <button onClick={handleSaveWidget} disabled={wSaving} className="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 min-h-[44px] transition">{wSaving ? "Saving..." : "Save widget settings"}</button>
                    {wSaved && <span className="text-sm font-medium text-green-600">Saved ✓</span>}
                  </div>
                  {wErr && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{wErr}</div>}
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-700 mb-1.5">Live preview</div>
                  <WidgetPreview label={wLabel} color={wColor} position={wPos} />
                  <p className="text-[11px] text-slate-400 mt-2">Preview updates instantly as you type. Save to persist.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Install Snippet tab ── */}
        {project && activeTab === "snippet" && (
          <div className="mt-6" role="tabpanel" aria-label="Install snippet">
            <div className="bg-white border rounded-2xl p-5">
              <h2 className="text-sm font-semibold text-slate-900">Install Snippet</h2>
              <p className="text-xs text-slate-500 mt-1">Add this script tag to your site. Settings sync automatically from the dashboard.</p>

              {snippet && (
                <div className="mt-4">
                  <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                    <pre className="text-sm text-lime-300 font-mono whitespace-pre-wrap break-all m-0">{snippet}</pre>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <CopyButton text={snippet} label="Copy snippet" />
                  </div>
                </div>
              )}

              <div className="mt-6 border-t border-slate-100 pt-5">
                <h3 className="text-xs font-semibold text-slate-700 mb-2">API Key</h3>
                <div className="flex items-center gap-3">
                  <code className="bg-slate-50 border rounded-lg px-3 py-2 text-xs font-mono">{pk}</code>
                  <CopyButton text={pk} label="Copy key" />
                </div>
              </div>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-lime-100 flex items-center justify-center">
                    <svg className="w-3 h-3 text-lime-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">Install once — settings sync automatically from the dashboard. No need to update the snippet when you change the label, color, or position.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
