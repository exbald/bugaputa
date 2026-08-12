import { Router } from "express";
import * as bcrypt from "bcrypt";
import { getDb, generateId, nowIso } from "../db.js";
import { registerSchema, loginSchema } from "../lib/validators.js";
import { signToken, authMiddleware, cookieOptions } from "../middleware/auth.js";

const router = Router();

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const db = getDb();
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as any;
  if (existing) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const id = generateId();
  const createdAt = nowIso();
  db.prepare("INSERT INTO users (id, email, passwordHash, createdAt) VALUES (?, ?, ?, ?)").run(
    id,
    email,
    passwordHash,
    createdAt
  );
  const user = { id, email, createdAt };
  const token = signToken({ id, email });
  res.cookie("token", token, cookieOptions());
  res.status(201).json({ user });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }
  const { email, password } = parsed.data;
  const db = getDb();
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
  if (!row) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const user = { id: row.id, email: row.email, createdAt: row.createdAt };
  const token = signToken({ id: row.id, email: row.email });
  res.cookie("token", token, cookieOptions());
  res.json({ user });
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token", { ...cookieOptions(), maxAge: 0 });
  res.clearCookie("token", { path: "/", maxAge: 0 });
  res.json({ ok: true });
});

router.get("/me", authMiddleware, (req, res) => {
  const db = getDb();
  const row = db.prepare("SELECT id, email, createdAt FROM users WHERE id = ?").get(req.user!.id) as any;
  if (!row) {
    res.status(401).json({ error: "User not found" });
    return;
  }
  res.json({ user: row });
});

export default router;
