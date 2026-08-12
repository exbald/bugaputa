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
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function getUploadDir(): string {
  return process.env.UPLOAD_DIR || "./data/uploads";
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = getUploadDir();
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename(_req, file, cb) {
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
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Invalid file type: ${file.mimetype}`));
  },
});

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
      upload.single("screenshot")(req, res, (err: any) => {
        if (err) {
          // multer error
          if (err.code === "LIMIT_FILE_SIZE") {
            res.status(400).json({ error: "File too large (max 5MB)" });
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
      // Pretend success to not tip off bots
      res.status(201).json({ id: generateId() });
      return;
    }

    const parsed = reportPublicSchema.safeParse(data);
    if (!parsed.success) {
      // Clean up uploaded file if validation fails
      const file = (req as any).file;
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    const db = getDb();
    const project = db.prepare("SELECT * FROM projects WHERE publicKey = ?").get(parsed.data.projectKey) as any;
    if (!project) {
      const file = (req as any).file;
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      res.status(400).json({ error: "Invalid projectKey" });
      return;
    }

    // Rate limit 20/min/IP/project
    const ip = getClientIp(req as any);
    if (!rateLimitCheck(ip, project.id)) {
      const file = (req as any).file;
      if (file?.path) {
        try { fs.unlinkSync(file.path); } catch {}
      }
      res.status(429).json({ error: "Rate limit exceeded. Try again later." });
      return;
    }

    const id = generateId();
    const createdAt = nowIso();
    const ipHash = hashIp(ip);
    const screenshotPath = (req as any).file ? (req as any).file.filename : null;

    // EXIF strip: for MVP we just store as-is; real EXIF strip would re-encode image.
    // We ensure random filename already prevents path traversal.

    db.prepare(
      `INSERT INTO reports (id, projectId, message, contactEmail, pageUrl, userAgent, viewport, language, screenshotPath, status, createdAt, ipHash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`
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
  // Delete screenshot file if exists
  if (report.screenshotPath) {
    try {
      fs.unlinkSync(path.join(getUploadDir(), report.screenshotPath));
    } catch {}
  }
  db.prepare("DELETE FROM reports WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

export default router;
