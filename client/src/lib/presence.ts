export type PresenceStatus = "never" | "connected" | "inactive";

export function formatRecency(lastSeenAt: string | null | undefined, nowMs: number = Date.now()): string | null {
  if (!lastSeenAt) return null;
  const t = new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return null;
  const diff = nowMs - t;
  const d = diff < 0 ? 0 : diff;
  if (d < 60_000) return "just now";
  if (d < 60 * 60_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 24 * 60 * 60_000) return `${Math.floor(d / 3600_000)}h ago`;
  return `${Math.floor(d / 86400_000)}d ago`;
}

export function buildPresenceTooltip(opts: {
  presenceStatus: PresenceStatus;
  lastSeenAt: string | null | undefined;
  lastSeenOrigin: string | null | undefined;
  presenceOriginCount: number | undefined | null;
}): string {
  const { presenceStatus, lastSeenAt, lastSeenOrigin, presenceOriginCount } = opts;
  if (presenceStatus === "never" || !lastSeenAt) {
    return "Not connected — widget not yet seen on any site";
  }
  let dateStr = "";
  try {
    dateStr = new Date(lastSeenAt).toLocaleString();
  } catch {
    dateStr = String(lastSeenAt);
  }
  const count = typeof presenceOriginCount === "number" ? presenceOriginCount : 0;
  const more = count > 1 ? ` (+${count - 1} more)` : "";
  if (lastSeenOrigin) {
    return `Last seen ${dateStr} on ${lastSeenOrigin}${more}`;
  }
  // unknown origin -> no domain part, but still show extra count if any?
  if (count > 1) return `Last seen ${dateStr}${more}`;
  return `Last seen ${dateStr}`;
}

export function presenceBadgeLabel(status: PresenceStatus): string {
  if (status === "connected") return "Connected";
  if (status === "inactive") return "Inactive";
  return "Not connected";
}
