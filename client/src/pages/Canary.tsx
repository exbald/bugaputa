import { Link } from "react-router-dom";
import { TopNav } from "../components/Layout";
import BugaputaWidget from "../components/BugaputaWidget";

const codeBlockStyle: React.CSSProperties = {
  display: "block",
  overflowWrap: "anywhere",
  wordBreak: "break-word",
  whiteSpace: "normal",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "13px",
  lineHeight: "1.6",
};

export default function Canary() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <TopNav />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 md:py-10">
        {/* Header with badge */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden /> Canary
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold">Preview</span>
          <span className="text-xs text-slate-500">Responsive fixture for capture fidelity</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Native Capture — Canary</h1>
        <p className="mt-2 text-sm md:text-base text-slate-600 leading-relaxed max-w-2xl">
          Verify page capture and annotation at mobile and desktop widths.
        </p>

        {/* Info cards grid */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="border rounded-xl p-4 bg-white">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Project</div>
            <div className="mt-1 text-sm font-mono text-slate-900 break-all">pk_live_OXoMeigFh6QMxkui</div>
          </div>
          <div className="border rounded-xl p-4 bg-white">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Route</div>
            <div className="mt-1 text-sm font-medium text-slate-900">/canary</div>
            <div className="mt-1 text-xs text-slate-500">Public — no auth required</div>
          </div>
          <div className="border rounded-xl p-4 bg-white">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Capture</div>
            <div className="mt-1 text-sm text-slate-700">Desktop: native if opt-in. Mobile: approximate or upload.</div>
          </div>
        </div>

        {/* Branch + snippet as separate labeled cards with proper code wrapping */}
        <div className="mt-6 grid gap-4">
          <div className="border rounded-xl p-4 bg-white">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Branch</div>
            <code style={codeBlockStyle} className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800">
              canary/native-optin-runtime-fix
            </code>
          </div>
          <div className="border rounded-xl p-4 bg-white">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Embed snippet</div>
            <code style={codeBlockStyle} className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-100">
              {'<script src="https://bugaputa.no-code.gdn/widget.js" data-project="pk_live_OXoMeigFh6QMxkui"></script>'}
            </code>
          </div>
          <div className="border rounded-xl p-4 bg-white">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Opt-in (native)</div>
            <code style={codeBlockStyle} className="mt-2 p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800">
              {'<script src="https://bugaputa.no-code.gdn/widget.js" data-project="pk_live_OXoMeigFh6QMxkui" data-native-capture="true"></script>'}
            </code>
            <p className="mt-2 text-xs text-slate-500">Add data-native-capture=&quot;true&quot; only where you want pixel-perfect capture.</p>
          </div>
        </div>

        {/* Visual fixture: grid + flex + text + badge + code */}
        <section className="mt-6 border rounded-xl p-4 bg-white" aria-label="Capture fidelity fixture">
          <h2 className="text-sm font-bold text-slate-900">Fidelity fixture</h2>
          <p className="mt-1 text-xs text-slate-500">Grid, flex, text, badge, code — all should survive html2canvas without overlap.</p>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {["Alpha", "Beta", "Gamma", "Delta"].map((label) => (
              <div key={label} className="rounded-lg border border-slate-200 p-3 bg-slate-50 flex flex-col gap-2">
                <span className="inline-flex self-start px-2 py-0.5 rounded-full bg-lime-100 border border-lime-200 text-lime-800 text-[11px] font-semibold">{label}</span>
                <span className="text-sm font-medium text-slate-800">{label} card</span>
                <span className="text-xs text-slate-500">Short text.</span>
                <code style={codeBlockStyle} className="text-[11px] p-2 rounded bg-white border border-slate-200">code-{label.toLowerCase()}</code>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-900 text-white text-xs font-semibold">Badge A</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-medium">Badge B</span>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold">Badge C</span>
          </div>

          <div className="mt-4 flex gap-3">
            <div className="flex-1 rounded-lg bg-slate-900 text-white p-3">
              <div className="text-xs font-semibold text-lime-400">Dark panel</div>
              <div className="mt-1 text-sm">Contrast check.</div>
            </div>
            <div className="flex-1 rounded-lg bg-lime-50 border border-lime-200 p-3">
              <div className="text-xs font-semibold text-slate-700">Light panel</div>
              <div className="mt-1 text-sm text-slate-600">No overlap at 360px.</div>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="mt-6 border rounded-xl p-4 bg-white">
          <h2 className="text-sm font-bold text-slate-900">Manual flow</h2>
          <ol className="mt-3 space-y-2 text-sm text-slate-700 list-decimal list-inside">
            <li>Click the floating Bugaputa button (bottom-right).</li>
            <li>Choose &quot;Capture and annotate this page&quot;.</li>
            <li>Confirm capture, annotate, then submit.</li>
            <li>Or choose &quot;General feedback&quot; for text-only.</li>
          </ol>
        </section>

        {/* Warning — short */}
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-xs font-semibold text-amber-900">Note</div>
          <p className="mt-1 text-sm text-amber-800 leading-relaxed">
            Screenshots are approximate on this device. For pixel-perfect capture, use desktop Chrome with opt-in.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/" className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold">Back to landing</Link>
          <Link to="/register" className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium">Create project</Link>
        </div>
      </main>
      <BugaputaWidget />
    </div>
  );
}
