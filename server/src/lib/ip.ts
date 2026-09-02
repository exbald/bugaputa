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
  const peer = req.socket?.remoteAddress || req.ip || "unknown";
  const normalizedPeer = peer.replace(/^::ffff:/, "");
  const trustedProxy =
    normalizedPeer === "::1" ||
    normalizedPeer === "127.0.0.1" ||
    normalizedPeer.startsWith("10.") ||
    normalizedPeer.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalizedPeer) ||
    /^(fc|fd|fe80):/i.test(normalizedPeer);
  const forwarded = req.headers["x-forwarded-for"];
  if (trustedProxy && typeof forwarded === "string") return forwarded.split(",").at(-1)!.trim();
  if (trustedProxy && Array.isArray(forwarded)) return forwarded.at(-1)!.split(",").at(-1)!.trim();
  return peer;
}
