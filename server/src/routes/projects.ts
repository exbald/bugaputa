import { Router } from "express";
import { nanoid } from "nanoid";
import { getDb, generateId, nowIso } from "../db.js";
import { projectCreateSchema, paginationSchema } from "../lib/validators.js";
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
  };
}

router.get("/", (req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM projects WHERE ownerId = ? ORDER BY createdAt DESC").all(req.user!.id) as any[];
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
    "INSERT INTO projects (id, ownerId, name, publicKey, createdAt, allowedOrigins) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(id, req.user!.id, name, publicKey, createdAt, allowedOrigins ? JSON.stringify(allowedOrigins) : null);
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
