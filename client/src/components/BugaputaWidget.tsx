import { useEffect } from "react";

import { WIDGET_SRC, CANONICAL_ORIGIN } from "../lib/canonical";
export const WIDGET_PROJECT_KEY = "pk_live_OXoMeigFh6QMxkui";

/**
 * Singleton, React-safe live widget loader.
 * - Injects exactly <script src="https://bugaputa.com/widget.js" data-project="pk_live_OXoMeigFh6QMxkui" data-api="https://bugaputa.com"></script>
 * - Landing-only: only rendered inside Landing route.
 * - Singleton: never injects twice even on remount / StrictMode double-invoke.
 * - Clean unmount: removes the script we added and any DOM the widget created.
 */
export default function BugaputaWidget() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const selector = `script[src="${WIDGET_SRC}"]`;
    const existing = document.querySelector(selector) as HTMLScriptElement | null;
    if (existing) {
      // Verify the existing tag carries the correct project key and API origin; if not, correct it.
      if (existing.getAttribute("data-project") !== WIDGET_PROJECT_KEY) {
        existing.setAttribute("data-project", WIDGET_PROJECT_KEY);
      }
      if (existing.getAttribute("data-api") !== CANONICAL_ORIGIN) {
        existing.setAttribute("data-api", CANONICAL_ORIGIN);
      }
      return;
    }
    const s = document.createElement("script");
    s.src = WIDGET_SRC;
    s.setAttribute("data-project", WIDGET_PROJECT_KEY);
    s.setAttribute("data-api", CANONICAL_ORIGIN);
    s.async = true;

    // Tag it so cleanup can identify our element unambiguously.
    s.setAttribute("data-bugaputa", "landing");
    document.body.appendChild(s);
    return () => {
      // Remove only the script we injected.
      const ours = document.querySelector('script[data-bugaputa="landing"]') as HTMLScriptElement | null;
      if (ours) {
        // Explicitly cancel widget.js's pending config/timeout reveal before
        // removing the loader; plain script-tag removal is not an unload signal.
        ours.setAttribute("data-bugaputa-unmounted", "true");
        ours.remove();
      }
      // Fallback: if selector still matches a script we created (no data-bugaputa e.g. manual embed), remove that one too when it matches our src.
      // Do not remove a script injected by another route (none should exist; Landing is the only mount point).
      // Clean up widget DOM injected by widget.js
      const btn = document.getElementById("bugaputa-btn");
      if (btn) btn.remove();
      const overlay = document.getElementById("bugaputa-overlay");
      if (overlay) overlay.remove();
      // Remove widget stylesheet link if present (widget.js adds /widget.css relative to API base)
      const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
      for (const l of links) {
        if (l.href.includes("/widget.css")) l.remove();
      }
    };
  }, []);
  return null;
}
