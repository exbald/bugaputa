export function hashIp(ip: string): string {
  // Simple hash — never store plaintext IP
  let h = 0;
  for (let i = 0; i < ip.length; i++) {
    h = (Math.imul(31, h) + ip.charCodeAt(i)) | 0;
  }
  // Combine with length for slightly more uniqueness
  return `h_${Math.abs(h).toString(36)}_${ip.length}`;
}

export function getClientIp(req: { ip?: string; headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  if (Array.isArray(forwarded)) return forwarded[0].split(",")[0].trim();
  return req.ip || req.socket?.remoteAddress || "unknown";
}
