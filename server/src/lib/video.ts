import * as fs from "node:fs";

export const VIDEO_MIME = new Set(["video/webm", "video/mp4"]);
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
export const MAX_VIDEO_DURATION_MS = 60_000;
export const VIDEO_DURATION_TOLERANCE_MS = 1000; // allow up to 61s before reject
export const PROJECT_VIDEO_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GiB

export function baseMime(m: string): string {
  return m.split(";")[0].trim().toLowerCase();
}

export function isVideoMime(m: string): boolean {
  return VIDEO_MIME.has(baseMime(m));
}

export function videoExtFromMime(mime: string): string {
  const base = baseMime(mime);
  return base === "video/mp4" ? ".mp4" : ".webm";
}

export function validateVideoMagic(filePath: string, mimeIn: string): boolean {
  const base = baseMime(mimeIn);
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(12);
    const read = fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    if (read < 12 && base === "video/mp4") return false;
    if (read < 4) return false;
    if (base === "video/webm") {
      return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
    }
    if (base === "video/mp4") {
      // ftyp at bytes 4-7
      return buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70;
    }
    return false;
  } catch {
    return false;
  }
}

function readVintSize(buf: Buffer, offset: number): { size: number; len: number } | null {
  if (offset >= buf.length) return null;
  const first = buf[offset];
  if (first === 0) return null;
  let mask = 0x80;
  let len = 1;
  while (len <= 8 && (first & mask) === 0) {
    mask >>= 1;
    len++;
  }
  if (len > 8) return null;
  // mask the marker bit
  let value = first & (mask - 1);
  for (let i = 1; i < len; i++) {
    if (offset + i >= buf.length) return null;
    value = (value << 8) | buf[offset + i];
  }
  return { size: value, len };
}

function findBytes(buf: Buffer, pattern: number[]): number {
  outer: for (let i = 0; i <= buf.length - pattern.length; i++) {
    for (let j = 0; j < pattern.length; j++) if (buf[i + j] !== pattern[j]) continue outer;
    return i;
  }
  return -1;
}

/**
 * Best-effort WebM duration probe.
 * Looks for TimecodeScale (0x2AD7B1) and Duration (0x4489).
 * Duration is float (4 or 8 bytes big-endian). Returns ms or null if unparsable.
 */
export function probeWebMDurationMs(buf: Buffer): number | null {
  try {
    // Default TimecodeScale 1_000_000
    let timecodeScale = 1_000_000;
    const tcPos = findBytes(buf, [0x2a, 0xd7, 0xb1]);
    if (tcPos !== -1) {
      const after = tcPos + 3;
      const v = readVintSize(buf, after);
      if (v && v.size > 0 && v.size <= 8) {
        const valOffset = after + v.len;
        if (valOffset + v.size <= buf.length) {
          let n = 0;
          for (let i = 0; i < v.size; i++) n = n * 256 + buf[valOffset + i];
          if (n > 0) timecodeScale = n;
        }
      }
    }
    const durPos = findBytes(buf, [0x44, 0x89]);
    if (durPos === -1) return null;
    const after = durPos + 2;
    const v = readVintSize(buf, after);
    if (!v) return null;
    const valOffset = after + v.len;
    if (valOffset + v.size > buf.length) return null;
    let durationSec: number | null = null;
    if (v.size === 4) {
      durationSec = buf.readFloatBE(valOffset);
    } else if (v.size === 8) {
      durationSec = buf.readDoubleBE(valOffset);
    } else {
      return null;
    }
    if (!isFinite(durationSec) || durationSec < 0) return null;
    // Duration in WebM is in seconds (as float), independent of TimecodeScale for segment duration?
    // Some muxers scale by TimecodeScale — if we found TimecodeScale !=1e6, duration may be in ticks.
    // Heuristic: if TimecodeScale !=1e6 and durationSec is huge, adjust. But for MVP treat as seconds.
    // Simple: seconds *1000
    // If TimecodeScale was explicitly set to something like 1ms (1000000 ns default), durationSec is seconds.
    // Keep raw seconds -> ms.
    return Math.round(durationSec * 1000);
  } catch {
    return null;
  }
}

export function probeMP4DurationMs(buf: Buffer): number | null {
  try {
    const idx = findBytes(buf, [0x6d, 0x76, 0x68, 0x64]); // mvhd
    if (idx === -1) return null;
    // mvhd layout: after 'mvhd' 4 bytes: version (1) + flags (3)
    const versionPos = idx + 4;
    if (versionPos >= buf.length) return null;
    const version = buf[versionPos];
    let offset: number;
    let timescale: number;
    let duration: number;
    if (version === 1) {
      // v1: creation 8, modification 8, timescale 4, duration 8
      offset = versionPos + 4 + 8 + 8;
      if (offset + 12 > buf.length) return null;
      timescale = buf.readUInt32BE(offset);
      offset += 4;
      // duration 64-bit, but JS safe parse: read high/low
      const high = buf.readUInt32BE(offset);
      const low = buf.readUInt32BE(offset + 4);
      // If high !=0, duration > 2^32, treat as large
      duration = high * 0x100000000 + low;
    } else {
      // v0: creation 4, modification 4, timescale 4, duration 4
      offset = versionPos + 4 + 4 + 4;
      if (offset + 8 > buf.length) return null;
      timescale = buf.readUInt32BE(offset);
      offset += 4;
      duration = buf.readUInt32BE(offset);
    }
    if (!timescale || timescale === 0) return null;
    const sec = duration / timescale;
    if (!isFinite(sec) || sec < 0) return null;
    return Math.round(sec * 1000);
  } catch {
    return null;
  }
}

export function probeVideoDurationMs(filePath: string, mime: string): number | null {
  try {
    const base = baseMime(mime);
    // Read up to 2MB for header parsing
    const fd = fs.openSync(filePath, "r");
    const stat = fs.fstatSync(fd);
    const toRead = Math.min(stat.size, 2 * 1024 * 1024);
    const buf = Buffer.alloc(toRead);
    fs.readSync(fd, buf, 0, toRead, 0);
    fs.closeSync(fd);
    if (base === "video/webm") return probeWebMDurationMs(buf);
    if (base === "video/mp4") return probeMP4DurationMs(buf);
    return null;
  } catch {
    return null;
  }
}
