import {Link} from "react-router-dom";
import {TopNav} from "../components/Layout";
export default function Landing(){
  const snippet = '<scr'+'ipt src="https://bugaputa.no-code.gdn/widget.js" data-project="pk_..."></scr'+'ipt>';
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav/>
      <main className="flex-1">
        <section className="bg-slate-900 text-white">
          <div className="max-w-6xl mx-auto px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-500/20 border border-lime-500/30 text-lime-400 text-xs font-semibold tracking-wide uppercase">Lightweight · Accessible · Fast</div>
              <h1 className="mt-4 text-4xl md:text-5xl font-extrabold leading-tight tracking-tight">Bug reporting your users will <span className="text-lime-400">actually use</span></h1>
              <p className="mt-4 text-slate-300 text-lg leading-relaxed">One snippet. A friendly floating button. Rich context — URL, browser, screenshot — without asking your users to create an account.</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/register" className="px-6 py-3 rounded-xl bg-lime-500 text-slate-900 font-bold hover:bg-lime-400 transition">Get started free →</Link>
                <Link to="/login" className="px-6 py-3 rounded-xl bg-white/10 border border-white/20 text-white font-medium hover:bg-white/15">Log in</Link>
              </div>
              <p className="mt-3 text-xs text-slate-400">No credit card · Works at 320px · WCAG AA</p>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-2xl text-slate-900">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><span className="w-2 h-2 rounded-full bg-lime-500"></span> Live preview</div>
              <div className="mt-4 border rounded-xl p-4 bg-slate-50">
                <div className="text-sm font-medium">Report a bug</div>
                <textarea placeholder="Describe the bug..." className="mt-2 w-full border rounded-lg p-2 text-sm bg-white" rows={3} readOnly />
                <button className="mt-3 w-full py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold">Send report</button>
                <p className="mt-2 text-[11px] text-slate-500">We will send page URL, browser info, and your message. No passwords or sensitive data.</p>
              </div>
              <div className="mt-4 flex items-center justify-end">
                <div className="w-12 h-12 rounded-full bg-slate-900 flex items-center justify-center text-white shadow-lg text-lg">!</div>
              </div>
            </div>
          </div>
        </section>
        <section className="max-w-6xl mx-auto px-4 py-12 grid md:grid-cols-3 gap-6">
          {[
            {t:"Frictionless for reporters", d:"Under 30 seconds, no signup, works on mobile, keyboard and screen-reader friendly.", icon:"⚡"},
            {t:"Context you can act on", d:"Every report includes page URL, viewport, userAgent, language and optional screenshot.", icon:"🔍"},
            {t:"Your dashboard, your data", d:"Projects, status workflow, search, filters, pagination — everything you need to triage.", icon:"📋"},
          ].map(c=>(
            <div key={c.t} className="border rounded-2xl p-6 bg-white">
              <div className="w-10 h-10 rounded-xl bg-lime-100 flex items-center justify-center text-lg">{c.icon}</div>
              <h3 className="mt-3 font-bold">{c.t}</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{c.d}</p>
            </div>
          ))}
        </section>
        <section className="max-w-6xl mx-auto px-4 pb-6">
          <div className="rounded-2xl bg-slate-900 text-white p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div><h3 className="font-bold text-lg">Drop it into any site</h3><p className="text-slate-300 text-xs mt-1 font-mono break-all">{snippet}</p></div>
            <Link to="/register" className="px-5 py-2.5 rounded-xl bg-lime-500 text-slate-900 font-bold whitespace-nowrap">Create your project</Link>
          </div>
        </section>
        <footer className="border-t mt-8">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-2"><img src="/bugaputa-logo.svg" alt="" className="w-5 h-5"/> Bugaputa — original bug-reporting toolkit</span>
            <span>© {new Date().getFullYear()} Bugaputa. Not affiliated with Ybug.</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
