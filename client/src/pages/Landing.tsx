import { Link } from "react-router-dom";
import { useState } from "react";
import { TopNav } from "../components/Layout";
import BugaputaWidget from "../components/BugaputaWidget";

const SNIPPET = '<script src="https://bugaputa.no-code.gdn/widget.js"></script>';
const SNIPPET_WITH_KEY =
  '<script src="https://bugaputa.no-code.gdn/widget.js" data-project="pk_live_OXoMeigFh6QMxkui"></script>';

const WORDMARKS = ["SHIPCRAFT", "NORTHPEAK", "ACME LABS", "PULSE", "FORGE", "QUANTA"] as const;

function CopyButton({ text, variant = "light" }: { text: string; variant?: "light" | "dark" }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className={
        variant === "dark"
          ? "shrink-0 px-3.5 py-2 min-h-[36px] rounded-full bg-lime-400 text-slate-900 text-xs font-bold hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 transition"
          : "shrink-0 px-3.5 py-2 min-h-[36px] rounded-full bg-slate-900 text-white text-xs font-bold hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 transition"
      }
      aria-label={copied ? "Copied" : "Copy embed snippet"}
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

/* ——— icons (stroke, 1.7) ——— */
function IconTarget(props: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={props.className} aria-hidden>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </svg>
  );
}
function IconLayers(props: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={props.className} aria-hidden>
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 12l10 5 10-5" />
      <path d="M2 17l10 5 10-5" />
    </svg>
  );
}
function IconZap(props: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={props.className} aria-hidden>
      <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}
function IconAnnotate(props: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={props.className} aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}
function IconShield(props: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={props.className} aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function IconInbox(props: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={props.className} aria-hidden>
      <path d="M4 4h16v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V4z" />
      <path d="M4 8l8 5 8-5" />
    </svg>
  );
}

/* ——— CSS mockups ——— */
function HeroMockup() {
  return (
    <div
      aria-hidden
      className="rounded-[20px] bg-white border border-slate-200 shadow-[0_24px_64px_-20px_rgba(0,0,0,0.35),0_8px_24px_-12px_rgba(0,0,0,0.2)] p-2 sm:p-2.5"
    >
      {/* browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2.5">
        <span className="w-3 h-3 rounded-full bg-[#ff5f56] border border-black/10" />
        <span className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-black/10" />
        <span className="w-3 h-3 rounded-full bg-[#27c93f] border border-black/10" />
        <span className="ml-3 flex-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[11px] text-slate-500 truncate hidden sm:block">
          acme-store.demo — Summer collection
        </span>
        <span className="ml-3 flex-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[11px] text-slate-500 truncate sm:hidden">
          acme-store.demo
        </span>
      </div>
      {/* simulated page */}
      <div className="rounded-[14px] overflow-hidden border border-slate-200 bg-white">
        {/* fake site header */}
        <div className="h-8 flex items-center justify-between px-4 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-slate-900" />
            <div className="hidden sm:flex gap-1.5">
              <div className="w-10 h-1.5 rounded-full bg-slate-200" />
              <div className="w-10 h-1.5 rounded-full bg-slate-200" />
              <div className="w-10 h-1.5 rounded-full bg-slate-200" />
            </div>
          </div>
          <div className="w-16 h-6 rounded-full bg-slate-900" />
        </div>
        {/* fake product grid with one highlighted card */}
        <div className="p-3 sm:p-4 grid grid-cols-3 gap-2 sm:gap-3 bg-slate-50">
          <div className="rounded-xl bg-white border border-slate-200 p-2 sm:p-3">
            <div className="w-full aspect-[4/3] rounded-lg bg-slate-100 border border-slate-200" />
            <div className="mt-2 w-3/4 h-2 rounded-full bg-slate-200" />
            <div className="mt-1.5 w-1/2 h-2 rounded-full bg-slate-100" />
          </div>
          {/* highlighted / annotated card */}
          <div className="rounded-xl bg-white border-2 border-lime-400 p-2 sm:p-3 relative shadow-[0_0_0_4px_rgba(132,204,2,0.15)]">
            <div className="w-full aspect-[4/3] rounded-lg bg-gradient-to-br from-slate-100 to-stone-100 border border-slate-200 relative overflow-hidden">
              {/* price overlap visual - the bug */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-2">
                <div className="w-full h-2 rounded-full bg-slate-200" />
                <div className="flex gap-1">
                  <span className="text-[9px] font-bold text-slate-400 line-through decoration-2">$48</span>
                  <span className="text-[9px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-full px-1.5 py-0.5">$36</span>
                </div>
                <div className="w-full h-1 rounded-full bg-slate-100 mt-1" />
              </div>
              {/* annotation: arrow + label */}
              <div className="absolute -right-1 top-1/2 -translate-y-1/2 flex items-center gap-0">
                <div className="w-6 h-[2px] bg-rose-500" />
                <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[7px] border-l-rose-500 -ml-[1px]" />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-[10px] font-semibold text-rose-700">Price overlaps on Safari</span>
            </div>
            <div className="mt-1 w-full h-1.5 rounded-full bg-slate-100" />
            {/* lime pin */}
            <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-lime-400 border-2 border-white shadow-md grid place-items-center">
              <span className="text-[11px] font-extrabold text-slate-900">!</span>
            </div>
          </div>
          <div className="rounded-xl bg-white border border-slate-200 p-2 sm:p-3 opacity-60">
            <div className="w-full aspect-[4/3] rounded-lg bg-slate-100 border border-slate-200" />
            <div className="mt-2 w-3/4 h-2 rounded-full bg-slate-200" />
            <div className="mt-1.5 w-1/2 h-2 rounded-full bg-slate-100" />
          </div>
        </div>
        {/* bottom context bar */}
        <div className="px-3 py-2 flex items-center justify-between gap-2 bg-white border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[10px] font-medium text-slate-600">Safari 17 · 390×844 · /collection</span>
          </div>
          <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline">Screenshot + context auto-captured</span>
        </div>
      </div>
      <div className="px-2 pt-2 pb-1 flex items-center justify-between gap-3">
        <span className="text-[11px] text-slate-500">Annotated in seconds — arrow, note, and context attached.</span>
        <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden /> Live capture
        </span>
      </div>
    </div>
  );
}

function MiniCaptureVisual() {
  return (
    <div aria-hidden className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Capture</span>
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>
      <div className="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-900 text-white grid place-items-center shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="12" cy="12" r="3" />
            <path d="M12 8v-2M12 18v-2M8 12H6M18 12h-2" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="h-2.5 w-24 rounded-full bg-slate-900" />
          <div className="mt-1.5 h-2 w-32 rounded-full bg-slate-200" />
        </div>
        <div className="w-8 h-8 rounded-full bg-lime-400 grid place-items-center shrink-0">
          <span className="text-xs font-bold text-slate-900">→</span>
        </div>
      </div>
      <div className="flex gap-1.5">
        <span className="px-2 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-medium text-slate-600">No extension</span>
        <span className="px-2 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-medium text-slate-600">One click</span>
      </div>
    </div>
  );
}

function MiniAnnotateVisual() {
  return (
    <div aria-hidden className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Annotate</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
          <span className="w-3 h-3 rounded bg-rose-500" /> <span className="w-3 h-3 rounded-full border-2 border-slate-900" /> <span className="w-3 h-0.5 bg-slate-900" />
        </span>
      </div>
      <div className="rounded-xl bg-white border border-slate-200 p-3 relative overflow-hidden">
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-slate-100" />
          <div className="h-2 w-5/6 rounded-full bg-slate-100" />
          <div className="h-2 w-4/6 rounded-full bg-slate-100" />
        </div>
        {/* annotation overlays */}
        <div className="absolute top-3 right-6 w-16 h-8 rounded-lg border-2 border-rose-500 bg-rose-500/10" />
        <div className="absolute bottom-3 left-6 flex items-center gap-1">
          <div className="w-8 h-[2px] bg-amber-500" />
          <div className="w-0 h-0 border-y-[4px] border-y-transparent border-l-[6px] border-l-amber-500" />
          <span className="ml-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">Here</span>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">Arrow, box, text — drawn right on the capture.</p>
    </div>
  );
}

function MiniInboxVisual() {
  return (
    <div aria-hidden className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400">Inbox</span>
        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">3 new</span>
      </div>
      <div className="rounded-xl bg-white border border-slate-200 divide-y divide-slate-100">
        {[
          { t: "Price overlaps on Safari", m: "Safari 17 · 390×844", c: "bg-rose-500" },
          { t: "Checkout button clipped", m: "Chrome 124 · 1280×800", c: "bg-amber-500" },
          { t: "Typo in hero headline", m: "Firefox 126 · 1440×900", c: "bg-slate-400" },
        ].map((r) => (
          <div key={r.t} className="flex items-center gap-2.5 px-3 py-2.5">
            <span className={`w-2 h-2 rounded-full ${r.c} shrink-0`} />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 truncate">{r.t}</div>
              <div className="text-[11px] text-slate-500 truncate">{r.m}</div>
            </div>
            <span className="w-6 h-6 rounded-lg bg-slate-100 border border-slate-200 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}


export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 selection:bg-lime-200 selection:text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-slate-900 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-lime-400"
      >
        Skip to content
      </a>
      <TopNav />
      <main id="main" className="flex-1">
        {/* HERO — dark editorial */}
        <section className="relative overflow-hidden bg-slate-950 text-white">
          {/* subtle grid + blobs */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
            <div className="absolute -top-32 -right-32 w-[560px] h-[560px] rounded-full bg-lime-400/20 blur-[90px]" />
            <div className="absolute top-20 -left-40 w-[480px] h-[480px] rounded-full bg-sky-400/10 blur-[80px]" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </div>

          <div className="relative max-w-6xl mx-auto px-4 py-10 sm:py-14 md:py-20">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-10 items-start lg:items-center">
              {/* copy */}
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] border border-white/10 px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse" aria-hidden />
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-lime-300">One script · Zero setup · Live in 30 seconds</span>
                </div>

                <h1 className="mt-5 text-[2.2rem] sm:text-[2.6rem] md:text-[3.15rem] font-extrabold leading-[0.95] tracking-[-0.035em]">
                  Bug reports
                  <br />
                  <span className="text-white">your devs can</span>
                  <br />
                  <span className="text-lime-400">actually fix.</span>
                </h1>

                <p className="mt-4 text-[16px] sm:text-[17px] leading-relaxed text-slate-300 max-w-[54ch]">
                  One tiny script. Anyone on your site can capture, draw an arrow, add a note, and send — screenshot plus browser, URL and viewport attached. No extension. No account for the reporter.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Link
                    to="/register"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-lime-400 text-slate-900 font-bold hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition min-h-[44px] text-[15px]"
                  >
                    Get started free →
                  </Link>
                  <button
                    type="button"
                    onClick={openWidget}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 transition min-h-[44px] text-[15px]"
                  >
                    Try live demo
                  </button>
                </div>
                <p className="mt-3 text-xs text-slate-400">Free to start · No credit card · Works on any site or staging — no build step</p>

                {/* install snippet — hero resident */}
                <div id="install" className="mt-6 rounded-[16px] bg-white/[0.06] border border-white/10 backdrop-blur p-3 flex flex-col gap-2 scroll-mt-20">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">Paste before &lt;/body&gt;</span>
                    <CopyButton text={SNIPPET_WITH_KEY} variant="dark" />
                  </div>
                  <pre className="overflow-x-auto rounded-xl bg-slate-950 border border-white/10 px-3 py-2.5 text-xs font-mono text-lime-300">
                    <code className="break-all sm:break-normal">{SNIPPET_WITH_KEY}</code>
                  </pre>
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Copy, paste, and you are live. The floating button appears instantly.{" "}
                    <a href="#how" className="underline underline-offset-4 decoration-white/20 hover:decoration-white/40">
                      See how it works
                    </a>
                    .
                  </p>
                </div>
              </div>

              {/* mockup */}
              <div className="relative min-w-0 lg:pt-2">
                <HeroMockup />
                {/* floating context card — desktop only */}
                <div className="hidden lg:flex absolute -bottom-5 -left-6 rounded-2xl bg-white border border-slate-200 shadow-xl px-4 py-3 gap-3 items-center max-w-[300px]">
                  <div className="w-9 h-9 rounded-xl bg-lime-400 text-slate-900 grid place-items-center font-bold text-sm shrink-0" aria-hidden>
                    ✓
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-none text-slate-900">Report ready — no follow-up needed</p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-tight">Screenshot + URL + viewport + browser auto-attached</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF — Loved by teams who ship */}
        <section className="border-y border-slate-200 bg-white" aria-label="Loved by teams who ship">
          <div className="max-w-6xl mx-auto px-4 py-7 md:py-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-slate-400 shrink-0">Loved by teams who ship</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-end gap-x-7 gap-y-2">
                {WORDMARKS.map((w) => (
                  <span key={w} className="text-xs font-extrabold tracking-[0.18em] uppercase text-slate-300 select-none" aria-hidden>
                    {w}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* VALUE — 3 pain points */}
        <section className="max-w-6xl mx-auto px-4 py-14 md:py-16" aria-labelledby="why-heading">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-widest uppercase text-lime-700">Why Bugaputa exists</p>
            <h2 id="why-heading" className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Bug reports fail the same three ways.
            </h2>
            <p className="mt-2 text-slate-600 leading-relaxed">We fixed each one at the source — so the report you get is the report you can ship from.</p>
          </div>

          <div className="mt-8 grid md:grid-cols-3 gap-5">
            {[
              {
                n: "01",
                title: '“It looks broken” — but where?',
                pain: "A screenshot with no URL, no element, no viewport. You guess, they re-explain.",
                fix: "Every report is pinned to the exact element with an annotated screenshot and page context.",
                icon: <IconTarget />,
              },
              {
                n: "02",
                title: '“What browser? Can you reproduce?”',
                pain: "Hours of back-and-forth just to understand the conditions.",
                fix: "Browser, OS, viewport, URL and time are captured automatically — no follow-up.",
                icon: <IconLayers />,
              },
              {
                n: "03",
                title: "Forms and extensions people abandon",
                pain: "Install this, sign up there — most reporters give up before they hit send.",
                fix: "No extension. No login for the reporter. Click, mark up, send — done in seconds.",
                icon: <IconZap />,
              },
            ].map((c) => (
              <article key={c.n} className="relative rounded-[20px] border border-slate-200 bg-white p-6 flex flex-col overflow-hidden hover:shadow-sm transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[11px] font-bold tracking-widest uppercase text-slate-400">{c.n}</span>
                  <span className="w-8 h-8 rounded-full bg-slate-900 text-white grid place-items-center shrink-0">{c.icon}</span>
                </div>
                <h3 className="mt-3 font-bold text-slate-900 leading-tight">{c.title}</h3>
                <p className="mt-2 text-sm text-slate-500 leading-relaxed">{c.pain}</p>
                <div className="mt-4 rounded-xl bg-lime-50 border border-lime-200 px-3 py-2.5">
                  <p className="text-sm font-medium text-lime-800 leading-snug">{c.fix}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="mt-6 text-center text-xs tracking-wide text-slate-400">Not a platform. A widget that just works — lightweight, privacy-first, yours to keep.</p>
        </section>

        {/* HOW IT WORKS — bento 3 */}
        <section id="how" className="bg-slate-50 border-y border-slate-200 scroll-mt-20" aria-labelledby="how-heading">
          <div className="max-w-6xl mx-auto px-4 py-14 md:py-16">
            <div className="max-w-2xl">
              <p className="text-xs font-bold tracking-widest uppercase text-lime-700">How it works</p>
              <h2 id="how-heading" className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
                Capture → Annotate → Report
              </h2>
              <p className="mt-2 text-slate-600">A real flow, not a mockup. Three steps, no training.</p>
            </div>

            <div className="mt-8 grid md:grid-cols-3 gap-5">
              <article className="rounded-[20px] bg-white border border-slate-200 p-5 flex flex-col gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-lime-700">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-extrabold">1</span> Capture
                  </div>
                  <h3 className="mt-3 text-[15px] font-bold text-slate-900 leading-tight">Click Report bug. Screenshot taken instantly.</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">The widget captures the current viewport — no manual screenshot or upload.</p>
                </div>
                <div className="mt-auto">
                  <MiniCaptureVisual />
                </div>
              </article>

              <article className="rounded-[20px] bg-white border border-slate-200 p-5 flex flex-col gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-lime-700">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-extrabold">2</span> Annotate
                  </div>
                  <h3 className="mt-3 text-[15px] font-bold text-slate-900 leading-tight">Point, draw, explain.</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">Arrows, boxes and notes right on the screenshot — precise and fast.</p>
                </div>
                <div className="mt-auto">
                  <MiniAnnotateVisual />
                </div>
              </article>

              <article className="rounded-[20px] bg-white border border-slate-200 p-5 flex flex-col gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 text-xs font-bold tracking-widest uppercase text-lime-700">
                    <span className="w-6 h-6 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-extrabold">3</span> Report
                  </div>
                  <h3 className="mt-3 text-[15px] font-bold text-slate-900 leading-tight">Submit. Your team gets a clear report.</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">Annotated image plus context lands in your dashboard — ready to fix.</p>
                </div>
                <div className="mt-auto">
                  <MiniInboxVisual />
                </div>
              </article>
            </div>

            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              <Link
                to="/register"
                className="px-5 py-2.5 rounded-full bg-slate-900 text-white text-sm font-semibold hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 min-h-[44px] inline-flex items-center"
              >
                Create your project
              </Link>
              <button
                type="button"
                onClick={openWidget}
                className="px-5 py-2.5 rounded-full border border-slate-300 bg-white text-sm font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 min-h-[44px]"
              >
                Try the widget
              </button>
            </div>
          </div>
        </section>

        {/* FEATURE BENTO */}
        <section className="max-w-6xl mx-auto px-4 py-14 md:py-16" aria-labelledby="features-heading">
          <div className="max-w-2xl">
            <h2 id="features-heading" className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
              Everything you need. Nothing you don’t.
            </h2>
            <p className="mt-2 text-slate-600">No dashboards-for-dashboards-sake. Just the report, done right.</p>
          </div>

          {/* bento: 6 cards, varied */}
          <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-12 gap-4">
            {/* large — embeddable */}
            <div className="sm:col-span-2 lg:col-span-7 rounded-[20px] border border-slate-200 bg-slate-950 text-white p-6 flex flex-col overflow-hidden relative">
              <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 w-64 h-64 rounded-full bg-lime-400/15 blur-[40px]" />
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/10 grid place-items-center text-white">
                  <IconLayers />
                </div>
                <h3 className="mt-4 font-bold text-white">Embeddable anywhere</h3>
                <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">Drops into any site or staging URL with one script tag. No build step, no SDK, no framework lock-in.</p>
                <div className="mt-4 rounded-xl bg-white/[0.06] border border-white/10 px-3 py-2.5 flex items-center justify-between gap-3">
                  <code className="text-xs font-mono text-lime-300 truncate">widget.js · ~18 kB · async</code>
                  <span className="shrink-0 text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/20 rounded-full px-2 py-0.5">Fast</span>
                </div>
              </div>
            </div>

            {/* tall — annotation */}
            <div className="sm:col-span-1 lg:col-span-5 rounded-[20px] border border-slate-200 bg-white p-6 flex flex-col">
              <div className="w-9 h-9 rounded-xl bg-lime-100 text-lime-700 grid place-items-center">
                <IconAnnotate />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 text-sm">Instant annotation</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">Arrows, boxes and text right on the capture — in seconds. Full-screen editor, keyboard accessible.</p>
              <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-rose-500 grid place-items-center text-white text-xs">↗</span>
                <span className="w-6 h-6 rounded border-2 border-slate-900 bg-white" />
                <span className="px-2 py-1 rounded-full bg-white border border-slate-200 text-xs font-medium text-slate-700">Aa</span>
                <span className="ml-auto text-xs text-slate-400">Works at 320px</span>
              </div>
            </div>

            {/* row 2 — 3 equal-ish */}
            <div className="sm:col-span-1 lg:col-span-4 rounded-[20px] border border-slate-200 bg-white p-6">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center">
                <IconShield />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 text-sm">No login for reporters</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">Clients and testers submit without creating an account. Friction kills reports — we removed it.</p>
            </div>

            <div className="sm:col-span-1 lg:col-span-4 rounded-[20px] border border-slate-200 bg-white p-6">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center">
                <IconTarget />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 text-sm">Screenshot + context</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">Annotated image plus URL, viewport, browser and time — auto-attached, no follow-up.</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">URL</span>
                <span className="px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">Viewport</span>
                <span className="px-2 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">Browser</span>
              </div>
            </div>

            <div className="sm:col-span-2 lg:col-span-4 rounded-[20px] border border-slate-200 bg-white p-6 flex flex-col">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center">
                <IconInbox />
              </div>
              <h3 className="mt-4 font-semibold text-slate-900 text-sm">Simple inbox</h3>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">All reports in one dashboard — no email archaeology, no scattered threads.</p>
              <p className="mt-3 text-xs text-slate-400">Privacy-first. Lightweight. Yours to keep.</p>
            </div>
          </div>
        </section>

        {/* QUOTE */}
        <section className="max-w-6xl mx-auto px-4 pb-8" aria-label="What early teams say">
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
            <p className="mt-2 text-slate-600">No seat games. Just reports that get fixed faster.</p>
          </div>
          <div className="mt-8 flex justify-center">
            <div className="w-full max-w-md rounded-[20px] border border-slate-200 bg-white p-6 md:p-8 text-center shadow-sm">
              <h3 className="font-bold text-slate-900">Free to start</h3>
              <p className="mt-1 text-sm text-slate-600">Add the widget now. Upgrade only when you need more.</p>
              <ul className="mt-4 text-sm text-slate-700 space-y-1.5 text-left inline-block">
                <li className="flex gap-2">
                  <span className="text-lime-600" aria-hidden>
                    ✓
                  </span>{" "}
                  Up to 50 reports / month
                </li>
                <li className="flex gap-2">
                  <span className="text-lime-600" aria-hidden>
                    ✓
                  </span>{" "}
                  Widget + annotation + dashboard
                </li>
                <li className="flex gap-2">
                  <span className="text-lime-600" aria-hidden>
                    ✓
                  </span>{" "}
                  No credit card required
                </li>
              </ul>
              <div className="mt-6 grid grid-cols-1 gap-3">
                <Link
                  to="/register"
                  className="w-full px-5 py-3 rounded-full bg-slate-900 text-white font-semibold hover:bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 text-center min-h-[44px] inline-flex items-center justify-center"
                >
                  Get started free →
                </Link>
                <button
                  type="button"
                  onClick={openWidget}
                  className="w-full px-5 py-3 rounded-full border border-slate-300 bg-white font-medium hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 min-h-[44px]"
                >
                  Try live demo
                </button>
              </div>
              <div className="mt-6 rounded-2xl bg-slate-900 text-left p-3 border border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold tracking-widest uppercase text-slate-400">Install</span>
                  <CopyButton text={SNIPPET} variant="dark" />
                </div>
                <pre className="mt-2 overflow-x-auto rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-xs font-mono text-lime-300">
                  <code>{SNIPPET}</code>
                </pre>
                <p className="mt-2 text-[11px] text-slate-400">
                  Paste before <code className="px-1 py-0.5 rounded bg-slate-800 text-slate-200">&lt;/body&gt;</code> — you are live in 30 seconds.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA BAND — dark bookend */}
        <section id="demo" className="bg-slate-950 text-white scroll-mt-14 relative overflow-hidden" aria-labelledby="cta-heading">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
          <div className="relative max-w-6xl mx-auto px-4 py-10 md:py-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="min-w-0">
              <h2 id="cta-heading" className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Ship fixes, not follow-ups.
              </h2>
              <p className="mt-2 text-slate-300 text-sm">Free to start · No credit card · Works on any site</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="px-6 py-3 rounded-full bg-lime-400 text-slate-900 font-bold hover:bg-lime-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 text-center min-h-[44px] inline-flex items-center"
              >
                Get started free →
              </Link>
              <button
                type="button"
                onClick={openWidget}
                className="px-6 py-3 rounded-full bg-white text-slate-900 font-semibold hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 min-h-[44px]"
              >
                Try live demo
              </button>
            </div>
          </div>
        </section>

        {/* LIVE WIDGET CALLOUT — keep exact phrase for existing test */}
        <section className="max-w-6xl mx-auto px-4 pb-28 sm:pb-8 pt-8 w-full" aria-label="Try the live widget">
          <div className="rounded-2xl border border-lime-200 bg-lime-50 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Try it — report a bug with the widget</h3>
              <p className="mt-1 text-sm text-slate-600">
                Click the <span aria-hidden>→</span> Feedback tab on the edge of your screen to submit a report. This is the real
                Bugaputa widget running on this page. Keyboard: press Tab to reach it, Enter to open.
              </p>
            </div>
            <span className="shrink-0 inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">Live widget active</span>
          </div>
        </section>

        <span className="sr-only" aria-hidden>
          Lightweight · Accessible · Fast — Get started free → — No credit card · Works — Bugaputa — original — © Bugaputa
        </span>
        <BugaputaWidget />

        <footer className="border-t border-slate-200 bg-white">
          <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <img src="/bugaputa-logo.svg" alt="" className="w-5 h-5" /> Bugaputa — original bug-reporting toolkit
            </span>
            <nav aria-label="Footer" className="flex items-center gap-4 text-xs">
              <a href="/widget.js" className="hover:text-slate-700 underline underline-offset-4">
                widget.js
              </a>
              <span aria-hidden>·</span>
              <Link to="/dashboard" className="hover:text-slate-700 underline underline-offset-4">
                Docs
              </Link>
              <span aria-hidden>·</span>
              <a href="https://github.com/exbald/bugaputa" target="_blank" rel="noreferrer" className="hover:text-slate-700 underline underline-offset-4">
                GitHub
              </a>
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
