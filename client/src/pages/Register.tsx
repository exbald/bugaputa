import {useState} from "react";
import {Link,useNavigate} from "react-router-dom";
import {useAuth} from "../lib/auth";
import {TopNav} from "../components/Layout";
export default function Register(){
  const {register}=useAuth();
  const nav=useNavigate();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [err,setErr]=useState("");
  const [loading,setLoading]=useState(false);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault(); setErr("");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("Enter a valid email.");
    if(password.length<8) return setErr("Password must be at least 8 characters.");
    setLoading(true);
    try{ await register(email,password); nav("/dashboard"); } catch(ex:any){ setErr(ex.message||"Registration failed"); } finally{ setLoading(false); }
  };
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav/>
      <main className="flex-1 flex items-center justify-center px-4 py-10 bg-slate-50">
        <form onSubmit={submit} className="w-full max-w-md bg-white border rounded-2xl p-6 shadow-sm" aria-labelledby="reg-title">
          <h1 id="reg-title" className="text-xl font-bold">Create your account</h1>
          <p className="text-sm text-slate-500 mt-1">Start collecting bug reports in under 2 minutes</p>
          {err && <div role="alert" aria-live="polite" className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">{err}</div>}
          <label className="block mt-4 text-sm font-medium">Email
            <input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500" placeholder="you@example.com" required />
          </label>
          <label className="block mt-3 text-sm font-medium">Password
            <input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-1 w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500" placeholder="At least 8 characters" required />
          </label>
          <button disabled={loading} className="mt-6 w-full py-2.5 rounded-xl bg-lime-500 text-slate-900 font-bold hover:bg-lime-400 disabled:opacity-50 min-h-[44px]">{loading?"Creating...":"Create account"}</button>
          <p className="mt-4 text-sm text-center text-slate-600">Already have an account? <Link to="/login" className="text-lime-600 font-medium hover:underline">Log in</Link></p>
        </form>
      </main>
    </div>
  )
}
