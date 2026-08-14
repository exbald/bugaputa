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

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
// DOM snapshots are HTML, gzipped by the widget when the browser supports it.
// octet-stream is accepted because some browsers send it for Blob-backed gzip files.
const SNAPSHOT_MIME = new Set(["text/html", "application/gzip", "application/x-gzip", "application/octet-stream"]);
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;
// Image fields carry rasterized artifacts; domSnapshot carries the serialized DOM.
const IMAGE_FIELDS = new Set(["screenshot", "annotations"]);

function getUploadDir(): string {
  return process.env.UPLOAD_DIR || "/app/data/uploads";
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
  limits: { fileSize: MAX_SNAPSHOT_BYTES, files: 3 },
  fileFilter(_req, file, cb) {
    const allowed = IMAGE_FIELDS.has(file.fieldname) ? ALLOWED_MIME : SNAPSHOT_MIME;
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Invalid file type: ${file.mimetype}`));
  },
});

type UploadedFile = { path?: string; filename?: string; size?: number };

/** The three optional artifacts, keyed by field name (null when not sent). */
function pickedFiles(req: any): { screenshot: UploadedFile | null; domSnapshot: UploadedFile | null; annotations: UploadedFile | null } {
  const files = req.files || {};
  const one = (k: string): UploadedFile | null => (files[k] && files[k][0]) || null;
  return { screenshot: one("screenshot"), domSnapshot: one("domSnapshot"), annotations: one("annotations") };
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

    // Rate limit 20/min/IP/project
    const ip = getClientIp(req as any);
    if (!rateLimitCheck(ip, project.id)) {
      cleanupUploads(req);
      res.status(429).json({ error: "Rate limit exceeded. Try again later." });
      return;
    }

    const files = pickedFiles(req);
    // Per-image cap — multer's global limit had to be raised for snapshots
    for (const image of [files.screenshot, files.annotations]) {
      if (image && (image.size || 0) > MAX_FILE_BYTES) {
        cleanupUploads(req);
        res.status(400).json({ error: "File too large (max 5MB)" });
        return;
      }
    }

    const id = generateId();
    const createdAt = nowIso();
    const ipHash = hashIp(ip);
    const screenshotPath = files.screenshot?.filename || null;
    const snapshotPath = files.domSnapshot?.filename || null;
    const annotationsPath = files.annotations?.filename || null;

    // EXIF strip: for MVP we just store as-is; real EXIF strip would re-encode image.
    // We ensure random filename already prevents path traversal.

    db.prepare(
      `INSERT INTO reports (id, projectId, message, contactEmail, pageUrl, userAgent, viewport, language, screenshotPath, snapshotPath, annotationsPath, status, createdAt, ipHash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
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
  // Delete stored artifacts if present (screenshot, DOM snapshot, annotations overlay)
  for (const stored of [report.screenshotPath, report.snapshotPath, report.annotationsPath]) {
    if (!stored) continue;
    try {
      fs.unlinkSync(path.join(getUploadDir(), path.basename(stored)));
    } catch {}
  }
  db.prepare("DELETE FROM reports WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

export default router;
