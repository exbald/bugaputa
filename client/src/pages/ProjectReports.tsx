import {useEffect,useState,useCallback} from "react";
import {useParams,Link} from "react-router-dom";
import {api} from "../lib/api";
import {TopNav} from "../components/Layout";
const STATUSES=["","open","in_progress","resolved","archived"] as const;
function Badge({s}:{s:string}){
  const map:any={open:"bg-amber-100 text-amber-800 border-amber-200", in_progress:"bg-blue-100 text-blue-800 border-blue-200", resolved:"bg-green-100 text-green-800 border-green-200", archived:"bg-slate-100 text-slate-600 border-slate-200"};
  return <span className={'inline-flex px-2 py-0.5 rounded-full text-xs font-medium border '+(map[s]||"bg-slate-100")}>{s}</span>
}
export default function ProjectReports(){
  const {id}=useParams();
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
  useEffect(()=>{ const t=setTimeout(()=> setQDebounced(q), 350); return ()=> clearTimeout(t); },[q]);
  useEffect(()=>{ setPage(1); },[status,qDebounced]);
  const loadProject=useCallback(async()=>{
    if(!id) return;
    try{ const d:any=await api.getProject(id); setProject(d.project||d); } catch(e:any){ setErr(e.message); }
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
  const snippet=pk?'<scr'+'ipt src="https://bugaputa.no-code.gdn/widget.js" data-project="'+pk+'"></scr'+'ipt>':"";
  const totalPages=Math.max(1, Math.ceil(total/limit));
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav/>
      <main className="max-w-6xl mx-auto w-full px-4 py-6 flex-1">
        <Link to="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">\u2190 All projects</Link>
        {project && (
          <div className="mt-3 bg-white border rounded-2xl p-5">
            <h1 className="text-xl font-bold">{project.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="bg-slate-900 text-lime-300 text-xs rounded-lg px-3 py-1.5">{pk}</code>
              <button onClick={()=> navigator.clipboard.writeText(pk)} className="px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-slate-50">Copy key</button>
            </div>
            {snippet && (
              <div className="mt-3 bg-slate-50 border rounded-xl p-3">
                <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">Install snippet</div>
                <code className="block mt-1 text-xs break-all">{snippet}</code>
                <button onClick={()=> navigator.clipboard.writeText(snippet)} className="mt-2 text-xs px-3 py-1.5 rounded-lg bg-slate-900 text-white">Copy snippet</button>
              </div>
            )}
          </div>
        )}
        <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex gap-1.5 flex-wrap">
            {STATUSES.map(s=>(
              <button key={s||"all"} onClick={()=> setStatus(s)} className={'px-3 py-1.5 rounded-full text-xs font-medium border min-h-[32px] '+(status===s?"bg-slate-900 text-white border-slate-900":"bg-white hover:bg-slate-50")}>{s||"all"}</button>
            ))}
          </div>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search message / email / URL" className="border rounded-xl px-3 py-2 text-sm w-full md:w-72 bg-white focus:outline-none focus:ring-2 focus:ring-lime-500" />
        </div>
        {err && <div role="alert" className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{err}</div>}
        {loading ? <div className="mt-6 text-sm text-slate-500" aria-live="polite">Loading reports...</div> : reports.length===0 ? (
          <div className="mt-6 border-2 border-dashed rounded-2xl p-10 text-center bg-white">
            <div className="text-2xl">+</div>
            <h3 className="mt-2 font-semibold">No reports yet</h3>
            <p className="text-sm text-slate-500 mt-1">Install the snippet and submit a test report \u2014 it will appear here within seconds.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              {reports.map((r:any)=>(
                <Link key={r.id} to={"/r/"+r.id} className="block bg-white border rounded-xl p-4 hover:shadow-sm transition">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm leading-relaxed line-clamp-2 flex-1">{r.message}</p>
                    {(r.screenshotPath||r.screenshotUrl||r.screenshot) ? <img src={r.screenshotPath||r.screenshotUrl||r.screenshot} alt="" className="w-16 h-16 object-cover rounded-lg border flex-shrink-0" /> : null}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge s={r.status||"open"} />
                    <span>{new Date(r.createdAt||r.created_at).toLocaleString()}</span>
                    {r.contactEmail && <span className="truncate">{r.contactEmail}</span>}
                    {r.pageUrl && <span className="truncate max-w-[200px]">{r.pageUrl}</span>}
                  </div>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-500">{total} report{total!==1?"s":""} \u00B7 page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button disabled={page<=1} onClick={()=> setPage(p=>p-1)} className="px-3 py-1.5 rounded-lg border bg-white text-sm disabled:opacity-40 min-h-[36px]">Prev</button>
                <button disabled={page>=totalPages} onClick={()=> setPage(p=>p+1)} className="px-3 py-1.5 rounded-lg border bg-white text-sm disabled:opacity-40 min-h-[36px]">Next</button>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
