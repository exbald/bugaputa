import {useEffect,useState} from "react";
import {useParams,Link,useNavigate} from "react-router-dom";
import {api} from "../lib/api";
import {TopNav} from "../components/Layout";
export default function ReportDetail(){
  const {id}=useParams();
  const nav=useNavigate();
  const [report,setReport]=useState<any>(null);
  const [loading,setLoading]=useState(true);
  const [err,setErr]=useState("");
  const [status,setStatus]=useState("");
  const [saving,setSaving]=useState(false);
  const [deleting,setDeleting]=useState(false);
  const [lightbox,setLightbox]=useState(false);
  useEffect(()=>{
    if(!id) return;
    (async()=>{
      setLoading(true);
      try{ const d:any=await api.getReport(id); const r=d.report||d; setReport(r); setStatus(r.status); }
      catch(e:any){ setErr(e.message); }
      finally{ setLoading(false); }
    })();
  },[id]);
  const saveStatus=async(newStatus:string)=>{
    if(!id) return;
    const prev=report?.status;
    setStatus(newStatus);
    setReport((r:any)=> r ? {...r, status:newStatus}:r);
    setSaving(true);
    try{ const d:any=await api.patchReport(id,newStatus); const upd=d.report||d; setReport(upd); setStatus(upd.status); }
    catch(e:any){ setReport((r:any)=> r?{...r,status:prev}:r); setStatus(prev); setErr(e.message); }
    finally{ setSaving(false); }
  };
  const del=async()=>{
    if(!id || !confirm("Delete this report?")) return;
    setDeleting(true);
    try{ await api.deleteReport(id); nav(-1); }
    catch(e:any){ setErr(e.message); setDeleting(false); }
  };
  if(loading) return <div className="min-h-screen bg-slate-50"><TopNav/><div className="max-w-4xl mx-auto px-4 py-8 text-sm text-slate-500">Loading...</div></div>
  if(err && !report) return <div className="min-h-screen bg-slate-50"><TopNav/><div className="max-w-4xl mx-auto px-4 py-8"><div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</div><Link to="/dashboard" className="text-sm text-lime-600 hover:underline mt-3 inline-block">← Back</Link></div></div>
  if(!report) return null;
  const screenshot=report.screenshotPath||report.screenshotUrl||report.screenshot||null;
  const imgSrc=screenshot ? (screenshot.startsWith("http")||screenshot.startsWith("/") ? screenshot : "/uploads/"+screenshot) : null;
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav/>
      <main className="max-w-4xl mx-auto w-full px-4 py-6 flex-1">
        <Link to={report.projectId ? "/p/"+report.projectId : "/dashboard"} className="text-sm text-slate-500 hover:text-slate-700">← Back to reports</Link>
        {err && <div role="alert" aria-live="polite" className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</div>}
        <div className="mt-4 grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3 bg-white border rounded-2xl p-5">
            <h1 className="font-semibold">Report</h1>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 border rounded-xl p-3">{report.message}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">Contact</dt><dd className="font-medium">{report.contactEmail||"—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">Page URL</dt><dd className="break-all text-slate-700">{report.pageUrl||"—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">UserAgent</dt><dd className="break-all text-xs text-slate-600">{report.userAgent||"—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">Viewport</dt><dd>{report.viewport||"—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">Language</dt><dd>{report.language||"—"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">Date</dt><dd>{new Date(report.createdAt||report.created_at).toLocaleString()}</dd></div>
            </dl>
            <div className="mt-6 flex flex-wrap gap-3">
              <label className="text-sm font-medium flex items-center gap-2">Status
                <select value={status} onChange={e=> saveStatus(e.target.value)} disabled={saving} className="border rounded-lg px-2 py-1.5 text-sm bg-white min-h-[36px]">
                  <option value="open">open</option>
                  <option value="in_progress">in_progress</option>
                  <option value="resolved">resolved</option>
                  <option value="archived">archived</option>
                </select>
              </label>
              <button onClick={del} disabled={deleting} className="px-3 py-1.5 rounded-lg border text-sm hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 min-h-[36px]">{deleting?"Deleting...":"Delete report"}</button>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="bg-white border rounded-2xl p-5">
              <h2 className="font-semibold text-sm">Screenshot</h2>
              {imgSrc ? (
                <div>
                  <button onClick={()=> setLightbox(true)} className="mt-3 block w-full text-left rounded-xl overflow-hidden border hover:opacity-90 transition" aria-label="Open screenshot full size">
                    <img src={imgSrc} alt="Report screenshot — click to open full size" className="w-full object-contain max-h-[400px] bg-slate-50" />
                  </button>
                  <div className="mt-3 flex gap-2">
                    <button onClick={()=> setLightbox(true)} className="flex-1 px-3 py-2 rounded-lg border bg-white text-sm font-medium hover:bg-slate-50 min-h-[40px]">Open full size</button>
                    <a href={imgSrc} download target="_blank" rel="noopener noreferrer" className="flex-1 px-3 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium text-center hover:bg-slate-800 min-h-[40px] flex items-center justify-center">Download</a>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">Annotated PNG — flattened at submission.</p>
                </div>
              ) : <div className="mt-3 border-2 border-dashed rounded-xl p-8 text-center text-sm text-slate-400">No screenshot</div>}
            </div>
          </div>
        </div>
        {lightbox && imgSrc && (
          <div role="dialog" aria-modal="true" aria-label="Screenshot full size" onClick={()=> setLightbox(false)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-zoom-out">
            <img src={imgSrc} alt="Report screenshot full size" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl bg-white" onClick={e=> e.stopPropagation()} />
            <button onClick={()=> setLightbox(false)} aria-label="Close" className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/90 text-slate-800 flex items-center justify-center text-xl font-bold hover:bg-white">×</button>
            <a href={imgSrc} download className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white text-sm font-semibold shadow">Download</a>
          </div>
        )}
      </main>
    </div>
  )
}
