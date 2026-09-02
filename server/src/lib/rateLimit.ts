import type { Request, Response, NextFunction } from "express";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

// key: `${namespace}:${ip}:${projectId}` so telemetry cannot exhaust the
// report-submission quota.
const buckets = new Map<string, number[]>();

export function rateLimitCheck(ip: string, projectId: string, namespace = "reports"): boolean {
  const key = `${namespace}:${ip}:${projectId}`;
  const now = Date.now();
  const timestamps = buckets.get(key) ?? [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    buckets.set(key, recent);
    return false; // rate limited
  }
  recent.push(now);
  buckets.set(key, recent);
  return true; // allowed
}

export function clearRateLimit() {
  buckets.clear();
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only applies to POST /api/reports — enforced in reports route instead
  next();
}
