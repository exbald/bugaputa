import type { Request, Response, NextFunction } from "express";

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

// key: `${namespace}:${ip}:${projectId}` so telemetry cannot exhaust the
// report-submission quota.
const buckets = new Map<string, number[]>();
let lastSweep = 0;

export function rateLimitCheck(ip: string, projectId: string, namespace = "reports"): boolean {
  const key = `${namespace}:${ip}:${projectId}`;
  const now = Date.now();
  if (now - lastSweep >= WINDOW_MS) {
    for (const [bucketKey, timestamps] of buckets) {
      const recent = timestamps.filter((t) => now - t < WINDOW_MS);
      if (recent.length === 0) buckets.delete(bucketKey);
      else buckets.set(bucketKey, recent);
    }
    lastSweep = now;
  }
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
  lastSweep = 0;
}

export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only applies to POST /api/reports — enforced in reports route instead
  next();
}
