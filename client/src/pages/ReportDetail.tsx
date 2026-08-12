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
  if(err && !report) return <div className="min-h-screen bg-slate-50"><TopNav/><div className="max-w-4xl mx-auto px-4 py-8"><div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</div><Link to="/dashboard" className="text-sm text-lime-600 hover:underline mt-3 inline-block">\u2190 Back</Link></div></div>
  if(!report) return null;
  const screenshot=report.screenshotPath||report.screenshotUrl||report.screenshot||null;
  const imgSrc=screenshot ? (screenshot.startsWith("http")||screenshot.startsWith("/") ? screenshot : "/uploads/"+screenshot) : null;
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNav/>
      <main className="max-w-4xl mx-auto w-full px-4 py-6 flex-1">
        <Link to={report.projectId ? "/p/"+report.projectId : "/dashboard"} className="text-sm text-slate-500 hover:text-slate-700">\u2190 Back to reports</Link>
        {err && <div role="alert" aria-live="polite" className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">{err}</div>}
        <div className="mt-4 grid md:grid-cols-5 gap-6">
          <div className="md:col-span-3 bg-white border rounded-2xl p-5">
            <h1 className="font-semibold">Report</h1>
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50 border rounded-xl p-3">{report.message}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">Contact</dt><dd className="font-medium">{report.contactEmail||"\u2014"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">Page URL</dt><dd className="break-all text-slate-700">{report.pageUrl||"\u2014"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">UserAgent</dt><dd className="break-all text-xs text-slate-600">{report.userAgent||"\u2014"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">Viewport</dt><dd>{report.viewport||"\u2014"}</dd></div>
              <div className="flex gap-2"><dt className="text-slate-500 w-24 flex-shrink-0">Language</dt><dd>{report.language||"\u2014"}</dd></div>
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
              {imgSrc ? <img src={imgSrc} alt="Report screenshot" className="mt-3 w-full rounded-xl border object-contain max-h-[400px]" /> : <div className="mt-3 border-2 border-dashed rounded-xl p-8 text-center text-sm text-slate-400">No screenshot</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
