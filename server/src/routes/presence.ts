import { Router } from "express";
import { getDb, nowIso } from "../db.js";
import { getClientIp } from "../lib/ip.js";
import { rateLimitCheck } from "../lib/rateLimit.js";

const router = Router();

export const DEBOUNCE_MS = 60_000;

/**
 * In-memory debounce: projectId:origin -> timestamp of last DB write.
 * Prevents DB thrashing from high-traffic sites sending a heartbeat on every page view.
 */
const debounceMap = new Map<string, number>();

export function clearPresenceDebounce() {
  debounceMap.clear();
}

/**
 * Extract and normalize hostname from a raw value.
 * - If value looks like a URL (contains :// or starts with http), parse via URL.
 * - Otherwise treat as hostname directly.
 * Normalize: trim, lowercase, slice to 253, validate.
 * Returns normalized hostname or null if invalid.
 *
 * Valid hostnames: /^[a-z0-9.-]+\.[a-z]{2,}$/i
 * Also allowed for dev: "localhost", IP literals (v4/v6).
 */
export function sanitizeOrigin(raw: string | undefined | null): string | null {
  if (!raw || typeof raw !== "string") return null;
  let candidate = raw.trim();
  if (!candidate) return null;

  // If it looks like a URL, extract hostname via URL parser
  if (candidate.includes("://")) {
    try {
      const u = new URL(candidate);
      candidate = u.hostname;
    } catch {
      return null;
    }
  } else if (candidate.includes("/") || candidate.includes("?") || candidate.includes("#")) {
    // Contains path/query but no scheme — try to parse as URL with dummy scheme
    // e.g. "example.com/foo?bar" — take part before first / ? #
    candidate = candidate.split("/")[0].split("?")[0].split("#")[0];
  }

  candidate = candidate.toLowerCase().trim();
  if (!candidate) return null;
  if (candidate.length > 253) candidate = candidate.slice(0, 253);

  // Allow localhost, IPv4, IPv6 literals, otherwise require dotted hostname
  if (candidate === "localhost") return candidate;
  // IPv4: 4 dot-separated numbers 0-255
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(candidate)) return candidate;
  // IPv6 literal (contains colons, e.g. ::1) — accept any colon-containing string that looks like an IP
  if (candidate.includes(":")) {
    // Simple check: looks like IPv6 (hex + colons)
    if (/^[0-9a-f:]+$/i.test(candidate) && candidate.includes(":")) return candidate;
    return null;
  }
  // Standard hostname: at least one dot, TLD >=2 chars, allowed chars a-z0-9.- 
  if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(candidate)) return candidate;

  return null;
}

function resolveOrigin(req: any): string {
  // 1) Origin header hostname
  const originHeader = req.headers.origin as string | undefined;
  const fromOrigin = sanitizeOrigin(originHeader);
  if (fromOrigin) return fromOrigin;

  // 2) Referer header hostname
  const referer = (req.headers.referer || req.headers.referrer) as string | undefined;
  const fromReferer = sanitizeOrigin(referer);
  if (fromReferer) return fromReferer;

  // 3) body field `origin` (client hint) sanitized to hostname
  const bodyOrigin = req.body?.origin as string | undefined;
  const fromBody = sanitizeOrigin(bodyOrigin);
  if (fromBody) return fromBody;

  return "unknown";
}

// CORS helper for presence router
function setCors(res: any) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, x-project-key");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  // Ensure CORP cross-origin so widget fetch is not blocked by helmet
  res.header("Cross-Origin-Resource-Policy", "cross-origin");
}

// Handle OPTIONS preflight on any path in this router
router.use((req, res, next) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

router.post("/heartbeat", (req, res) => {
  setCors(res);

  // projectKey from JSON body field `project` (primary) or x-project-key header (fallback)
  const projectKey =
    (req.body?.project as string) ||
    (req.headers["x-project-key"] as string) ||
    "";

  if (!projectKey) {
    res.status(400).json({ error: "Missing project key" });
    return;
  }

  const db = getDb();
  const project = db
    .prepare("SELECT id FROM projects WHERE publicKey = ?")
    .get(projectKey) as any;

  if (!project) {
    res.status(400).json({ error: "Invalid project key" });
    return;
  }

  // Rate limit: per-IP+project — reuses the same 20/min bucket as reports.
  // Documented: presence shares the reports rate limit bucket (20/min per IP+project).
  const ip = getClientIp(req as any);
  if (!rateLimitCheck(ip, project.id)) {
    res.status(429).json({ error: "Rate limit exceeded. Try again later." });
    return;
  }

  const origin = resolveOrigin(req);

  // Debounce: if same projectId:origin was written <60s ago, skip DB write
  const debounceKey = `${project.id}:${origin}`;
  const lastWrite = debounceMap.get(debounceKey);
  const now = Date.now();
  if (lastWrite !== undefined && now - lastWrite < DEBOUNCE_MS) {
    res.status(204).end();
    return;
  }

  const lastSeenAt = nowIso();
  db.prepare(
    `INSERT INTO widget_presence(projectId, origin, lastSeenAt) VALUES(?,?,?)
     ON CONFLICT(projectId, origin) DO UPDATE SET lastSeenAt=excluded.lastSeenAt`
  ).run(project.id, origin, lastSeenAt);

  debounceMap.set(debounceKey, now);

  // Keep success consistent: 204 no body (presence is fire-and-forget from widget)
  res.status(204).end();
});

export default router;
