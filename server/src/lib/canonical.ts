/**
 * Canonical origin configuration — single source of truth for domain migration.
 *
 * CANONICAL_ORIGIN defaults to https://bugaputa.com (env CANONICAL_ORIGIN).
 * LEGACY_ORIGIN https://bugaputa.no-code.gdn is kept as compat during migration.
 * WWW_HOST www.bugaputa.com always redirects to apex (308).
 *
 * Dual CSP must include BOTH origins; legacy literals outside CSP/Canonical are
 * considered violations. Do not scatter hardcoded origin strings elsewhere.
 */
import type { Request, Response, NextFunction } from "express";

export const CANONICAL_ORIGIN: string = (process.env.CANONICAL_ORIGIN || "https://bugaputa.com").replace(/\/$/, "");
export const LEGACY_ORIGIN: string = "https://bugaputa.no-code.gdn";
export const WWW_HOST: string = "www.bugaputa.com";
export const LEGACY_HOST: string = "bugaputa.no-code.gdn";
export const CANONICAL_HOST: string = (() => {
  try {
    return new URL(CANONICAL_ORIGIN).host.toLowerCase();
  } catch {
    return "bugaputa.com";
  }
})();

/** Normalize a host header value: lower-case, strip port, take first XFH entry. */
export function normalizeHost(raw: string | undefined): string {
  if (!raw) return "";
  // X-Forwarded-Host may be "host1, host2"; take first
  const first = raw.split(",")[0].trim();
  // Strip port if present (but keep IPv6 bracket handling simple — not needed for these hosts)
  const withoutPort = first.split(":")[0];
  return withoutPort.toLowerCase();
}

/** Resolve request host via X-Forwarded-Host (Traefik) falling back to Host. */
export function getRequestHost(req: Request): string {
  const xfh = req.headers["x-forwarded-host"] as string | undefined;
  if (xfh) return normalizeHost(xfh);
  return normalizeHost(req.headers.host);
}

export function isWwwHost(host: string): boolean {
  return normalizeHost(host) === WWW_HOST;
}

export function isLegacyHost(host: string): boolean {
  return normalizeHost(host) === LEGACY_HOST;
}

export function isCanonicalHost(host: string): boolean {
  return normalizeHost(host) === CANONICAL_HOST;
}

/**
 * Compat allowlist — paths that must NOT redirect when served from the legacy
 * host. Covers widget assets, API, health checks, and uploads so old embeds
 * keep working without a redirect.
 */
export function isCompatAllowlisted(pathname: string): boolean {
  if (pathname === "/health" || pathname === "/api/health") return true;
  if (pathname === "/widget.js" || pathname === "/widget.css") return true;
  if (pathname === "/modern-screenshot.min.js" || pathname === "/html2canvas.min.js") return true;
  if (pathname === "/api" || pathname.startsWith("/api/")) return true;
  if (pathname === "/uploads" || pathname.startsWith("/uploads/")) return true;
  return false;
}

/**
 * Host-aware redirect middleware.
 * - www.bugaputa.com (any method/path) -> 308 to CANONICAL_ORIGIN + originalUrl
 * - bugaputa.no-code.gdn + GET + not allowlisted + Accept includes text/html -> 308
 * - otherwise next()
 * Uses X-Forwarded-Host fallback for Traefik. Query string preserved via originalUrl.
 */
export function canonicalRedirectMiddleware(req: Request, res: Response, next: NextFunction): void {
  const host = getRequestHost(req);

  // 1. www -> apex (any method, any path)
  if (isWwwHost(host)) {
    const target = CANONICAL_ORIGIN + req.originalUrl;
    res.redirect(308, target);
    return;
  }

  // 2. legacy document GET redirect (compat allowlist + html accept + GET only)
  if (isLegacyHost(host)) {
    if (req.method !== "GET") {
      next();
      return;
    }
    // pathname without query for allowlist check (req.path is Express-decoded path)
    const pathname: string = (req as any).path || req.url.split("?")[0];
    if (isCompatAllowlisted(pathname)) {
      next();
      return;
    }
    const accept = (req.headers.accept || "") as string;
    if (!accept.toLowerCase().includes("text/html")) {
      next();
      return;
    }
    const target = CANONICAL_ORIGIN + req.originalUrl;
    res.redirect(308, target);
    return;
  }

  next();
}
