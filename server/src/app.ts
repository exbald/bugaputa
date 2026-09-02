import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as path from "node:path";
import * as fs from "node:fs";
import { initDb } from "./db.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import reportRoutes from "./routes/reports.js";
import widgetConfigRoutes from "./routes/widgetConfig.js";
import presenceRoutes from "./routes/presence.js";
import { CANONICAL_ORIGIN, LEGACY_ORIGIN, canonicalRedirectMiddleware } from "./lib/canonical.js";

// If the app was previously using /data/app.db (pre-fix volume path),
// migrate that file into /app/data/app.db on first boot after the fix.
function migrateLegacyDbIfNeeded(targetPath: string) {
  const legacyPath = "/data/app.db";
  if (targetPath === legacyPath) return;
  try {
    if (fs.existsSync(targetPath)) return;
    if (!fs.existsSync(legacyPath)) return;
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(legacyPath, targetPath);
    // Also copy WAL/SHM if present
    for (const suffix of ["-wal", "-shm"]) {
      const src = legacyPath + suffix;
      if (fs.existsSync(src)) fs.copyFileSync(src, targetPath + suffix);
    }
    // Copy uploads as well if they live under /data/uploads
    const legacyUploads = "/data/uploads";
    const targetUploads = "/app/data/uploads";
    if (fs.existsSync(legacyUploads) && !fs.existsSync(targetUploads)) {
      fs.mkdirSync(path.dirname(targetUploads), { recursive: true });
      fs.cpSync(legacyUploads, targetUploads, { recursive: true, force: false });
    }
    console.log(`[db] migrated legacy DB ${legacyPath} -> ${targetPath}`);
  } catch (err) {
    console.warn("[db] legacy migration check failed:", err);
  }
}

export function createApp(opts?: { dbPath?: string; uploadDir?: string }) {
  const dbPath = opts?.dbPath || process.env.DATABASE_URL || "/app/data/app.db";
  const uploadDir = opts?.uploadDir || process.env.UPLOAD_DIR || "/app/data/uploads";
  if (opts?.uploadDir) process.env.UPLOAD_DIR = opts.uploadDir;

  migrateLegacyDbIfNeeded(dbPath);
  console.log(`[db] using ${dbPath}`);
  initDb(dbPath);

  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", "https:", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        connectSrc: ["'self'", CANONICAL_ORIGIN, LEGACY_ORIGIN],
        // https: lets DOM-snapshot viewers load the reporter's remote images. A
        // srcdoc iframe inherits this policy; the frame is sandboxed and sends no
        // credentials, but note remote images do reach the customer's servers.
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", CANONICAL_ORIGIN, LEGACY_ORIGIN],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  // Canonical host redirect (Traefik-aware via X-Forwarded-Host). Must run
  // before static/API so document requests on legacy/www are redirected, while
  // widget assets and API remain reachable via compat allowlist.
  app.use(canonicalRedirectMiddleware);

  // Default CORP same-origin for app routes; widget assets override to cross-origin
  app.use((req, res, next) => {
    const isWidgetAsset = req.path === "/widget.js" || req.path === "/widget.css" || req.path === "/html2canvas.min.js" || req.path === "/modern-screenshot.min.js";
    res.setHeader("Cross-Origin-Resource-Policy", isWidgetAsset ? "cross-origin" : "same-origin");
    if (isWidgetAsset) res.setHeader("Access-Control-Allow-Origin", "*");
    next();
  });

  // Health
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  // Uploads static
  app.get("/uploads/:filename", (req, res) => {
    const filename = path.basename(req.params.filename);
    let filePath = path.join(uploadDir, filename);
    // Legacy fallback before volume path was fixed to /app/data
    if (!fs.existsSync(filePath)) {
      const legacy = path.join("/data/uploads", filename);
      if (fs.existsSync(legacy)) filePath = legacy;
    }
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    // DOM snapshots are attacker-influenced HTML. Never let them render on this
    // origin — force a download content-type so they can only be read via fetch()
    // (the dashboard) or saved, never executed as same-origin script.
    const lower = filename.toLowerCase();
    if (lower.endsWith(".html") || lower.endsWith(".gz")) {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      // sendFile derives Content-Type from the extension unless overridden here
      res.sendFile(path.resolve(filePath), { headers: { "Content-Type": "application/octet-stream" } });
      return;
    }
    res.sendFile(path.resolve(filePath));
  });

  // Widget — serve built widget if present, else source
  const widgetJsCandidates = [
    path.resolve("widget/widget.js"),
    path.resolve("client/public/widget.js"),
    path.resolve("dist/widget.js"),
  ];
  const widgetCssCandidates = [
    path.resolve("widget/widget.css"),
    path.resolve("client/public/widget.css"),
    path.resolve("dist/widget.css"),
  ];
  // Widget public assets: allow cross-origin embedding (widget is meant to be embedded on customer sites)
  // Must override helmet's CORP same-origin for these routes only
  app.get("/widget.js", (_req, res) => {
    for (const p of widgetJsCandidates) {
      if (fs.existsSync(p)) return res.type("application/javascript").sendFile(path.resolve(p));
    }
    res.type("application/javascript").send("/* Bugaputa widget not built yet */");
  });
  app.get("/widget.css", (_req, res) => {
    for (const p of widgetCssCandidates) {
      if (fs.existsSync(p)) return res.type("text/css").sendFile(path.resolve(p));
    }
    res.type("text/css").send("/* Bugaputa widget.css not built yet */");
  });
  // Capture engines, lazy-loaded by the widget after capture consent
  for (const engine of ["modern-screenshot.min.js", "html2canvas.min.js"]) {
    const candidates = [
      path.resolve(`widget/${engine}`),
      path.resolve(`client/public/${engine}`),
      path.resolve(`dist/${engine}`),
    ];
    app.get(`/${engine}`, (_req, res) => {
      for (const p of candidates) {
        if (fs.existsSync(p)) return res.type("application/javascript").sendFile(path.resolve(p));
      }
      res.status(404).type("application/javascript").send("/* capture engine not available */");
    });
  }

  // CORS for widget/report public routes is handled inside reports router
  // General CORS for API — allow same-origin by default; public routes handle their own
  // We don't set global cors allow-all, only for public routes

  app.use("/api/auth", authRoutes);
  app.use("/api/widget-config", widgetConfigRoutes);
  app.use("/api/projects", projectRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/presence", presenceRoutes);

  // Static serving for client build if present
  const clientDist = path.resolve("client/dist");
  const altClientDist = path.resolve("dist/client");
  for (const dir of [clientDist, altClientDist]) {
    if (fs.existsSync(dir)) {
      app.use(express.static(dir));
      // SPA fallback
      app.get("*", (_req, res) => {
        res.sendFile(path.join(dir, "index.html"));
      });
      break;
    }
  }

  // Global error handler for multer etc
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File too large" });
      return;
    }
    if (err.message?.includes("Invalid file type")) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
