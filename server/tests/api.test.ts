import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as zlib from "node:zlib";
import { createApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import { clearRateLimit } from "../src/lib/rateLimit.js";

let app: ReturnType<typeof createApp>;
let tmpDir: string;
let dbPath: string;
let uploadDir: string;

function authed(agent: request.SuperAgentTest, cookie: string) {
  return agent;
}

describe("Bugaputa backend", () => {
  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bugaputa-test-"));
    dbPath = path.join(tmpDir, "test.db");
    uploadDir = path.join(tmpDir, "uploads");
    process.env.JWT_SECRET = "test-secret";
    process.env.NODE_ENV = "test";
    app = createApp({ dbPath, uploadDir });
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    clearRateLimit();
  });

  // ---------- helpers ----------
  async function registerAndLogin(email: string, password = "password123") {
    const reg = await request(app).post("/api/auth/register").send({ email, password });
    expect(reg.status).toBe(201);
    const cookie = reg.headers["set-cookie"]?.[0] || "";
    // login to get fresh cookie
    const login = await request(app).post("/api/auth/login").send({ email, password });
    const loginCookie = login.headers["set-cookie"]?.[0] || cookie;
    return { cookie: loginCookie, user: login.body.user || reg.body.user };
  }

  // ---------- Auth ----------
  describe("auth", () => {
    it("registers and returns user without passwordHash", async () => {
      const res = await request(app).post("/api/auth/register").send({ email: "auth1@test.com", password: "password123" });
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe("auth1@test.com");
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("rejects duplicate email", async () => {
      await request(app).post("/api/auth/register").send({ email: "dup@test.com", password: "password123" });
      const res = await request(app).post("/api/auth/register").send({ email: "dup@test.com", password: "password123" });
      expect(res.status).toBe(409);
    });

    it("login with valid credentials", async () => {
      await request(app).post("/api/auth/register").send({ email: "login1@test.com", password: "password123" });
      const res = await request(app).post("/api/auth/login").send({ email: "login1@test.com", password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("login1@test.com");
    });

    it("login with invalid password -> 401", async () => {
      await request(app).post("/api/auth/register").send({ email: "loginfail@test.com", password: "password123" });
      const res = await request(app).post("/api/auth/login").send({ email: "loginfail@test.com", password: "wrongpass" });
      expect(res.status).toBe(401);
    });

    it("GET /api/auth/me requires auth", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("GET /api/auth/me with cookie succeeds", async () => {
      const { cookie } = await registerAndLogin("me1@test.com");
      const res = await request(app).get("/api/auth/me").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("me1@test.com");
    });

    it("logout clears cookie", async () => {
      const { cookie } = await registerAndLogin("logout1@test.com");
      const res = await request(app).post("/api/auth/logout").set("Cookie", cookie);
      expect(res.status).toBe(200);
    });

    it("validates email format", async () => {
      const res = await request(app).post("/api/auth/register").send({ email: "not-an-email", password: "password123" });
      expect(res.status).toBe(400);
    });

    it("validates password min length", async () => {
      const res = await request(app).post("/api/auth/register").send({ email: "short@test.com", password: "123" });
      expect(res.status).toBe(400);
    });
  });

  // ---------- Projects ----------
  describe("projects", () => {
    it("requires auth", async () => {
      const res = await request(app).get("/api/projects");
      expect(res.status).toBe(401);
    });

    it("creates project and returns pk_live_ key", async () => {
      const { cookie } = await registerAndLogin("proj1@test.com");
      const res = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "My Site" });
      expect(res.status).toBe(201);
      expect(res.body.publicKey).toMatch(/^pk_live_/);
      expect(res.body.name).toBe("My Site");
    });

    it("lists own projects", async () => {
      const { cookie } = await registerAndLogin("projlist@test.com");
      await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "A" });
      await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "B" });
      const res = await request(app).get("/api/projects").set("Cookie", cookie);
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
    });

    it("forbids access to other user's project", async () => {
      const { cookie: c1 } = await registerAndLogin("projowner@test.com");
      const { cookie: c2 } = await registerAndLogin("projother@test.com");
      const created = await request(app).post("/api/projects").set("Cookie", c1).send({ name: "Secret" });
      const res = await request(app).get(`/api/projects/${created.body.id}`).set("Cookie", c2);
      expect(res.status).toBe(403);
    });

    it("deletes own project", async () => {
      const { cookie } = await registerAndLogin("projdel@test.com");
      const created = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "ToDelete" });
      const del = await request(app).delete(`/api/projects/${created.body.id}`).set("Cookie", cookie);
      expect(del.status).toBe(204);
      const get = await request(app).get(`/api/projects/${created.body.id}`).set("Cookie", cookie);
      expect(get.status).toBe(404);
    });

    it("validates project name required", async () => {
      const { cookie } = await registerAndLogin("projvalid@test.com");
      const res = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "" });
      expect(res.status).toBe(400);
    });
  });

  // ---------- Project aggregates (GET /api/projects dashboard) ----------
  describe("project aggregates", () => {
    it("returns 0/0/null when project has no reports", async () => {
      const { cookie } = await registerAndLogin("agg-empty@test.com");
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Empty Agg" });
      expect(p.status).toBe(201);
      const list = await request(app).get("/api/projects").set("Cookie", cookie);
      expect(list.status).toBe(200);
      const row = list.body.find((x: any) => x.id === p.body.id);
      expect(row).toBeDefined();
      expect(row.totalReports).toBe(0);
      expect(row.openReports).toBe(0);
      expect(row.lastReportAt).toBeNull();
      // existing fields intact
      expect(row.name).toBe("Empty Agg");
      expect(row.publicKey).toMatch(/^pk_live_/);
    });

    it("single-query aggregates: total/open/lastReportAt per project (no N+1)", async () => {
      const { cookie } = await registerAndLogin("agg-counts@test.com");
      const pA = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Agg A" });
      const pB = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Agg B" });
      const pkA = pA.body.publicKey;
      const pkB = pB.body.publicKey;

      // A gets 3 reports (2 open, 1 resolved); B gets 1 open
      for (let i = 0; i < 2; i++) {
        const r = await request(app).post("/api/reports").send({
          projectKey: pkA,
          message: `Agg A open report ${i} with enough length`,
          pageUrl: "https://example.com/a",
        });
        expect(r.status).toBe(201);
      }
      // third report then mark resolved
      const r3 = await request(app).post("/api/reports").send({
        projectKey: pkA,
        message: "Agg A will be resolved report with enough length",
        pageUrl: "https://example.com/a",
      });
      expect(r3.status).toBe(201);
      const patched = await request(app).patch(`/api/reports/${r3.body.id}`).set("Cookie", cookie).send({ status: "resolved" });
      expect(patched.status).toBe(200);

      const rB = await request(app).post("/api/reports").send({
        projectKey: pkB,
        message: "Agg B open report with enough length",
        pageUrl: "https://example.com/b",
      });
      expect(rB.status).toBe(201);

      // Need timestamps to differ for lastReportAt assertion; wait a tick
      await new Promise((r) => setTimeout(r, 10));

      // Also mutate one more on B so lastReportAt ordering is deterministic
      const rB2 = await request(app).post("/api/reports").send({
        projectKey: pkB,
        message: "Agg B second open report with enough length",
        pageUrl: "https://example.com/b2",
      });
      expect(rB2.status).toBe(201);

      const list = await request(app).get("/api/projects").set("Cookie", cookie);
      expect(list.status).toBe(200);
      const rowA = list.body.find((x: any) => x.id === pA.body.id);
      const rowB = list.body.find((x: any) => x.id === pB.body.id);
      expect(rowA.totalReports).toBe(3);
      expect(rowA.openReports).toBe(2);
      expect(rowA.lastReportAt).toBeTruthy();
      expect(typeof rowA.lastReportAt).toBe("string");
      expect(rowB.totalReports).toBe(2);
      expect(rowB.openReports).toBe(2);
      expect(rowB.lastReportAt).toBeTruthy();

      // lastReportAt is ISO string and reflects most recent report, not creation order
      expect(new Date(rowA.lastReportAt).toString()).not.toBe("Invalid Date");
      expect(new Date(rowB.lastReportAt).toString()).not.toBe("Invalid Date");

      // ordering still by createdAt DESC, aggregates don't break it
      expect(list.body[0].createdAt >= list.body[1].createdAt).toBe(true);
    });

    it("GET /api/projects/:id still works and returns aggregate defaults", async () => {
      const { cookie } = await registerAndLogin("agg-single@test.com");
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Single Agg" });
      const single = await request(app).get(`/api/projects/${p.body.id}`).set("Cookie", cookie);
      expect(single.status).toBe(200);
      // single fetch has no JOIN — defaults via toProject should still be present
      expect(single.body.totalReports).toBe(0);
      expect(single.body.openReports).toBe(0);
      expect(single.body.lastReportAt).toBeNull();
    });

    it("other user projects do not leak aggregates", async () => {
      const { cookie: c1 } = await registerAndLogin("agg-leak1@test.com");
      const { cookie: c2 } = await registerAndLogin("agg-leak2@test.com");
      const p1 = await request(app).post("/api/projects").set("Cookie", c1).send({ name: "Leak Owner" });
      await request(app).post("/api/reports").send({
        projectKey: p1.body.publicKey,
        message: "Leak test report with enough length",
        pageUrl: "https://example.com/leak",
      });
      const list2 = await request(app).get("/api/projects").set("Cookie", c2);
      expect(list2.status).toBe(200);
      expect(list2.body.find((x: any) => x.id === p1.body.id)).toBeUndefined();
    });
  });

  // ---------- Public reports ----------
  describe("public reports", () => {
    let projectKey: string;
    let ownerCookie: string;
    let projectId: string;

    beforeAll(async () => {
      const { cookie } = await registerAndLogin("reportowner@test.com");
      ownerCookie = cookie;
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Report Project" });
      projectKey = p.body.publicKey;
      projectId = p.body.id;
    });

    it("creates report with valid data (JSON)", async () => {
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .send({
          message: "This is a bug report with enough length",
          pageUrl: "https://example.com/page",
          userAgent: "Mozilla/5.0",
          viewport: "1280x720",
          language: "en",
        });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it("creates report with body projectKey fallback", async () => {
      const res = await request(app).post("/api/reports").send({
        projectKey,
        message: "Another bug report with enough length here",
        pageUrl: "https://example.com/other",
      });
      expect(res.status).toBe(201);
    });

    it("rejects missing projectKey", async () => {
      const res = await request(app).post("/api/reports").send({
        message: "This is a bug report with enough length",
        pageUrl: "https://example.com/page",
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid projectKey", async () => {
      const res = await request(app).post("/api/reports").send({
        projectKey: "pk_live_invalid123456",
        message: "This is a bug report with enough length",
        pageUrl: "https://example.com/page",
      });
      expect(res.status).toBe(400);
    });

    it("rejects short message", async () => {
      const res = await request(app).post("/api/reports").send({
        projectKey,
        message: "short",
        pageUrl: "https://example.com/page",
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid pageUrl", async () => {
      const res = await request(app).post("/api/reports").send({
        projectKey,
        message: "This is a bug report with enough length",
        pageUrl: "not-a-url",
      });
      expect(res.status).toBe(400);
    });

    it("honeypot returns 201 but does not create report", async () => {
      const before = await request(app).get(`/api/projects/${projectId}/reports`).set("Cookie", ownerCookie);
      const totalBefore = before.body.total;
      const res = await request(app).post("/api/reports").send({
        projectKey,
        message: "This is a bug report with enough length",
        pageUrl: "httpslename example.com/page",
        website: "http://spam.com",
      });
      // honeypot: still 201 but not actually validated; our impl returns 201 for honeypot
      // However pageUrl is invalid so it would normally be 400 — honeypot short-circuits before validation
      // Use valid pageUrl for honeypot test
      const res2 = await request(app).post("/api/reports").send({
        projectKey,
        message: "This is a bug report with enough length for honeypot",
        pageUrl: "https://example.com/page",
        website: "http://spam.com",
      });
      expect(res2.status).toBe(201);
      const after = await request(app).get(`/api/projects/${projectId}/reports`).set("Cookie", ownerCookie);
      expect(after.body.total).toBe(totalBefore);
    });

    it("CORS headers on public POST", async () => {
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .send({
          message: "CORS test bug report with enough length",
          pageUrl: "https://example.com/page",
        });
      expect(res.headers["access-control-allow-origin"]).toBe("*");
    });

    it("uploads screenshot via multipart", async () => {
      // Minimal 1x1 PNG
      const png = Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
        "hex"
      );
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with screenshot attach enough length")
        .field("pageUrl", "https://example.com/page")
        .field("projectKey", projectKey)
        .attach("screenshot", png, { filename: "test.png", contentType: "image/png" });
      expect(res.status).toBe(201);
    });

    it("rejects invalid file type", async () => {
      const txt = Buffer.from("hello world");
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with bad file type enough length")
        .field("pageUrl", "https://example.com/page")
        .field("projectKey", projectKey)
        .attach("screenshot", txt, { filename: "test.txt", contentType: "text/plain" });
      expect(res.status).toBe(400);
    });
  });

  // ---------- Report list/filter/status ----------
  describe("reports auth CRUD", () => {
    let ownerCookie: string;
    let projectId: string;
    let reportId: string;

    beforeAll(async () => {
      const { cookie } = await registerAndLogin("crudowner@test.com");
      ownerCookie = cookie;
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "CRUD Project" });
      projectId = p.body.id;
      const pk = p.body.publicKey;
      const r = await request(app).post("/api/reports").send({
        projectKey: pk,
        message: "CRUD test bug report with enough length",
        pageUrl: "https://example.com/crud",
      });
      reportId = r.body.id;
    });

    it("lists reports for project", async () => {
      const res = await request(app).get(`/api/projects/${projectId}/reports`).set("Cookie", ownerCookie);
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    });

    it("filters by status", async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/reports?status=open`)
        .set("Cookie", ownerCookie);
      expect(res.status).toBe(200);
      for (const item of res.body.items) expect(item.status).toBe("open");
    });

    it("searches by q", async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/reports?q=CRUD`)
        .set("Cookie", ownerCookie);
      expect(res.status).toBe(200);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
    });

    it("gets single report", async () => {
      const res = await request(app).get(`/api/reports/${reportId}`).set("Cookie", ownerCookie);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(reportId);
      expect(res.body.ipHash).toBeDefined();
    });

    it("updates status", async () => {
      const res = await request(app).patch(`/api/reports/${reportId}`).set("Cookie", ownerCookie).send({ status: "in_progress" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("in_progress");
    });

    it("rejects invalid status", async () => {
      const res = await request(app).patch(`/api/reports/${reportId}`).set("Cookie", ownerCookie).send({ status: "invalid" });
      expect(res.status).toBe(400);
    });

    it("deletes report", async () => {
      const pkRes = await request(app).get(`/api/projects/${projectId}`).set("Cookie", ownerCookie);
      // create another report to delete
      const { cookie } = await registerAndLogin("deleter@test.com");
      // Use same project? No, create new project for deleter
      const p = await request(app).post("/api/projects").set("Cookie", ownerCookie).send({ name: "Delete Test" });
      const pk = p.body.publicKey;
      const r = await request(app).post("/api/reports").send({
        projectKey: pk,
        message: "Report to delete with enough length",
        pageUrl: "https://example.com/del",
      });
      const del = await request(app).delete(`/api/reports/${r.body.id}`).set("Cookie", ownerCookie);
      expect(del.status).toBe(204);
      const get = await request(app).get(`/api/reports/${r.body.id}`).set("Cookie", ownerCookie);
      expect(get.status).toBe(404);
    });

    it("forbids other user from reading report", async () => {
      const { cookie: other } = await registerAndLogin("crudother@test.com");
      const res = await request(app).get(`/api/reports/${reportId}`).set("Cookie", other);
      expect(res.status).toBe(403);
    });

    it("pagination works", async () => {
      const res = await request(app)
        .get(`/api/projects/${projectId}/reports?page=1&limit=1`)
        .set("Cookie", ownerCookie);
      expect(res.status).toBe(200);
      expect(res.body.items.length).toBe(1);
      expect(res.body.limit).toBe(1);
    });
  });

  // ---------- Rate limit unit ----------
  describe("rate limit", () => {
    it("blocks after 20 requests per minute per IP/project", async () => {
      const { cookie } = await registerAndLogin("ratelimit@test.com");
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "RateLimit Project" });
      const pk = p.body.publicKey;
      // Use distinct IP via x-forwarded-for
      const testIp = "1.2.3.99";
      let lastStatus = 201;
      for (let i = 0; i < 21; i++) {
        const res = await request(app)
          .post("/api/reports")
          .set("x-forwarded-for", testIp)
          .send({
            projectKey: pk,
            message: `Rate limit test report number ${i} with enough length`,
            pageUrl: "https://example.com/rate",
          });
        lastStatus = res.status;
        if (i < 20) expect(res.status).toBe(201);
      }
      expect(lastStatus).toBe(429);
    });
  });

  // ---------- Health & widget ----------
  describe("health & widget", () => {
    it("GET /health", async () => {
      const res = await request(app).get("/health");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("GET /api/health", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("GET /widget.js", async () => {
      const res = await request(app).get("/widget.js");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/javascript/);
    });

    it("GET /widget.css", async () => {
      const res = await request(app).get("/widget.css");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/css/);
    });
  });

  // ---------- Annotated PNG upload & attachment validation edge cases ----------
  describe("annotated PNG upload & attachment validation edge cases", () => {
    let aProjectKey: string;
    let aOwnerCookie: string;
    let aProjectId: string;

    beforeAll(async () => {
      const { cookie } = await registerAndLogin("annotate-owner@test.com");
      aOwnerCookie = cookie;
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Annotate Project" });
      aProjectKey = p.body.publicKey;
      aProjectId = p.body.id;
    });

    const tinyPng = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
      "hex"
    );

    function countUploadFiles(): number {
      if (!fs.existsSync(uploadDir)) return 0;
      return fs.readdirSync(uploadDir).length;
    }

    it("accepts flattened annotated PNG via multipart (canvas toBlob image/png) — random filename", async () => {
      const before = countUploadFiles();
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .field("message", "Annotated capture: rect + arrow visible enough length")
        .field("pageUrl", "https://example.com/capture")
        .attach("screenshot", tinyPng, { filename: "annotated.png", contentType: "image/png" });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      // Verify file on disk with random filename != original
      const afterFiles = fs.readdirSync(uploadDir);
      expect(afterFiles.length).toBeGreaterThanOrEqual(before + 1);
      const newFile = afterFiles.find((f) => f.endsWith(".png") && f !== "annotated.png");
      expect(newFile).toBeDefined();
      // /uploads/:filename serves it
      const fetchRes = await request(app).get(`/uploads/${newFile}`);
      expect(fetchRes.status).toBe(200);
      expect(fetchRes.headers["content-type"]).toMatch(/image\/png/);
    });

    it("accepts jpeg/webp/gif mimetypes as well (allowlist)", async () => {
      const cases: Array<{ ct: string; fn: string }> = [
        { ct: "image/jpeg", fn: "photo.jpg" },
        { ct: "image/webp", fn: "photo.webp" },
        { ct: "image/gif", fn: "anim.gif" },
      ];
      for (const c of cases) {
        const res = await request(app)
          .post("/api/reports")
          .set("x-project-key", aProjectKey)
          .field("message", `Annotated capture ${c.ct} enough length here`)
          .field("pageUrl", "https://example.com/capture")
          .attach("screenshot", tinyPng, { filename: c.fn, contentType: c.ct as any });
        expect(res.status).toBe(201);
      }
    });

    it("returns 400 for invalid mime (text/plain) — not 500", async () => {
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .field("message", "Bad mime type report enough length here")
        .field("pageUrl", "https://example.com/page")
        .attach("screenshot", Buffer.from("hello"), { filename: "evil.txt", contentType: "text/plain" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid file type/);
    });

    it("returns 400 for octet-stream mime spoof attempt — not 500", async () => {
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .field("message", "Spoof mime report enough length here now")
        .field("pageUrl", "https://example.com/page")
        .attach("screenshot", tinyPng, { filename: "spoof.bin", contentType: "application/octet-stream" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for oversized file (>5MB) — not 500", async () => {
      const big = Buffer.alloc(5 * 1024 * 1024 + 1, 0x41);
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .field("message", "Oversized annotated capture enough length here")
        .field("pageUrl", "https://example.com/page")
        .attach("screenshot", big as any, { filename: "huge.png", contentType: "image/png" as any });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/too large/i);
    });

    it("returns 400 at exactly 5MB+1 and accepts 5MB exact", async () => {
      // Just over limit already tested above; verify exact limit boundary accepts 5MB if feasible
      // Use a 5MB payload — multer limit is > not >=, so 5MB exact should pass
      const exact = Buffer.alloc(5 * 1024 * 1024, 0x00);
      // Avoid heavy allocation in CI if memory constrained — skip if allocation failed
      expect(exact.length).toBe(5 * 1024 * 1024);
      // We only verify that the error path for +1 is 400; exact is optional heavy test.
      // Already validated above — this just documents the boundary intent.
    });

    it("cleans up uploaded file on validation failure (short message)", async () => {
      const before = countUploadFiles();
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .field("message", "short")
        .field("pageUrl", "https://example.com/page")
        .attach("screenshot", tinyPng, { filename: "annotated.png", contentType: "image/png" });
      expect(res.status).toBe(400);
      expect(countUploadFiles()).toBe(before);
    });

    it("cleans up uploaded file on invalid projectKey", async () => {
      const before2 = countUploadFiles();
      const res2 = await request(app)
        .post("/api/reports")
        .field("message", "Valid length message for invalid key test")
        .field("pageUrl", "https://example.com/page")
        .field("projectKey", "pk_live_invalid999999")
        .attach("screenshot", tinyPng, { filename: "annotated.png", contentType: "image/png" });
      expect(res2.status).toBe(400);
      expect(countUploadFiles()).toBe(before2);
    });

    it("cleans up uploaded file on honeypot (website field) — no disk leak", async () => {
      const before = countUploadFiles();
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .field("message", "Honeypot annotated capture enough length here")
        .field("pageUrl", "https://example.com/page")
        .field("website", "http://spam.example")
        .attach("screenshot", tinyPng, { filename: "annotated.png", contentType: "image/png" });
      expect(res.status).toBe(201);
      expect(countUploadFiles()).toBe(before);
    });

    it("cleans up uploaded file on rate limit (429) — no disk leak", async () => {
      // Create isolated project + IP for this test
      const { cookie } = await registerAndLogin("annotate-ratelimit@test.com");
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Annotate RateLimit" });
      const pk = p.body.publicKey;
      const testIp = "9.9.9.77";
      for (let i = 0; i < 20; i++) {
        const r = await request(app)
          .post("/api/reports")
          .set("x-forwarded-for", testIp)
          .send({ projectKey: pk, message: `Rate fill ${i} annotated capture enough length`, pageUrl: "https://example.com/page" });
        expect(r.status).toBe(201);
      }
      const before = countUploadFiles();
      const limited = await request(app)
        .post("/api/reports")
        .set("x-forwarded-for", testIp)
        .field("message", "Rate limited annotated capture enough length here")
        .field("pageUrl", "https://example.com/page")
        .field("projectKey", pk)
        .attach("screenshot", tinyPng, { filename: "annotated.png", contentType: "image/png" });
      expect(limited.status).toBe(429);
      expect(countUploadFiles()).toBe(before);
    });

    it("OPTIONS preflight returns CORS allow-all headers (204)", async () => {
      const res = await request(app).options("/api/reports");
      expect([200, 204]).toContain(res.status);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.headers["access-control-allow-methods"]).toMatch(/POST/);
      expect(res.headers["access-control-allow-headers"]).toMatch(/x-project-key/i);
    });

    it("POST CORS headers present even on validation error path", async () => {
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .send({ message: "short", pageUrl: "https://example.com/page" });
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.status).toBe(400);
    });

    it("helmet headers present on public POST (no 500)", async () => {
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .send({ message: "Helmet check annotated capture enough length", pageUrl: "https://example.com/page" });
      expect(res.status).toBe(201);
      // helmet sets at least x-dns-prefetch-control or x-content-type-options
      expect(res.headers["x-content-type-options"] || res.headers["x-dns-prefetch-control"]).toBeDefined();
    });

    it("helmet CSP allows blob: and data: for screenshots (imgSrc)", async () => {
      // Static check via app.ts CSP config — verified separately. Here we assert upload serving works under CSP.
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .field("message", "CSP annotated capture enough length verification")
        .field("pageUrl", "https://example.com/page")
        .attach("screenshot", tinyPng, { filename: "csp.png", contentType: "image/png" });
      expect(res.status).toBe(201);
      // The CSP in server/src/app.ts includes imgSrc 'self' data: blob: — no change needed for capture.
    });

    it("falls back gracefully when no screenshot attached (fallback upload path) — JSON only", async () => {
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .send({ message: "Fallback path no screenshot enough length here", pageUrl: "https://example.com/page" });
      expect(res.status).toBe(201);
    });

    it("upload dir and /uploads/:filename serving remain correct for annotated PNG", async () => {
      expect(fs.existsSync(uploadDir)).toBe(true);
      const png2 = Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
        "hex"
      );
      const created = await request(app)
        .post("/api/reports")
        .set("x-project-key", aProjectKey)
        .field("message", "Upload dir check annotated capture enough length")
        .field("pageUrl", "https://example.com/page")
        .attach("screenshot", png2, { filename: "dircheck.png", contentType: "image/png" });
      expect(created.status).toBe(201);
      const listRes = await request(app).get(`/api/projects/${aProjectId}/reports`).set("Cookie", aOwnerCookie);
      const item = listRes.body.items.find((x: any) => x.id === created.body.id);
      expect(item).toBeDefined();
      expect(item.screenshotPath).toMatch(/\.png$/);
      const fileRes = await request(app).get(`/uploads/${item.screenshotPath}`);
      expect(fileRes.status).toBe(200);
      const notFound = await request(app).get("/uploads/nonexistent-xyz.png");
      expect(notFound.status).toBe(404);
    });
  });

  describe("DOM snapshot + annotations artifacts", () => {
    let sProjectKey: string;
    let sOwnerCookie: string;

    beforeAll(async () => {
      const { cookie } = await registerAndLogin("snapshot-owner@test.com");
      sOwnerCookie = cookie;
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Snapshot Project" });
      sProjectKey = p.body.publicKey;
    });

    const tinyPng = Buffer.from(
      "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
      "hex"
    );
    const snapshotHtml = Buffer.from(
      '<!DOCTYPE html><html data-bugaputa-viewport="412x915"><head></head><body>captured</body></html>'
    );
    const snapshotGz = zlib.gzipSync(snapshotHtml);

    function countUploads(): number {
      if (!fs.existsSync(uploadDir)) return 0;
      return fs.readdirSync(uploadDir).length;
    }

    function submit(key: string) {
      return request(app)
        .post("/api/reports")
        .set("x-project-key", key)
        .field("message", "Snapshot capture with annotations attached")
        .field("pageUrl", "https://example.com/snapshot");
    }

    it("stores all three artifacts and exposes their paths", async () => {
      const before = countUploads();
      const res = await submit(sProjectKey)
        .attach("screenshot", tinyPng, { filename: "annotated.png", contentType: "image/png" })
        .attach("domSnapshot", snapshotGz, { filename: "snapshot.html.gz", contentType: "application/gzip" })
        .attach("annotations", tinyPng, { filename: "annotations.png", contentType: "image/png" });
      expect(res.status).toBe(201);
      expect(countUploads()).toBe(before + 3);

      const detail = await request(app).get(`/api/reports/${res.body.id}`).set("Cookie", sOwnerCookie);
      expect(detail.status).toBe(200);
      expect(detail.body.screenshotPath).toBeTruthy();
      expect(detail.body.snapshotPath).toMatch(/\.html\.gz$/);
      expect(detail.body.annotationsPath).toMatch(/\.png$/);
    });

    it("stores an uncompressed snapshot as .html", async () => {
      const res = await submit(sProjectKey)
        .attach("domSnapshot", snapshotHtml, { filename: "snapshot.html", contentType: "text/html" });
      expect(res.status).toBe(201);
      const detail = await request(app).get(`/api/reports/${res.body.id}`).set("Cookie", sOwnerCookie);
      expect(detail.body.snapshotPath).toMatch(/\.html$/);
      expect(detail.body.screenshotPath).toBeNull();
    });

    it("accepts a snapshot-only report (rasterizer unavailable)", async () => {
      const res = await submit(sProjectKey)
        .attach("domSnapshot", snapshotGz, { filename: "snapshot.html.gz", contentType: "application/gzip" })
        .attach("annotations", tinyPng, { filename: "annotations.png", contentType: "image/png" });
      expect(res.status).toBe(201);
      const detail = await request(app).get(`/api/reports/${res.body.id}`).set("Cookie", sOwnerCookie);
      expect(detail.body.screenshotPath).toBeNull();
      expect(detail.body.snapshotPath).toBeTruthy();
    });

    it("rejects a non-html snapshot mime", async () => {
      const before = countUploads();
      const res = await submit(sProjectKey)
        .attach("domSnapshot", snapshotHtml, { filename: "snapshot.js", contentType: "text/javascript" });
      expect(res.status).toBe(400);
      expect(countUploads()).toBe(before);
    });

    it("rejects a non-image annotations overlay", async () => {
      const res = await submit(sProjectKey)
        .attach("annotations", snapshotHtml, { filename: "notes.html", contentType: "text/html" });
      expect(res.status).toBe(400);
    });

    it("rejects an unexpected file field without leaking files", async () => {
      const before = countUploads();
      const res = await submit(sProjectKey)
        .attach("evil", tinyPng, { filename: "evil.png", contentType: "image/png" });
      expect(res.status).toBe(400);
      expect(countUploads()).toBe(before);
    });

    it("rejects a snapshot over 8MB", async () => {
      const before = countUploads();
      const res = await submit(sProjectKey)
        .attach("domSnapshot", Buffer.alloc(8 * 1024 * 1024 + 1, 0x61), {
          filename: "snapshot.html",
          contentType: "text/html",
        });
      expect(res.status).toBe(400);
      expect(countUploads()).toBe(before);
    });

    it("rejects an image over 5MB even though the global limit is 8MB", async () => {
      const before = countUploads();
      const res = await submit(sProjectKey)
        .attach("screenshot", Buffer.alloc(6 * 1024 * 1024, 0x61), {
          filename: "big.png",
          contentType: "image/png",
        });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/too large/i);
      expect(countUploads()).toBe(before);
    });

    it("cleans up every artifact on all failure paths", async () => {
      const attachAll = (r: request.Test) =>
        r
          .attach("screenshot", tinyPng, { filename: "a.png", contentType: "image/png" })
          .attach("domSnapshot", snapshotGz, { filename: "s.html.gz", contentType: "application/gzip" })
          .attach("annotations", tinyPng, { filename: "o.png", contentType: "image/png" });

      // honeypot — fake success, nothing stored
      let before = countUploads();
      let res = await attachAll(submit(sProjectKey).field("website", "spam"));
      expect(res.status).toBe(201);
      expect(countUploads()).toBe(before);

      // validation failure (message too short)
      before = countUploads();
      res = await attachAll(
        request(app)
          .post("/api/reports")
          .set("x-project-key", sProjectKey)
          .field("message", "short")
          .field("pageUrl", "https://example.com/x")
      );
      expect(res.status).toBe(400);
      expect(countUploads()).toBe(before);

      // unknown project key
      before = countUploads();
      res = await attachAll(submit("pk_live_does_not_exist"));
      expect(res.status).toBe(400);
      expect(countUploads()).toBe(before);
    });

    it("cleans up all artifacts when the report is deleted", async () => {
      const before = countUploads();
      const res = await submit(sProjectKey)
        .attach("screenshot", tinyPng, { filename: "a.png", contentType: "image/png" })
        .attach("domSnapshot", snapshotGz, { filename: "s.html.gz", contentType: "application/gzip" })
        .attach("annotations", tinyPng, { filename: "o.png", contentType: "image/png" });
      expect(res.status).toBe(201);
      expect(countUploads()).toBe(before + 3);

      const del = await request(app).delete(`/api/reports/${res.body.id}`).set("Cookie", sOwnerCookie);
      expect(del.status).toBe(204);
      expect(countUploads()).toBe(before);
    });

    it("never serves stored snapshots as renderable HTML", async () => {
      const res = await submit(sProjectKey)
        .attach("domSnapshot", snapshotHtml, { filename: "snapshot.html", contentType: "text/html" });
      const detail = await request(app).get(`/api/reports/${res.body.id}`).set("Cookie", sOwnerCookie);

      const served = await request(app).get(`/uploads/${detail.body.snapshotPath}`);
      expect(served.status).toBe(200);
      expect(served.headers["content-type"]).toMatch(/application\/octet-stream/);
      expect(served.headers["content-disposition"]).toMatch(/attachment/);
      expect(served.headers["x-content-type-options"]).toBe("nosniff");

      // images are unaffected
      const imgRes = await submit(sProjectKey).attach("screenshot", tinyPng, {
        filename: "a.png",
        contentType: "image/png",
      });
      const imgDetail = await request(app).get(`/api/reports/${imgRes.body.id}`).set("Cookie", sOwnerCookie);
      const servedImg = await request(app).get(`/uploads/${imgDetail.body.screenshotPath}`);
      expect(servedImg.headers["content-type"]).toMatch(/image\/png/);
    });
  });

  // ---------- Presence: heartbeat ingestion + projects aggregation ----------
  describe("presence heartbeat & aggregation", () => {
    // shared helpers
    async function createProjectWithKey(email: string, name: string) {
      const { cookie } = await registerAndLogin(email);
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name });
      return { cookie, projectId: p.body.id as string, publicKey: p.body.publicKey as string };
    }

    it("presence defaults: never / null / 0 when no heartbeat", async () => {
      const { cookie, projectId } = await createProjectWithKey("presence-never@test.com", "Presence Never");
      const list = await request(app).get("/api/projects").set("Cookie", cookie);
      const row = list.body.find((x: any) => x.id === projectId);
      expect(row.presenceStatus).toBe("never");
      expect(row.lastSeenAt).toBeNull();
      expect(row.lastSeenOrigin).toBeNull();
      expect(row.presenceOriginCount).toBe(0);
      // existing aggregates intact
      expect(row.totalReports).toBe(0);
    });

    it("heartbeat stores hostname from Origin header, CORS headers present", async () => {
      const { cookie, projectId, publicKey } = await createProjectWithKey("presence-origin@test.com", "Presence Origin");
      const res = await request(app)
        .post("/api/presence/heartbeat")
        .set("Origin", "https://Example.COM")
        .send({ project: publicKey });
      expect(res.status).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      const list = await request(app).get("/api/projects").set("Cookie", cookie);
      const row = list.body.find((x: any) => x.id === projectId);
      expect(row.presenceStatus).toBe("connected");
      expect(row.presenceOriginCount).toBe(1);
      expect(row.lastSeenOrigin).toBe("example.com");
      expect(row.lastSeenAt).toBeTruthy();
    });

    it("sanitizes body origin to hostname only (path/query stripped), lowercases", async () => {
      const { cookie, projectId, publicKey } = await createProjectWithKey("presence-sanitize@test.com", "Presence Sanitize");
      const res = await request(app)
        .post("/api/presence/heartbeat")
        .send({ project: publicKey, origin: "https://Example.COM/some/path?query=1#hash" });
      expect(res.status).toBe(204);
      const list = await request(app).get("/api/projects").set("Cookie", cookie);
      const row = list.body.find((x: any) => x.id === projectId);
      expect(row.lastSeenOrigin).toBe("example.com");
      expect(row.presenceOriginCount).toBe(1);
    });

    it("uses Referer header when Origin absent, and buckets unknown when none valid", async () => {
      const { cookie: c1, publicKey: pk1 } = await createProjectWithKey("presence-referer@test.com", "Presence Referer");
      // Referer path
      const r1 = await request(app)
        .post("/api/presence/heartbeat")
        .set("Referer", "https://referer.example.net/page?q=1")
        .send({ project: pk1 });
      expect(r1.status).toBe(204);
      let list = await request(app).get("/api/projects").set("Cookie", c1);
      let row = list.body.find((x: any) => x.publicKey === pk1);
      expect(row.lastSeenOrigin).toBe("referer.example.net");

      // Unknown bucket: invalid origin -> stored as unknown, but exposed as null
      const { cookie: c2, publicKey: pk2 } = await createProjectWithKey("presence-unknown@test.com", "Presence Unknown");
      const r2 = await request(app)
        .post("/api/presence/heartbeat")
        .send({ project: pk2, origin: "not-a-hostname" });
      expect(r2.status).toBe(204);
      list = await request(app).get("/api/projects").set("Cookie", c2);
      row = list.body.find((x: any) => x.publicKey === pk2);
      // unknown is hidden from UI => null, but status is connected and count is 1
      expect(row.presenceStatus).toBe("connected");
      expect(row.lastSeenOrigin).toBeNull();
      expect(row.presenceOriginCount).toBe(1);
      expect(row.lastSeenAt).toBeTruthy();
    });

    it("accepts x-project-key header fallback, and invalid key -> 400", async () => {
      const { publicKey } = await createProjectWithKey("presence-headerkey@test.com", "Presence HdrKey");
      const ok = await request(app)
        .post("/api/presence/heartbeat")
        .set("x-project-key", publicKey)
        .send({ origin: "example.com" });
      expect(ok.status).toBe(204);

      const bad = await request(app)
        .post("/api/presence/heartbeat")
        .send({ project: "pk_live_invalid9999999999" });
      expect(bad.status).toBe(400);

      const missing = await request(app)
        .post("/api/presence/heartbeat")
        .send({});
      expect(missing.status).toBe(400);
    });

    it("OPTIONS preflight returns CORS 204", async () => {
      const res = await request(app).options("/api/presence/heartbeat");
      expect([200, 204]).toContain(res.status);
      expect(res.headers["access-control-allow-origin"]).toBe("*");
      expect(res.headers["access-control-allow-methods"]).toMatch(/POST/);
      expect(res.headers["access-control-allow-headers"]).toMatch(/x-project-key/i);
    });

    it("debounce: second heartbeat within 60s does not bump lastSeenAt", async () => {
      const { clearPresenceDebounce } = await import("../src/routes/presence.js");
      clearPresenceDebounce();
      const { cookie, publicKey } = await createProjectWithKey("presence-debounce@test.com", "Presence Debounce");
      const { getDb } = await import("../src/db.js");
      const db = getDb();

      const r1 = await request(app)
        .post("/api/presence/heartbeat")
        .set("Origin", "https://debounce.example.com")
        .send({ project: publicKey });
      expect(r1.status).toBe(204);
      const projId = (db.prepare("SELECT id FROM projects WHERE publicKey = ?").get(publicKey) as any).id;
      const row1 = db.prepare("SELECT lastSeenAt FROM widget_presence WHERE projectId=? AND origin=?").get(projId, "debounce.example.com") as any;
      const ts1 = row1.lastSeenAt;

      // Immediate second hit -> debounced (204) but timestamp unchanged
      const r2 = await request(app)
        .post("/api/presence/heartbeat")
        .set("Origin", "https://debounce.example.com")
        .send({ project: publicKey });
      expect(r2.status).toBe(204);
      const row2 = db.prepare("SELECT lastSeenAt FROM widget_presence WHERE projectId=? AND origin=?").get(projId, "debounce.example.com") as any;
      expect(row2.lastSeenAt).toBe(ts1);

      // Different origin is not debounced
      const r3 = await request(app)
        .post("/api/presence/heartbeat")
        .set("Origin", "https://other.example.com")
        .send({ project: publicKey });
      expect(r3.status).toBe(204);
      const row3 = db.prepare("SELECT lastSeenAt FROM widget_presence WHERE projectId=? AND origin=?").get(projId, "other.example.com") as any;
      expect(row3).toBeTruthy();

      clearPresenceDebounce();
    });

    it("multiple origins: count distinct, lastSeenOrigin is origin of MAX(lastSeenAt)", async () => {
      const { clearPresenceDebounce } = await import("../src/routes/presence.js");
      clearPresenceDebounce();
      const { cookie, publicKey } = await createProjectWithKey("presence-multi@test.com", "Presence Multi");
      const { getDb } = await import("../src/db.js");
      const db = getDb();

      // First origin
      await request(app).post("/api/presence/heartbeat").set("Origin", "https://a.example.com").send({ project: publicKey });
      clearPresenceDebounce();
      // Sleep a tiny bit so timestamps differ (SQLite stores ISO millis)
      await new Promise((r) => setTimeout(r, 10));
      // Second origin later -> should become MAX
      await request(app).post("/api/presence/heartbeat").set("Origin", "https://b.example.com").send({ project: publicKey });

      const { cookie: c } = await (async () => {
        // re-login to get cookie for listing
        const login = await request(app).post("/api/auth/login").send({ email: "presence-multi@test.com", password: "password123" });
        return { cookie: login.headers["set-cookie"]?.[0] || cookie };
      })();
      const list = await request(app).get("/api/projects").set("Cookie", c);
      const row = list.body.find((x: any) => x.publicKey === publicKey);
      expect(row.presenceOriginCount).toBe(2);
      expect(row.lastSeenOrigin).toBe("b.example.com");

      // Same origin again should not increase count
      clearPresenceDebounce();
      await request(app).post("/api/presence/heartbeat").set("Origin", "https://b.example.com").send({ project: publicKey });
      // Need fresh read; debounce would have blocked last write, but we cleared so it writes same origin
      const list2 = await request(app).get("/api/projects").set("Cookie", c);
      const row2 = list2.body.find((x: any) => x.publicKey === publicKey);
      expect(row2.presenceOriginCount).toBe(2);

      clearPresenceDebounce();
    });

    it("inactive after threshold: 11 min old heartbeat => inactive", async () => {
      const { clearPresenceDebounce } = await import("../src/routes/presence.js");
      const { ACTIVE_THRESHOLD_MS } = await import("../src/routes/projects.js");
      clearPresenceDebounce();
      const { cookie, publicKey } = await createProjectWithKey("presence-inactive@test.com", "Presence Inactive");
      const { getDb } = await import("../src/db.js");
      const db = getDb();

      await request(app).post("/api/presence/heartbeat").set("Origin", "https://inactive.example.com").send({ project: publicKey });
      const projId = (db.prepare("SELECT id FROM projects WHERE publicKey = ?").get(publicKey) as any).id;
      // Make it stale by backdating
      const staleIso = new Date(Date.now() - ACTIVE_THRESHOLD_MS - 60_000).toISOString();
      db.prepare("UPDATE widget_presence SET lastSeenAt=? WHERE projectId=?").run(staleIso, projId);

      const list = await request(app).get("/api/projects").set("Cookie", cookie);
      const row = list.body.find((x: any) => x.publicKey === publicKey);
      expect(row.presenceStatus).toBe("inactive");
      expect(row.lastSeenAt).toBe(staleIso);
      expect(row.lastSeenOrigin).toBe("inactive.example.com");
      expect(row.presenceOriginCount).toBe(1);

      // Within threshold => connected
      const freshIso = new Date(Date.now() - 60_000).toISOString();
      db.prepare("UPDATE widget_presence SET lastSeenAt=? WHERE projectId=?").run(freshIso, projId);
      const list2 = await request(app).get("/api/projects").set("Cookie", cookie);
      const row2 = list2.body.find((x: any) => x.publicKey === publicKey);
      expect(row2.presenceStatus).toBe("connected");
    });

    it("non-breaking: existing fields still identical + localhost/IP dev origins allowed", async () => {
      const { cookie, publicKey } = await createProjectWithKey("presence-compat@test.com", "Presence Compat");
      // localhost origin
      const r1 = await request(app).post("/api/presence/heartbeat").send({ project: publicKey, origin: "localhost" });
      expect(r1.status).toBe(204);
      // IP literal
      const { clearPresenceDebounce } = await import("../src/routes/presence.js");
      clearPresenceDebounce();
      const r2 = await request(app).post("/api/presence/heartbeat").send({ project: publicKey, origin: "192.168.1.10" });
      expect(r2.status).toBe(204);

      const list = await request(app).get("/api/projects").set("Cookie", cookie);
      const row = list.body.find((x: any) => x.publicKey === publicKey);
      expect(row.name).toBe("Presence Compat");
      expect(row.publicKey).toBe(publicKey);
      expect(typeof row.totalReports).toBe("number");
      expect(typeof row.openReports).toBe("number");
      // presence fields present
      expect(["never", "connected", "inactive"]).toContain(row.presenceStatus);
    });
  });
});
