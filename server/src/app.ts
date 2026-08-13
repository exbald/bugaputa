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

export function createApp(opts?: { dbPath?: string; uploadDir?: string }) {
  const dbPath = opts?.dbPath || process.env.DATABASE_URL || "./data/app.db";
  const uploadDir = opts?.uploadDir || process.env.UPLOAD_DIR || "./data/uploads";
  if (opts?.uploadDir) process.env.UPLOAD_DIR = opts.uploadDir;

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
        connectSrc: ["'self'", "https://bugaputa.no-code.gdn"],
        imgSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", "https://bugaputa.no-code.gdn"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", "https:", "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
  }));
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

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
    const filePath = path.join(uploadDir, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "Not found" });
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
  app.use("/api/projects", projectRoutes);
  app.use("/api/reports", reportRoutes);

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
      res.status(400).json({ error: "File too large (max 5MB)" });
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
