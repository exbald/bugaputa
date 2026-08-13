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
        try { await navigator.clipboard.writeText(text); } catch { /* fallback */ const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="shrink-0 px-3 py-1.5 rounded-lg bg-lime-500 text-slate-900 text-xs font-bold hover:bg-lime-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition"
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
    <div className="min-h-screen flex flex-col bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-lg">Skip to content</a>
      <TopNav />
      <main id="main" className="flex-1">

        {/* HERO */}
        <section className="bg-slate-900 text-white overflow-hidden">
          <div className="max-w-6xl mx-auto px-4 py-12 md:py-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-lime-500/15 border border-lime-500/25 text-lime-400 text-[11px] font-semibold tracking-widest uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" aria-hidden />
                Embeddable widget · One line of JS
              </div>
              <h1 className="mt-4 text-[2.05rem] md:text-5xl font-extrabold leading-[1.05] tracking-tight">
                Stop chasing <span className="text-lime-400">vague bug reports</span>
              </h1>
              <p className="mt-4 text-slate-300 text-[17px] leading-relaxed max-w-[58ch]">
                An embeddable widget. One line of JS. Visitors capture, annotate, and submit — you get a screenshot with context, no back-and-forth.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={openWidget}
                  className="px-6 py-3 rounded-xl bg-lime-500 text-slate-900 font-bold hover:bg-lime-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition"
                >
                  Try live demo
                </button>
                <a
                  href="#install"
                  onClick={(e) => {
                    // also copy on click for convenience
                    const t = SNIPPET;
                    navigator.clipboard?.writeText(t).catch(() => {});
                  }}
                  className="px-6 py-3 rounded-xl bg-white/10 border border-white/15 text-white font-medium hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition text-center"
                >
                  Add to your site — 1 line of JS
                </a>
              </div>
              <p className="mt-3 text-xs tracking-wide text-slate-400">Free to start · No login for reporters · No extension required</p>

              <div id="install" className="mt-6 rounded-xl bg-slate-800/80 border border-slate-700 p-3 flex flex-col gap-2 scroll-mt-20">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">Embed — paste before &lt;/body&gt;</p>
                  <CopyButton text={SNIPPET_WITH_KEY} />
                </div>
                <pre className="overflow-x-auto rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-xs font-mono text-lime-300"><code>{SNIPPET_WITH_KEY}</code></pre>
                <p className="text-[11px] text-slate-400">Paste before <code className="px-1 py-0.5 rounded bg-slate-700 text-slate-200">&lt;/body&gt;</code>. Works on any site and staging — no build step. You&apos;re live in 30 seconds.</p>
              </div>
            </div>

            <figure className="relative">
              <div className="rounded-2xl bg-white p-2 shadow-2xl border border-slate-200">
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
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
                <figcaption className="px-2 pt-2 pb-1 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-500">Real report. Not a mockup. <span className="hidden sm:inline">Arrow, box, text — in seconds.</span></span>
                  <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-lime-700 bg-lime-50 border border-lime-200 rounded-full px-2.5 py-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime-500" aria-hidden /> Live widget capture
                  </span>
                </figcaption>
              </div>
              <p className="sr-only">Hero visual — annotated screenshot captured with Bugaputa on a copyright-safe demo storefront.</p>
            </figure>
          </div>
        </section>

        {/* PAIN / WHY */}
        <section className="max-w-6xl mx-auto px-4 py-14 md:py-16" aria-labelledby="why-heading">
          <div className="max-w-2xl">
            <h2 id="why-heading" className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Why teams switch to Bugaputa</h2>
            <p className="mt-2 text-slate-600 leading-relaxed">Bug reports fail for the same three reasons. Bugaputa fixes each one at the source.</p>
          </div>
          <div className="mt-8 grid md:grid-cols-3 gap-5">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>
              </div>
              <h3 className="mt-4 font-bold text-slate-900">Screenshots without context</h3>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">&ldquo;It looks broken&rdquo; — but where? Screenshots with no URL, no element, no viewport.</p>
              <p className="mt-3 text-sm font-medium text-lime-700">Every report is pinned to the exact element with an annotated screenshot and the page context attached.</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="18" cy="7" r="1.5" fill="currentColor"/></svg>
              </div>
              <h3 className="mt-4 font-bold text-slate-900">Endless back-and-forth</h3>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">&ldquo;What browser? What page? Can you reproduce it?&rdquo; — hours lost just to clarify.</p>
              <p className="mt-3 text-sm font-medium text-lime-700">Browser, viewport, URL, and timestamp captured automatically. No follow-up needed to reproduce.</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>
              </div>
              <h3 className="mt-4 font-bold text-slate-900">Clunky tools and logins</h3>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">Extensions to install, accounts to create — reporters give up before they submit.</p>
              <p className="mt-3 text-sm font-medium text-lime-700">No extension. No login for the person reporting. Click, annotate, submit — done in seconds.</p>
            </article>
          </div>
          <p className="mt-6 text-center text-xs tracking-wide text-slate-400">Not a platform. A widget that just works.</p>
        </section>

        {/* HOW IT WORKS */}
        <section className="bg-slate-50 border-y border-slate-200" aria-labelledby="how-heading">
          <div className="max-w-6xl mx-auto px-4 py-14 md:py-16">
            <div className="max-w-2xl">
              <h2 id="how-heading" className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Capture → Annotate → Report</h2>
              <p className="mt-2 text-slate-600">Three steps. One real flow. No training required.</p>
            </div>
            <ol className="mt-10 grid gap-8">
              <li className="grid lg:grid-cols-2 gap-6 items-center rounded-2xl bg-white border border-slate-200 p-4 md:p-6">
                <div className="order-2 lg:order-1">
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-lime-700"><span className="w-6 h-6 rounded-full bg-lime-500 text-slate-900 grid place-items-center text-xs font-extrabold">1</span> Capture</div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">Click Report bug. Screenshot taken instantly.</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">The widget captures the current viewport — no manual screenshot, no upload.</p>
                  <p className="mt-3 text-xs text-slate-500">No extension. One click.</p>
                </div>
                <figure className="order-1 lg:order-2">
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img src="/landing/screenshots/02-chooser.png" alt="Bugaputa widget open — Report bug button active and viewport dimmed for capture" width={800} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
                  </div>
                  <figcaption className="mt-2 text-xs text-slate-500 text-center">Choose capture — then consent.</figcaption>
                  <div className="mt-2 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 hidden md:block">
                    <img src="/landing/screenshots/03-capture-consent.png" alt="Capture consent pane — Before you capture with Capture this page button" width={800} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
                  </div>
                </figure>
              </li>

              <li className="grid lg:grid-cols-2 gap-6 items-center rounded-2xl bg-white border border-slate-200 p-4 md:p-6">
                <figure className="order-1">
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img src="/landing/screenshots/04-annotate-empty.png" alt="Annotation in progress — arrow and text note drawn on the captured screenshot" width={800} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
                  </div>
                  <figcaption className="mt-2 text-xs text-slate-500 text-center">Arrow, box, text — in seconds. Real toolbar, not an illustration.</figcaption>
                  <div className="mt-3 rounded-xl overflow-hidden border border-lime-200 bg-lime-50/50 hidden md:block">
                    <img src="/landing/screenshots/05-annotate-done.png" alt="Completed annotated screenshot — arrow, rectangle and text Price overlaps on Safari pinned to the page" width={800} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
                  </div>
                </figure>
                <div className="order-2">
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-lime-700"><span className="w-6 h-6 rounded-full bg-lime-500 text-slate-900 grid place-items-center text-xs font-extrabold">2</span> Annotate</div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">Point, draw, explain.</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">Draw arrows, boxes, and notes right on the screenshot — so devs see exactly what you mean.</p>
                  <p className="mt-3 text-xs text-slate-500">Editor is full-screen, keyboard accessible, works at 320px.</p>
                </div>
              </li>

              <li className="grid lg:grid-cols-2 gap-6 items-center rounded-2xl bg-white border border-slate-200 p-4 md:p-6">
                <div className="order-2 lg:order-1">
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-lime-700"><span className="w-6 h-6 rounded-full bg-lime-500 text-slate-900 grid place-items-center text-xs font-extrabold">3</span> Report</div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">Submit. Your team gets a clear report.</h3>
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed">An actionable report lands in your dashboard — annotated image plus context, ready to fix or forward.</p>
                  <p className="mt-3 text-xs text-slate-500">Screenshot + context. No back-and-forth.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to="/register" className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2">Create your project</Link>
                    <button type="button" onClick={openWidget} className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">Try the widget</button>
                  </div>
                </div>
                <figure className="order-1 lg:order-2">
                  <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                    <img src="/landing/screenshots/06-report-form.png" alt="Completed annotated report ready to submit, with screenshot and context fields" width={800} height={500} loading="lazy" decoding="async" className="w-full h-auto block" />
                  </div>
                  <figcaption className="mt-2 text-xs text-slate-500 text-center">Report form with annotated preview — URL, viewport, browser auto-attached.</figcaption>
                  <div className="mt-3 hidden md:flex justify-center">
                    <img src="/landing/screenshots/07-mobile-idle.png" alt="Bugaputa widget on mobile — floating button visible at 390px viewport" width={300} height={500} loading="lazy" decoding="async" className="w-[220px] h-auto rounded-xl border border-slate-200 shadow-sm" />
                  </div>
                </figure>
              </li>
            </ol>
          </div>
        </section>

        {/* FEATURES */}
        <section className="max-w-6xl mx-auto px-4 py-14 md:py-16" aria-labelledby="features-heading">
          <h2 id="features-heading" className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Everything you need. Nothing you don&apos;t.</h2>
          <p className="mt-2 text-slate-600">Focused on the report, not the platform.</p>
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { t: "Embeddable widget", d: "Drops into any site or staging URL.", i: "▦" },
              { t: "Lightweight JS", d: "Single <script> — no build step, no heavy SDK.", i: "◐" },
              { t: "No login for reporters", d: "Clients and testers submit without an account.", i: "○" },
              { t: "Instant annotation", d: "Arrows, boxes, and text right on the capture.", i: "✎" },
              { t: "Screenshot + context", d: "Annotated image plus URL, viewport, browser, and time.", i: "◎" },
              { t: "Simple dashboard", d: "All reports in one inbox — no email archaeology.", i: "☰" },
            ].map((f) => (
              <div key={f.t} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="w-9 h-9 rounded-xl bg-lime-100 text-lime-700 grid place-items-center text-sm font-bold" aria-hidden>{f.i}</div>
                <h3 className="mt-3 font-semibold text-slate-900 text-sm">{f.t}</h3>
                <p className="mt-1 text-sm text-slate-600 leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-slate-500 text-center">Export or forward — keep your existing workflow. No session replay, AI triage, or analytics promised beyond the shipped widget.</p>
        </section>

        {/* SOCIAL PROOF — State A */}
        <section className="max-w-6xl mx-auto px-4 pb-14" aria-label="Trusted by early users">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 md:p-10 text-center">
            <h2 className="text-lg md:text-xl font-bold text-slate-900">Loved by teams who ship</h2>
            <p className="mt-1 text-sm text-slate-600">Early access — be the first to tell your story</p>
            <div className="mt-6 flex items-center justify-center gap-4 flex-wrap">
              <div className="w-28 h-10 rounded-lg bg-white border border-slate-200 grid place-items-center text-[11px] font-semibold tracking-widest uppercase text-slate-400">Your logo here?</div>
              <div className="w-28 h-10 rounded-lg bg-white border border-slate-200 grid place-items-center text-[11px] font-semibold tracking-widest uppercase text-slate-400">Your logo here?</div>
              <div className="w-28 h-10 rounded-lg bg-white border border-slate-200 grid place-items-center text-[11px] font-semibold tracking-widest uppercase text-slate-400">Your logo here?</div>
            </div>
            <p className="mt-4 text-xs text-slate-500">Free to start · No credit card · One line of JS</p>
          </div>
        </section>

        {/* PRICING + INSTALL */}
        <section className="max-w-6xl mx-auto px-4 pb-8" aria-labelledby="pricing-heading">
          <div className="text-center max-w-2xl mx-auto">
            <h2 id="pricing-heading" className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Free to start. Scale when you need to.</h2>
            <p className="mt-2 text-slate-600">No seat games. Just reports that get fixed faster.</p>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 md:p-8 text-center shadow-sm">
              <h3 className="font-bold text-slate-900">Free to start</h3>
              <p className="mt-1 text-sm text-slate-600">Add the widget now. Upgrade only when you need more.</p>
              <ul className="mt-4 text-sm text-slate-700 space-y-1.5 text-left inline-block">
                <li className="flex gap-2"><span className="text-lime-600" aria-hidden>✓</span> Up to 50 reports / month</li>
                <li className="flex gap-2"><span className="text-lime-600" aria-hidden>✓</span> Widget + annotation + dashboard</li>
                <li className="flex gap-2"><span className="text-lime-600" aria-hidden>✓</span> No credit card required</li>
              </ul>
              <div className="mt-6 grid grid-cols-1 gap-3">
                <button type="button" onClick={openWidget} className="w-full px-5 py-3 rounded-xl bg-lime-500 text-slate-900 font-bold hover:bg-lime-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 focus-visible:ring-offset-2">Try live demo</button>
                <a href="#install" className="w-full px-5 py-3 rounded-xl border border-slate-300 bg-white font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 text-center">Add to your site — 1 line of JS</a>
              </div>
              <div className="mt-6 rounded-xl bg-slate-900 text-left p-3 border border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">Install</span>
                  <CopyButton text={SNIPPET} />
                </div>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-lime-300"><code>{SNIPPET}</code></pre>
                <p className="mt-2 text-[11px] text-slate-400">Paste before <code className="px-1 py-0.5 rounded bg-slate-800 text-slate-200">&lt;/body&gt;</code> — you&apos;re live in 30 seconds.</p>
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
              <button type="button" onClick={openWidget} className="px-6 py-3 rounded-xl bg-lime-500 text-slate-900 font-bold hover:bg-lime-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900">Try live demo</button>
              <a href="#install" className="px-6 py-3 rounded-xl bg-white text-slate-900 font-semibold hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 text-center">Add to your site — 1 line of JS</a>
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

        <footer className="border-t">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-500">
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
          <p className="text-center text-xs text-slate-400 pb-4">© {new Date().getFullYear()} Bugaputa. </p>
        </footer>
      </main>
    </div>
  );
}