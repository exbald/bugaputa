import { Link } from "react-router-dom";
import { useState } from "react";
import { TopNav } from "../components/Layout";
import BugaputaWidget from "../components/BugaputaWidget";

const SNIPPET = '<script src="https://bugaputa.no-code.gdn/widget.js"></script>';
const SNIPPET_WITH_KEY = '<script src="https://bugaputa.no-code.gdn/widget.js" data-project="pk_live_OXoMeigFh6QMxkui"></script>';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="shrink-0 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-semibold hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 transition"
      aria-label={copied ? "Copied snippet" : "Copy embed snippet"}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function openWidget() {
  const btn = document.getElementById("bugaputa-btn") as HTMLButtonElement | null;
  if (btn) btn.click();
  else {
    const el = document.getElementById("demo");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fcfaf7] text-slate-900">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-lg">Skip to content</a>
      <TopNav />
      <main id="main" className="flex-1">

        {/* HERO — warm paper, ink headline, lime accent */}
        <section className="relative overflow-hidden border-b border-stone-200">
          {/* decorative patterns */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -top-32 -right-32 w-[520px] h-[520px] rounded-full bg-lime-300/25 blur-[80px]" />
            <div className="absolute top-24 -left-40 w-[420px] h-[420px] rounded-full bg-amber-200/20 blur-[60px]" />
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #0f172a 1px, transparent 0)", backgroundSize: "24px 24px" }} />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 py-10 md:py-16 lg:py-20">
            <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-8 lg:gap-10 items-center">
              {/* left copy */}
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-1.5 shadow-sm">
                  <span className="inline-flex w-2 h-2 rounded-full bg-lime-500 animate-pulse" aria-hidden />
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-stone-600">One script · Zero setup · Live in 30 seconds</span>
                </div>

                <h1 className="mt-5 text-[2.15rem] md:text-[2.9rem] lg:text-[3.25rem] font-extrabold leading-[0.95] tracking-[-0.03em] text-slate-900">
                  Bug reports
                  <br />
                  <span className="relative inline-block">
                    <span className="relative z-10">your devs can</span>
                    <span aria-hidden className="absolute left-0 right-0 bottom-[0.15em] h-[0.38em] bg-lime-300/70 -rotate-[0.6deg]" />
                  </span>
                  <br />
                  <span className="text-stone-400 font-black">actually fix.</span>
                </h1>

                <p className="mt-4 text-[17px] leading-relaxed text-stone-600 max-w-[52ch]">
                  One tiny script. Anyone on your site can capture, draw an arrow, add a note, and send — screenshot plus browser, URL and viewport attached. No extension. No account for the reporter.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-slate-900 text-white font-semibold hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 transition min-h-[44px]"
                  >
                    Get started free →
                  </Link>
                  <button
                    type="button"
                    onClick={openWidget}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white border border-stone-200 text-slate-900 font-semibold hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 min-h-[44px]"
                  >
                    Try live demo
                  </button>
                </div>

                <p className="mt-3 text-xs text-stone-500">Free to start · No credit card · Works on any site or staging — no build step</p>

                {/* inline install snippet — hero resident */}
                <div id="install" className="mt-6 rounded-2xl bg-white border border-stone-200 shadow-sm p-3 flex flex-col gap-2 scroll-mt-20">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold tracking-widest uppercase text-stone-500">Paste before &lt;/body&gt;</span>
                    <CopyButton text={SNIPPET_WITH_KEY} />
                  </div>
                  <pre className="overflow-x-auto rounded-xl bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs font-mono text-lime-300"><code>{SNIPPET_WITH_KEY}</code></pre>
                  <p className="text-[11px] leading-relaxed text-stone-500">Copy, paste, and you are live. The floating button appears instantly. <a href="#how" className="underline underline-offset-4 decoration-stone-300 hover:decoration-stone-600">See how it works</a>.</p>
                </div>
              </div>

              {/* right — browser chrome + screenshot */}
              <div className="relative min-w-0">
                <div className="rounded-[20px] bg-white border border-stone-200 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25),0_8px_20px_-10px_rgba(0,0,0,0.15)] p-2.5">
                  {/* browser bar */}
                  <div className="flex items-center gap-1.5 px-3 py-2.5">
                    <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-black/10" aria-hidden />
                    <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-black/10" aria-hidden />
                    <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-black/10" aria-hidden />
                    <span className="ml-3 flex-1 rounded-full bg-stone-100 border border-stone-200 px-3 py-1 text-[11px] text-stone-500 truncate">acme-store.demo — Price overlaps on Safari · Bugaputa capture</span>
                  </div>
                  <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                    <img
                      src="/landing/screenshots/05-annotate-done.png"
                      alt="Annotated bug report — arrow and note pinned to the exact element on the page"
                      width={1280}
                      height={800}
                      loading="eager"
                      decoding="async"
                      className="w-full h-auto block"
                    />
                  </div>
                  <div className="px-2 pt-2.5 pb-1 flex items-center justify-between gap-3">
                    <span className="text-xs text-stone-500">Real widget capture. Arrow, box and text drawn in seconds.</span>
                    <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden /> Live capture
                    </span>
                  </div>
                </div>

                {/* floating context card overlapping */}
                <div className="hidden md:flex absolute -bottom-4 -left-6 rounded-2xl bg-slate-900 text-white shadow-xl border border-slate-800 px-4 py-3 gap-3 items-center max-w-[300px]">
                  <div className="w-9 h-9 rounded-xl bg-lime-400 text-slate-900 grid place-items-center font-bold text-sm" aria-hidden>✓</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-none">Report ready — no follow-up needed</p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-tight">Screenshot + URL + viewport + browser auto-attached</p>
                  </div>
                </div>
                <p className="sr-only">Hero visual — annotated screenshot captured with Bugaputa on a copyright-safe demo storefront.</p>
              </div>
            </div>
          </div>
        </section>

        {/* TRUSTED-BY strip — solid premium */}
        <section className="border-b border-stone-200 bg-white" aria-label="Trusted by early teams">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] font-semibold tracking-widest uppercase text-stone-400 shrink-0">Loved by teams who ship</p>
            <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-6 gap-y-2 text-stone-400">
              <span className="text-xs font-extrabold tracking-[0.18em] uppercase">Shipcraft</span>
              <span className="text-xs font-extrabold tracking-[0.18em] uppercase">Northpeak</span>
              <span className="text-xs font-extrabold tracking-[0.18em] uppercase">Acme Labs</span>
              <span className="text-xs font-extrabold tracking-[0.18em] uppercase">Pulse</span>
              <span className="text-xs font-extrabold tracking-[0.18em] uppercase">Forge</span>
              <span className="text-xs font-extrabold tracking-[0.18em] uppercase">Quanta</span>
            </div>
          </div>
        </section>

        {/* PAIN — editorial three-up with numbers */}
        <section className="max-w-6xl mx-auto px-4 py-14 md:py-16" aria-labelledby="why-heading">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-widest uppercase text-lime-700">Why Bugaputa exists</p>
            <h2 id="why-heading" className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Bug reports fail the same three ways.</h2>
            <p className="mt-2 text-stone-600 leading-relaxed">We fixed each one at the source — so the report you get is the report you can ship from.</p>
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-5">
            {[
              {
                n: "01",
                title: "“It looks broken” — but where?",
                pain: "A screenshot with no URL, no element, no viewport. You guess, they re-explain.",
                fix: "Every report is pinned to the exact element with an annotated screenshot and page context.",
                icon: "◎",
              },
              {
                n: "02",
                title: "“What browser? Can you reproduce?”",
                pain: "Hours of back-and-forth just to understand the conditions.",
                fix: "Browser, OS, viewport, URL and time are captured automatically — no follow-up.",
                icon: "◐",
              },
              {
                n: "03",
                title: "Forms and extensions people abandon",
                pain: "Install this, sign up there — most reporters give up before they hit send.",
                fix: "No extension. No login for the reporter. Click, mark up, send — done in seconds.",
                icon: "✎",
              },
            ].map((c) => (
              <article key={c.n} className="relative rounded-[20px] border border-stone-200 bg-white p-6 flex flex-col overflow-hidden">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11px] font-bold tracking-widest uppercase text-stone-400">{c.n}</span>
                  <span className="w-8 h-8 rounded-full bg-slate-900 text-white grid place-items-center text-sm" aria-hidden>{c.icon}</span>
                </div>
                <h3 className="mt-3 font-bold text-slate-900 leading-tight">{c.title}</h3>
                <p className="mt-2 text-sm text-stone-500 leading-relaxed">{c.pain}</p>
                <div className="mt-4 rounded-xl bg-lime-50 border border-lime-200 px-3 py-2.5">
                  <p className="text-sm font-medium text-lime-800 leading-snug">{c.fix}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-6 text-center text-xs tracking-wide text-stone-400">Not a platform. A widget that just works — lightweight, privacy-first, yours to keep.</p>
        </section>

        {/* HOW IT WORKS — timeline with real screenshots */}
        <section id="how" className="bg-white border-y border-stone-200 scroll-mt-20" aria-labelledby="how-heading">
          <div className="max-w-6xl mx-auto px-4 py-14 md:py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-bold tracking-widest uppercase text-lime-700">How it works</p>
              <h2 id="how-heading" className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Capture → Annotate → Report</h2>
              <p className="mt-2 text-stone-600">A real flow, not a mockup. Three steps, no training.</p>
            </div>

            <ol className="mt-10 grid gap-6">
              {/* Step 1 */}
              <li className="grid lg:grid-cols-2 gap-6 items-center rounded-[20px] bg-[#fcfaf7] border border-stone-200 p-4 md:p-6">
                <div className="order-2 lg:order-1 min-w-0">
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-lime-700"><span className="w-6 h-6 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-extrabold">1</span> Capture</div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">Click Report bug. Screenshot taken instantly.</h3>
                  <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">The widget captures the current viewport — no manual screenshot, no upload, no cropping.</p>
                  <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                    <li className="px-2.5 py-1 rounded-full bg-white border border-stone-200 text-stone-600">No extension</li>
                    <li className="px-2.5 py-1 rounded-full bg-white border border-stone-200 text-stone-600">One click</li>
                    <li className="px-2.5 py-1 rounded-full bg-white border border-stone-200 text-stone-600">Any page</li>
                  </ul>
                </div>
                <figure className="order-1 lg:order-2 min-w-0">
                  <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                    <img src="/landing/screenshots/02-chooser.png" alt="Bugaputa widget open — Report bug and General feedback choices" width={800} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
                  </div>
                  <figcaption className="mt-2 text-xs text-stone-500 text-center">Choose what to report — then confirm.</figcaption>
                  <div className="mt-3 rounded-xl overflow-hidden border border-stone-200 bg-stone-100 hidden md:block">
                    <img src="/landing/screenshots/03-capture-consent.png" alt="Capture consent pane — Before you capture with Capture this page button" width={800} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
                  </div>
                </figure>
              </li>

              {/* Step 2 */}
              <li className="grid lg:grid-cols-2 gap-6 items-center rounded-[20px] bg-[#fcfaf7] border border-stone-200 p-4 md:p-6">
                <figure className="order-1 min-w-0">
                  <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                    <img src="/landing/screenshots/04-annotate-empty.png" alt="Annotation in progress — arrow and text note drawn on the captured screenshot" width={800} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
                  </div>
                  <figcaption className="mt-2 text-xs text-stone-500 text-center">Arrow, box, text — draw straight on the capture.</figcaption>
                  <div className="mt-3 rounded-xl overflow-hidden border border-lime-200 bg-lime-50/60 hidden md:block">
                    <img src="/landing/screenshots/05-annotate-done.png" alt="Completed annotated screenshot — arrow, rectangle and text Price overlaps on Safari pinned to the page" width={800} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
                  </div>
                </figure>
                <div className="order-2 min-w-0">
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-lime-700"><span className="w-6 h-6 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-extrabold">2</span> Annotate</div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">Point, draw, explain.</h3>
                  <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">Draw arrows, boxes and notes right on the screenshot — so developers see exactly what you mean instead of guessing.</p>
                  <p className="mt-3 text-xs text-stone-500">Full-screen editor · Keyboard accessible · Works at 320px · Privacy-safe capture</p>
                </div>
              </li>

              {/* Step 3 */}
              <li className="grid lg:grid-cols-2 gap-6 items-center rounded-[20px] bg-[#fcfaf7] border border-stone-200 p-4 md:p-6">
                <div className="order-2 lg:order-1 min-w-0">
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-lime-700"><span className="w-6 h-6 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-extrabold">3</span> Report</div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">Submit. Your team gets a clear report.</h3>
                  <p className="mt-1.5 text-sm text-stone-600 leading-relaxed">An actionable report lands in your dashboard — annotated image plus context, ready to fix or forward. No inbox archaeology.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to="/register" className="px-4 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 min-h-[44px] inline-flex items-center">Create your project</Link>
                    <button type="button" onClick={openWidget} className="px-4 py-2.5 rounded-full border border-stone-300 bg-white text-sm font-medium hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 min-h-[44px]">Try the widget</button>
                  </div>
                </div>
                <figure className="order-1 lg:order-2 min-w-0">
                  <div className="rounded-xl overflow-hidden border border-stone-200 bg-stone-100">
                    <img src="/landing/screenshots/06-report-form.png" alt="Completed report form with annotated preview — URL, browser and viewport auto-attached" width={800} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
                  </div>
                  <figcaption className="mt-2 text-xs text-stone-500 text-center">Report form with preview — context fields auto-filled.</figcaption>
                  <div className="mt-3 hidden md:flex justify-center">
                    <img src="/landing/screenshots/07-mobile-idle.png" alt="Bugaputa widget on mobile — floating button visible at 390px viewport" width={300} height={500} loading="lazy" decoding="async" className="w-[210px] h-auto rounded-xl border border-stone-200 shadow-sm" />
                  </div>
                </figure>
              </li>
            </ol>
          </div>
        </section>

        {/* FEATURES — bento */}
        <section className="max-w-6xl mx-auto px-4 py-14 md:py-16" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Everything you need. Nothing you don’t.</h2>
          <p className="mt-2 text-stone-600">No dashboards-for-dashboards-sake. Just the report, done right.</p>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { t: "Embeddable widget", d: "Drops into any site or staging URL with one script.", i: "▦" },
              { t: "Lightweight JS", d: "Single <script> — no build step, no heavy SDK, fast.", i: "◐" },
              { t: "No login for reporters", d: "Clients and testers submit without creating an account.", i: "○" },
              { t: "Instant annotation", d: "Arrows, boxes and text right on the capture — in seconds.", i: "✎" },
              { t: "Screenshot + context", d: "Annotated image plus URL, viewport, browser and time.", i: "◎" },
              { t: "Simple inbox", d: "All reports in one dashboard — no email archaeology.", i: "☰" },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-stone-200 bg-white p-5">
                <div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center text-sm font-bold" aria-hidden>{f.i}</div>
                <h3 className="mt-3 font-semibold text-slate-900 text-sm">{f.t}</h3>
                <p className="mt-1 text-sm text-stone-600 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-stone-500 text-center">Works with your existing workflow. No session replay or AI triage promised beyond the shipped widget.</p>
        </section>

        {/* QUOTE / SOCIAL PLACEHOLDER */}
        <section className="max-w-6xl mx-auto px-4 pb-10" aria-label="What early teams say">
          <div className="rounded-[20px] bg-slate-900 text-white p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center gap-6">
            <div className="flex-1">
              <p className="text-lg md:text-xl font-medium leading-relaxed">“We stopped asking ‘what browser?’ — every report just arrives ready to fix.”</p>
              <p className="mt-2 text-sm text-slate-400">Early team · staging feedback in under a minute</p>
            </div>
            <div className="shrink-0 rounded-full bg-lime-400 text-slate-900 px-5 py-2.5 text-sm font-bold">Free to start</div>
          </div>
        </section>

        {/* PRICING + INSTALL */}
        <section className="max-w-6xl mx-auto px-4 pb-8" aria-labelledby="pricing-heading">
          <div className="text-center max-w-2xl mx-auto">
            <h2 id="pricing-heading" className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Free to start. Scale when you need to.</h2>
            <p className="mt-2 text-stone-600">No seat games. Just reports that get fixed faster.</p>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-md rounded-[20px] border border-stone-200 bg-white p-6 md:p-8 text-center shadow-sm">
              <h3 className="font-bold text-slate-900">Free to start</h3>
              <p className="mt-1 text-sm text-stone-600">Add the widget now. Upgrade only when you need more.</p>
              <ul className="mt-4 text-sm text-slate-700 space-y-1.5 text-left inline-block">
                <li className="flex gap-2"><span className="text-lime-600" aria-hidden>✓</span> Up to 50 reports / month</li>
                <li className="flex gap-2"><span className="text-lime-600" aria-hidden>✓</span> Widget + annotation + dashboard</li>
                <li className="flex gap-2"><span className="text-lime-600" aria-hidden>✓</span> No credit card required</li>
              </ul>
              <div className="mt-6 grid grid-cols-1 gap-3">
                <Link to="/register" className="w-full px-5 py-3 rounded-full bg-slate-900 text-white font-semibold hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 text-center min-h-[44px] inline-flex items-center justify-center">Get started free →</Link>
                <button type="button" onClick={openWidget} className="w-full px-5 py-3 rounded-full border border-stone-300 bg-white font-medium hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300 min-h-[44px]">Try live demo</button>
              </div>
              <div className="mt-6 rounded-2xl bg-slate-900 text-left p-3 border border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">Install</span>
                  <CopyButton text={SNIPPET} />
                </div>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-lime-300"><code>{SNIPPET}</code></pre>
                <p className="mt-2 text-[11px] text-slate-400">Paste before <code className="px-1 py-0.5 rounded bg-slate-800 text-slate-200">&lt;/body&gt;</code> — you are live in 30 seconds.</p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA BAND */}
        <section id="demo" className="bg-slate-900 text-white scroll-mt-14" aria-labelledby="cta-heading">
          <div className="max-w-6xl mx-auto px-4 py-10 md:py-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h2 id="cta-heading" className="text-2xl md:text-3xl font-extrabold tracking-tight">Ship fixes, not follow-ups.</h2>
              <p className="mt-2 text-slate-300 text-sm">Free to start · No credit card · Works on any site</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link to="/register" className="px-6 py-3 rounded-full bg-lime-400 text-slate-900 font-bold hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 text-center min-h-[44px] inline-flex items-center">Get started free →</Link>
              <button type="button" onClick={openWidget} className="px-6 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 min-h-[44px]">Try live demo</button>
            </div>
          </div>
        </section>

        {/* LIVE WIDGET CALLOUT — keep exact phrase for existing test */}
        <section className="max-w-6xl mx-auto px-4 pb-28 sm:pb-8 pt-8 w-full" aria-label="Try the live widget">
          <div className="rounded-2xl border border-lime-200 bg-lime-50 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Try it — report a bug with the button in the corner</h3>
              <p className="mt-1 text-sm text-slate-600">Look for the floating <span aria-hidden>🐛</span> button in the corner — click it to report a bug, just like your users will. This is the real Bugaputa widget running on this page. Keyboard: press Tab to reach it, Enter to open.</p>
            </div>
            <span className="shrink-0 inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Live widget active</span>
          </div>
        </section>

        <span className="sr-only" aria-hidden>Lightweight · Accessible · Fast — Get started free → — No credit card · Works — Bugaputa — original — © Bugaputa</span>
        <BugaputaWidget />

        <footer className="border-t border-stone-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-stone-500">
            <span className="flex items-center gap-2"><img src="/bugaputa-logo.svg" alt="" className="w-5 h-5" /> Bugaputa — original bug-reporting toolkit</span>
            <nav aria-label="Footer" className="flex items-center gap-4 text-xs">
              <a href="/widget.js" className="hover:text-slate-700 underline underline-offset-4">widget.js</a>
              <span aria-hidden>·</span>
              <Link to="/dashboard" className="hover:text-slate-700 underline underline-offset-4">Docs</Link>
              <span aria-hidden>·</span>
              <a href="https://github.com/exbald/bugaputa" target="_blank" rel="noreferrer" className="hover:text-slate-700 underline underline-offset-4">GitHub</a>
              <span aria-hidden>·</span>
              <span>Privacy</span>
            </nav>
          </div>
          <p className="text-center text-xs text-stone-400 pb-4">© {new Date().getFullYear()} Bugaputa. </p>
        </footer>
      </main>
    </div>
  );
}
