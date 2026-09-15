import { Router } from "express";
import multer from "multer";
import { randomUUID } from "node:crypto";
import * as path from "node:path";
import * as fs from "node:fs";
import { getDb, generateId, nowIso } from "../db.js";
import { reportPublicSchema, reportStatusSchema } from "../lib/validators.js";
import { authMiddleware } from "../middleware/auth.js";
import { hashIp, getClientIp } from "../lib/ip.js";
import { rateLimitCheck } from "../lib/rateLimit.js";
import {
  VIDEO_MIME,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DURATION_MS,
  VIDEO_DURATION_TOLERANCE_MS,
  PROJECT_VIDEO_QUOTA_BYTES,
  baseMime,
  videoExtFromMime,
  validateVideoMagic,
  probeVideoDurationMs,
} from "../lib/video.js";

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
// DOM snapshots are HTML, gzipped by the widget when the browser supports it.
// octet-stream is accepted because some browsers send it for Blob-backed gzip files.
const SNAPSHOT_MIME = new Set(["text/html", "application/gzip", "application/x-gzip", "application/octet-stream"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
// Image fields carry rasterized artifacts; domSnapshot carries the serialized DOM.
const IMAGE_FIELDS = new Set(["screenshot", "annotations"]);
const VIDEO_FIELDS = new Set(["video"]);

function getUploadDir(): string {
  return process.env.UPLOAD_DIR || "/app/data/uploads";
}

function resolveStoredFile(filename: string): string | null {
  const base = path.basename(filename);
  const primary = path.join(getUploadDir(), base);
  if (fs.existsSync(primary)) return primary;
  // Legacy path before volume fix
  const legacy = path.join("/data/uploads", base);
  if (fs.existsSync(legacy)) return legacy;
  return null;
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = getUploadDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
    if (file.fieldname === "domSnapshot") {
      // path.extname would yield ".gz" for "snapshot.html.gz" and lose the ".html"
      const gz = file.mimetype !== "text/html" || /\.gz$/i.test(file.originalname || "");
      cb(null, `${randomUUID()}${gz ? ".html.gz" : ".html"}`);
      return;
    }
    if (file.fieldname === "video") {
      const ext = videoExtFromMime(file.mimetype);
      cb(null, `${randomUUID()}${ext}`);
      return;
    }
    const ext = path.extname(file.originalname) || mimeToExt(file.mimetype) || "";
    cb(null, `${randomUUID()}${ext}`);
  },
});

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/webp": ".webp",
    "image/gif": ".gif",
  };
  return map[mime] || "";
}

const upload = multer({
  storage,
  // multer's fileSize limit is global, so it must allow the largest accepted
  // artifact; the tighter per-image cap is enforced in the handler below.
  limits: { fileSize: MAX_VIDEO_BYTES, files: 4 },
  fileFilter(_req, file, cb) {
    const base = baseMime(file.mimetype);
    let allowed: Set<string>;
    if (IMAGE_FIELDS.has(file.fieldname)) allowed = ALLOWED_MIME;
    else if (VIDEO_FIELDS.has(file.fieldname)) allowed = VIDEO_MIME;
    else if (file.fieldname === "domSnapshot") allowed = SNAPSHOT_MIME;
    else {
      cb(new Error("Unexpected file field"));
      return;
    }
    // For video, accept codec-suffixed variants by checking base mime
    const effective = VIDEO_FIELDS.has(file.fieldname) ? base : file.mimetype;
    const ok = VIDEO_FIELDS.has(file.fieldname) ? VIDEO_MIME.has(base) : allowed.has(effective);
    if (ok) cb(null, true);
    else cb(new Error(`Invalid file type: ${file.mimetype}`));
  },
});

type UploadedFile = { path?: string; filename?: string; size?: number };

/** The optional artifacts, keyed by field name (null when not sent). */
function pickedFiles(req: any): { screenshot: UploadedFile | null; domSnapshot: UploadedFile | null; annotations: UploadedFile | null; video: UploadedFile | null } {
  const files = req.files || {};
  const one = (k: string): UploadedFile | null => (files[k] && files[k][0]) || null;
  return { screenshot: one("screenshot"), domSnapshot: one("domSnapshot"), annotations: one("annotations"), video: one("video") };
}

/**
 * Remove every file multer wrote for this request. Must run on every early exit —
 * including multer's own error branch, since parts streamed before the failing one
 * are already on disk.
 */
function cleanupUploads(req: any): void {
  const files = req.files || {};
  for (const key of Object.keys(files)) {
    for (const file of files[key] || []) {
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch {}
      }
    }
  }
  if (req.file?.path) {
    try { fs.unlinkSync(req.file.path); } catch {}
  }
}

function hasVideoField(req: any): boolean {
  const files = req.files || {};
  return !!(files["video"] && files["video"].length > 0);
}

function projectVideoUsageBytes(projectId: string): number {
  try {
    const db = getDb();
    const row = db.prepare("SELECT COALESCE(SUM(videoSizeBytes),0) as total FROM reports WHERE projectId = ?").get(projectId) as any;
    return Number(row?.total || 0);
  } catch {
    return 0;
  }
}

const router = Router();

// Public: POST /api/reports
router.post(
  "/",
  // CORS allow-all for widget
  (_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, x-project-key");
    res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
    next();
  },
  (req, res, next) => {
    // Need to handle both JSON and multipart — try multer first, but allow JSON without file
    const ct = req.headers["content-type"] || "";
    if (ct.includes("multipart/form-data")) {
      const fields = upload.fields([
        { name: "screenshot", maxCount: 1 },
        { name: "domSnapshot", maxCount: 1 },
        { name: "annotations", maxCount: 1 },
        { name: "video", maxCount: 1 },
      ]);
      fields(req, res, (err: any) => {
        if (err) {
          // multer may already have written earlier parts before failing
          cleanupUploads(req);
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({ error: "File too large" });
            return;
          }
          if (err.code === "LIMIT_UNEXPECTED_FILE") {
            res.status(400).json({ error: "Unexpected file field" });
            return;
          }
          res.status(400).json({ error: err.message });
          return;
        }
        next();
      });
    } else {
      next();
    }
  },
  (req, res) => {
    // Normalize body fields (multer leaves them as strings, JSON already parsed)
    const body = req.body || {};
    const projectKey = (req.headers["x-project-key"] as string) || body.projectKey || body.project_key || "";
    const data = {
      projectKey,
      message: body.message || "",
      contactEmail: body.contactEmail || body.contact_email || "",
      pageUrl: body.pageUrl || body.page_url || "",
      userAgent: body.userAgent || body.user_agent || req.headers["user-agent"] || "",
      viewport: body.viewport || "",
      language: body.language || "",
      website: body.website || "",
    };

    // Honeypot
    if (data.website && data.website.trim() !== "") {
      // Clean up uploaded files if present (prevent disk leak on bot submissions)
      cleanupUploads(req);
      // Pretend success to not tip off bots
      res.status(201).json({ id: generateId() });
      return;
    }

    const parsed = reportPublicSchema.safeParse(data);
    if (!parsed.success) {
      // Clean up uploaded files if validation fails
      cleanupUploads(req);
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const db = getDb();
    const project = db.prepare("SELECT * FROM projects WHERE publicKey = ?").get(parsed.data.projectKey) as any;
    if (!project) {
      cleanupUploads(req);
      res.status(400).json({ error: "Invalid projectKey" });
      return;
    }

    const isVideo = hasVideoField(req);

    // Rate limit: separate namespace for video so abuse doesn't starve text reports
    const ip = getClientIp(req as any);
    if (isVideo) {
      if (!rateLimitCheck(ip, project.id, "video")) {
        cleanupUploads(req);
        res.setHeader("Retry-After", "60");
        res.status(429).json({ error: "Video rate limit exceeded. Try again later." });
        return;
      }
      // Also enforce the general limiter? No — separate namespace, but keep general limiter
      // for non-video path only. We already rate-limited video namespace; also check general limiter
      // if we want to prevent bypass. Spec says separate limiter with existing non-video unchanged,
      // so don't double-count. Only video limiter for video requests.
    } else {
      if (!rateLimitCheck(ip, project.id)) {
        cleanupUploads(req);
        res.status(429).json({ error: "Rate limit exceeded. Try again later." });
        return;
      }
    }

    const files = pickedFiles(req);
    // Per-file caps — multer's global limit was raised to 25MiB for video
    for (const image of [files.screenshot, files.annotations]) {
      if (image && (image.size || 0) > MAX_FILE_BYTES) {
        cleanupUploads(req);
        res.status(400).json({ error: "File too large (max 5MB)" });
        return;
      }
    }
    if (files.domSnapshot && (files.domSnapshot.size || 0) > MAX_SNAPSHOT_BYTES) {
      cleanupUploads(req);
      res.status(400).json({ error: "File too large" });
      return;
    }
    // Per-video cap
    if (files.video) {
      if ((files.video.size || 0) > MAX_VIDEO_BYTES) {
        cleanupUploads(req);
        res.status(400).json({ error: "File too large — max 25MB" });
        return;
      }
      // Magic-byte validation
      const base = baseMime(files.video.filename ? "" : "");
      // Use the file's stored path and the mime from the upload's contentType.
      // We need the actual mime that passed fileFilter — retrieve from req.files metadata?
      // multer preserves original mimetype in file.mimetype; but our UploadedFile type lost it.
      // So we read it from req.files directly.
      const rawVideoFile = (req.files as any)?.["video"]?.[0] as any;
      const claimedMime: string = rawVideoFile?.mimetype || "";
      if (!validateVideoMagic(files.video.path!, claimedMime)) {
        cleanupUploads(req);
        res.status(400).json({ error: "Invalid video file" });
        return;
      }
      // Duration check: only reject when parse succeeds and >61s
      const dur = probeVideoDurationMs(files.video.path!, claimedMime);
      if (dur !== null && dur > MAX_VIDEO_DURATION_MS + VIDEO_DURATION_TOLERANCE_MS) {
        cleanupUploads(req);
        res.status(400).json({ error: "Video too long — max 60s" });
        return;
      }
      // Per-project quota 1 GiB
      const usage = projectVideoUsageBytes(project.id);
      const incoming = files.video.size || 0;
      if (usage + incoming > PROJECT_VIDEO_QUOTA_BYTES) {
        cleanupUploads(req);
        res.status(413).json({ error: "Project storage quota exceeded" });
        return;
      }
      // Warning threshold log at 75%
      if (usage + incoming > PROJECT_VIDEO_QUOTA_BYTES * 0.75) {
        console.warn(`[quota] project ${project.id} at ${Math.round(((usage+incoming)/PROJECT_VIDEO_QUOTA_BYTES)*100)}% of video quota`);
      }
    }

    const id = generateId();
    const createdAt = nowIso();
    const ipHash = hashIp(ip);
    const screenshotPath = files.screenshot?.filename || null;
    const snapshotPath = files.domSnapshot?.filename || null;
    const annotationsPath = files.annotations?.filename || null;
    let videoPath: string | null = null;
    let videoMime: string | null = null;
    let videoDurationMs: number | null = null;
    let videoSizeBytes: number | null = null;
    if (files.video) {
      const rawVideoFile = (req.files as any)?.["video"]?.[0] as any;
      const claimedMime: string = rawVideoFile?.mimetype || "";
      videoPath = files.video.filename || null;
      videoMime = baseMime(claimedMime);
      const probed = probeVideoDurationMs(files.video.path!, claimedMime);
      videoDurationMs = probed;
      videoSizeBytes = files.video.size || 0;
      console.info(`[video] project=${project.id} mime=${videoMime} size=${videoSizeBytes} durationMs=${videoDurationMs}`);
    }

    // EXIF strip: for MVP we just store as-is; real EXIF strip would re-encode image.
    // We ensure random filename already prevents path traversal.

    db.prepare(
      `INSERT INTO reports (id, projectId, message, contactEmail, pageUrl, userAgent, viewport, language, screenshotPath, snapshotPath, annotationsPath, videoPath, videoMime, videoDurationMs, videoSizeBytes, status, createdAt, ipHash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
    ).run(
      id,
      project.id,
      parsed.data.message,
      parsed.data.contactEmail || null,
      parsed.data.pageUrl,
      parsed.data.userAgent || "",
      parsed.data.viewport || "",
      parsed.data.language || "",
      screenshotPath,
      snapshotPath,
      annotationsPath,
      videoPath,
      videoMime,
      videoDurationMs,
      videoSizeBytes,
      createdAt,
      ipHash
    );

    res.status(201).json({ id });
  }
);

router.options("/", (_req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type, x-project-key");
  res.header("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.status(204).end();
});

// Authenticated video streaming — must be before /:id generic route
router.get("/:id/video", authMiddleware, (req, res) => {
  const db = getDb();
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id) as any;
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(report.projectId) as any;
  if (!project || project.ownerId !== req.user!.id) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  if (!report.videoPath) {
    res.status(404).json({ error: "No video for this report" });
    return;
  }
  const filePath = resolveStoredFile(report.videoPath);
  if (!filePath) {
    res.status(404).json({ error: "Video file not found" });
    return;
  }
  const mime = report.videoMime || (report.videoPath.endsWith(".mp4") ? "video/mp4" : "video/webm");
  const stat = fs.statSync(filePath);
  const total = stat.size;

  // Headers
  res.setHeader("Content-Type", mime);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Cache-Control", "private, max-age=60");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.query.download === "1" || req.query.download === "true") {
    res.setHeader("Content-Disposition", `attachment; filename="${path.basename(report.videoPath)}"`);
  } else {
    res.setHeader("Content-Disposition", `inline; filename="${path.basename(report.videoPath)}"`);
  }

  const range = req.headers.range as string | undefined;
  if (!range) {
    res.setHeader("Content-Length", String(total));
    // Use stream to support both small and large files
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    return;
  }

  // Parse Range: bytes=START-END
  const m = range.match(/bytes=(\d*)-(\d*)/);
  if (!m) {
    res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
    return;
  }
  let start = m[1] ? parseInt(m[1], 10) : 0;
  let end = m[2] ? parseInt(m[2], 10) : total - 1;
  if (isNaN(start) || isNaN(end) || start > end || start >= total) {
    res.status(416).setHeader("Content-Range", `bytes */${total}`).end();
    return;
  }
  if (end >= total) end = total - 1;
  const chunkSize = end - start + 1;
  res.status(206);
  res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
  res.setHeader("Content-Length", String(chunkSize));
  const stream = fs.createReadStream(filePath, { start, end });
  stream.pipe(res);
});

// Authenticated single report routes
router.get("/:id", authMiddleware, (req, res) => {
  const db = getDb();
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id) as any;
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(report.projectId) as any;
  if (!project || project.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(report);
});

router.patch("/:id", authMiddleware, (req, res) => {
  const parsed = reportStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id) as any;
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(report.projectId) as any;
  if (!project || project.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  db.prepare("UPDATE reports SET status = ? WHERE id = ?").run(parsed.data.status, req.params.id);
  const updated = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id) as any;
  res.json(updated);
});

router.delete("/:id", authMiddleware, (req, res) => {
  const db = getDb();
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id) as any;
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(report.projectId) as any;
  if (!project || project.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  // Delete stored artifacts if present (screenshot, DOM snapshot, annotations overlay, video)
  for (const stored of [report.screenshotPath, report.snapshotPath, report.annotationsPath, report.videoPath]) {
    if (!stored) continue;
    const resolved = resolveStoredFile(stored);
    if (!resolved) continue;
    try {
      fs.unlinkSync(resolved);
    } catch {}
  }
  db.prepare("DELETE FROM reports WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

export default router;
