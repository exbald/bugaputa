import { Router } from "express";
import { nanoid } from "nanoid";
import { getDb, generateId, nowIso, WIDGET_DEFAULTS } from "../db.js";
import { projectCreateSchema, paginationSchema, widgetSettingsSchema } from "../lib/validators.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

// All project routes require auth
router.use(authMiddleware);

function toProject(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    publicKey: row.publicKey,
    createdAt: row.createdAt,
    allowedOrigins: row.allowedOrigins ? JSON.parse(row.allowedOrigins) : null,
    widget_label: row.widget_label ?? WIDGET_DEFAULTS.label,
    widget_color: row.widget_color ?? WIDGET_DEFAULTS.color,
    widget_position: row.widget_position ?? WIDGET_DEFAULTS.position,
    // also expose camelCase aliases for convenience
    widgetLabel: row.widget_label ?? WIDGET_DEFAULTS.label,
    widgetColor: row.widget_color ?? WIDGET_DEFAULTS.color,
    widgetPosition: row.widget_position ?? WIDGET_DEFAULTS.position,
    // dashboard aggregates — 0/null when no reports; populated only on list query
    totalReports: row.totalReports != null ? Number(row.totalReports) : 0,
    openReports: row.openReports != null ? Number(row.openReports) : 0,
    lastReportAt: row.lastReportAt ?? null,
  };
}

router.get("/", (req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT projects.*,
              COUNT(reports.id) AS totalReports,
              COALESCE(SUM(CASE WHEN reports.status = 'open' THEN 1 ELSE 0 END), 0) AS openReports,
              MAX(reports.createdAt) AS lastReportAt
         FROM projects
    LEFT JOIN reports ON reports.projectId = projects.id
        WHERE projects.ownerId = ?
     GROUP BY projects.id
     ORDER BY projects.createdAt DESC`
    )
    .all(req.user!.id) as any[];
  res.json(rows.map(toProject));
});

router.post("/", (req, res) => {
  const parsed = projectCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { name, allowedOrigins } = parsed.data;
  const db = getDb();
  const id = generateId();
  const publicKey = `pk_live_${nanoid(16)}`;
  const createdAt = nowIso();
  db.prepare(
    "INSERT INTO projects (id, ownerId, name, publicKey, createdAt, allowedOrigins, widget_label, widget_color, widget_position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(id, req.user!.id, name, publicKey, createdAt, allowedOrigins ? JSON.stringify(allowedOrigins) : null, WIDGET_DEFAULTS.label, WIDGET_DEFAULTS.color, WIDGET_DEFAULTS.position);
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as any;
  res.status(201).json(toProject(row));
});

router.get("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (row.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(toProject(row));
});

// PATCH /:id — generic project update (currently only widget settings, per spec)
router.patch("/:id", (req, res) => {
  const parsed = widgetSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (row.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const fields: string[] = [];
  const values: any[] = [];
  if (parsed.data.widget_label !== undefined) {
    fields.push("widget_label = ?");
    values.push(parsed.data.widget_label.trim());
  }
  if (parsed.data.widget_color !== undefined) {
    fields.push("widget_color = ?");
    values.push(parsed.data.widget_color);
  }
  if (parsed.data.widget_position !== undefined) {
    fields.push("widget_position = ?");
    values.push(parsed.data.widget_position);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  values.push(req.params.id);
  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  res.json(toProject(updated));
});

// PATCH widget settings — owner only (alias for PATCH /:id, kept for backwards compat)
router.patch("/:id/widget-settings", (req, res) => {
  const parsed = widgetSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (row.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const fields: string[] = [];
  const values: any[] = [];
  if (parsed.data.widget_label !== undefined) {
    fields.push("widget_label = ?");
    values.push(parsed.data.widget_label);
  }
  if (parsed.data.widget_color !== undefined) {
    fields.push("widget_color = ?");
    values.push(parsed.data.widget_color);
  }
  if (parsed.data.widget_position !== undefined) {
    fields.push("widget_position = ?");
    values.push(parsed.data.widget_position);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  values.push(req.params.id);
  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  res.json(toProject(updated));
});

// Also support PUT /:id/widget-settings for convenience
router.put("/:id/widget-settings", (req, res) => {
  const parsed = widgetSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (row.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const fields: string[] = [];
  const values: any[] = [];
  if (parsed.data.widget_label !== undefined) {
    fields.push("widget_label = ?");
    values.push(parsed.data.widget_label);
  }
  if (parsed.data.widget_color !== undefined) {
    fields.push("widget_color = ?");
    values.push(parsed.data.widget_color);
  }
  if (parsed.data.widget_position !== undefined) {
    fields.push("widget_position = ?");
    values.push(parsed.data.widget_position);
  }
  if (fields.length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  values.push(req.params.id);
  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  res.json(toProject(updated));
});

router.delete("/:id", (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id) as any;
  if (!row) {
    res.status(404).json({ error: "Project not forth" });
    return;
  }
  if (row.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);
  res.status(204).end();
});

// Reports per project
router.get("/:projectId/reports", (req, res) => {
  const db = getDb();
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.projectId) as any;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  if (project.ownerId !== req.user!.id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = paginationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { status, q, page, limit } = parsed.data;
  let where = "WHERE projectId = ?";
  const params: any[] = [req.params.projectId];
  if (status) {
    where += " AND status = ?";
    params.push(status);
  }
  if (q) {
    where += " AND (message LIKE ? OR contactEmail LIKE ? OR pageUrl LIKE ?)";
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM reports ${where}`).get(...params) as any;
  const total = totalRow.cnt;
  const offset = (page - 1) * limit;
  const items = db
    .prepare(`SELECT * FROM reports ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset) as any[];
  res.json({ items, total, page, limit });
});

export default router;
