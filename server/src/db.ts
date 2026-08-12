import BetterSqlite3 from "better-sqlite3";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

type Db = BetterSqlite3.Database;

let db: Db | null = null;

export function getDb(): Db {
  if (!db) throw new Error("DB not initialized — call initDb() first");
  return db;
}

export function initDb(dbPath: string): Db {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  db = BetterSqlite3(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  migrate(db);
  return db;
}

function migrate(database: Db) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      ownerId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      publicKey TEXT UNIQUE NOT NULL,
      createdAt TEXT NOT NULL,
      allowedOrigins TEXT
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      message TEXT NOT NULL,
      contactEmail TEXT,
      pageUrl TEXT NOT NULL,
      userAgent TEXT NOT NULL,
      viewport TEXT NOT NULL,
      language TEXT NOT NULL,
      screenshotPath TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','archived')),
      createdAt TEXT NOT NULL,
      ipHash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(ownerId);
    CREATE INDEX IF NOT EXISTS idx_projects_publicKey ON projects(publicKey);
    CREATE INDEX IF NOT EXISTS idx_reports_project ON reports(projectId);
    CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
  `);
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

export function generateId(): string {
  return randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
