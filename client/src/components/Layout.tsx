import {Link,useNavigate} from "react-router-dom";
import {useAuth} from "../lib/auth";
import {useEffect,useState} from "react";
import {api} from "../lib/api";
export function TopNav(){
  const {user,logout}=useAuth();
  const nav=useNavigate();
  const [projects,setProjects]=useState<any[]>([]);
  const [open,setOpen]=useState(false);
  useEffect(()=>{ if(user) (api.listProjects() as Promise<any>).then((d:any)=> setProjects(Array.isArray(d)?d:(d.projects||d.items||[]))).catch(()=>{}); },[user]);
  return (
    <header className="sticky top-0 z-30 bg-slate-900 text-white border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <Link to={user?"/dashboard":"/"} className="flex items-center gap-2 font-bold tracking-tight text-lg">
          <img src="/bugaputa-logo.svg" alt="" className="w-7 h-7" /> Bugaputa
        </Link>
        <div className="flex items-center gap-3">
          {user ? <>
            <div className="relative">
              <button onClick={()=> setOpen(v=>!v)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm flex items-center gap-2">Projects <span className="opacity-60">\u25BE</span></button>
              {open && (
                <div className="absolute right-0 mt-2 w-64 bg-white text-slate-900 rounded-xl shadow-xl border overflow-hidden">
                  <div className="max-h-64 overflow-auto">
                    {projects.length===0 && <div className="p-3 text-sm text-slate-500">No projects yet</div>}
                    {projects.map((p:any)=> <Link key={p.id} to={"/p/"+p.id} onClick={()=>setOpen(false)} className="block px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-0 truncate">{p.name}</Link>)}
                  </div>
                  <Link to="/dashboard" onClick={()=>setOpen(false)} className="block px-3 py-2 text-sm font-medium text-lime-600 hover:bg-lime-50">View all \u2192</Link>
                </div>
              )}
            </div>
            <span className="hidden sm:inline text-sm text-slate-300 truncate max-w-[160px]">{(user as any).email}</span>
            <button onClick={async()=>{ await logout(); nav("/login"); }} className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-sm font-medium hover:bg-slate-100">Logout</button>
          </> : <>
            <Link to="/login" className="text-sm text-slate-300 hover:text-white">Log in</Link>
            <Link to="/register" className="px-3 py-1.5 rounded-lg bg-lime-500 text-slate-900 text-sm font-bold hover:bg-lime-400">Get started</Link>
          </>}
        </div>
      </div>
    </header>
  )
}
