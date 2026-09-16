import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import { clearRateLimit } from "../src/lib/rateLimit.js";

describe("project videoCaptureEnabled flag + widget-config", () => {
  let app: ReturnType<typeof createApp>;
  let tmpDir: string;
  let dbPath: string;
  let uploadDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bugaputa-flag-"));
    dbPath = path.join(tmpDir, "test.db");
    uploadDir = path.join(tmpDir, "uploads");
    process.env.JWT_SECRET = "test-secret-flag";
    process.env.NODE_ENV = "test";
    app = createApp({ dbPath, uploadDir });
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => clearRateLimit());

  async function registerAndLogin(email: string) {
    const reg = await request(app).post("/api/auth/register").send({ email, password: "password123" });
    expect(reg.status).toBe(201);
    const login = await request(app).post("/api/auth/login").send({ email, password: "password123" });
    return { cookie: login.headers["set-cookie"]?.[0] || reg.headers["set-cookie"]?.[0] || "" };
  }

  it("GET /api/projects and GET /api/projects/:id return videoCaptureEnabled false by default", async () => {
    const { cookie } = await registerAndLogin("flag-default@test.com");
    const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Flag Default" });
    expect(p.status).toBe(201);
    expect(p.body.videoCaptureEnabled).toBe(false);
    const single = await request(app).get(`/api/projects/${p.body.id}`).set("Cookie", cookie);
    expect(single.status).toBe(200);
    expect(single.body.videoCaptureEnabled).toBe(false);
    const list = await request(app).get("/api/projects").set("Cookie", cookie);
    const row = list.body.find((x: any) => x.id === p.body.id);
    expect(row.videoCaptureEnabled).toBe(false);
    // old DB compat: re-init idempotent and still false
    const { initDb, getDb } = await import("../src/db.js");
    expect(() => initDb(dbPath)).not.toThrow();
    const db = getDb();
    const raw = db.prepare("SELECT videoCaptureEnabled FROM projects WHERE id = ?").get(p.body.id) as any;
    expect(raw.videoCaptureEnabled).toBe(0);
  });

  it("public GET /api/widget-config returns videoCaptureEnabled:false by default and true after opt-in", async () => {
    const { cookie } = await registerAndLogin("flag-widget@test.com");
    const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Flag Widget" });
    const pk = p.body.publicKey as string;
    const before = await request(app).get(`/api/widget-config?project=${encodeURIComponent(pk)}`);
    expect(before.status).toBe(200);
    expect(before.body.videoCaptureEnabled).toBe(false);
    expect(before.headers["access-control-allow-origin"]).toBe("*");
    // Existing label/color/position contract intact
    expect(before.body.label).toBeDefined();
    expect(before.body.color).toBeDefined();
    expect(before.body.position).toBeDefined();

    const patched = await request(app).patch(`/api/projects/${p.body.id}`).set("Cookie", cookie).send({ videoCaptureEnabled: true });
    expect(patched.status).toBe(200);
    expect(patched.body.videoCaptureEnabled).toBe(true);
    // label/color still returned
    expect(patched.body.widget_label).toBeDefined();

    const after = await request(app).get(`/api/widget-config?project=${encodeURIComponent(pk)}`);
    expect(after.status).toBe(200);
    expect(after.body.videoCaptureEnabled).toBe(true);
  });

  it("unknown project key returns videoCaptureEnabled:false (not 404)", async () => {
    const res = await request(app).get("/api/widget-config?project=pk_live_doesnotexist123");
    expect(res.status).toBe(200);
    expect(res.body.videoCaptureEnabled).toBe(false);
  });

  it("PATCH /api/projects/:id with videoCaptureEnabled — owner success, other user 403, invalid type 400, unknown field 400", async () => {
    const { cookie: c1 } = await registerAndLogin("flag-owner@test.com");
    const { cookie: c2 } = await registerAndLogin("flag-other@test.com");
    const p = await request(app).post("/api/projects").set("Cookie", c1).send({ name: "Flag Patch" });
    const id = p.body.id as string;

    // invalid type: string instead of boolean -> 400
    const badType = await request(app).patch(`/api/projects/${id}`).set("Cookie", c1).send({ videoCaptureEnabled: "true" as any });
    expect(badType.status).toBe(400);

    // unknown field with strict schema -> 400 (do not silently strip)
    const unknown = await request(app).patch(`/api/projects/${id}`).set("Cookie", c1).send({ videoCaptureEnabled: true, evil: 1 } as any);
    expect(unknown.status).toBe(400);

    // empty body -> 400
    const empty = await request(app).patch(`/api/projects/${id}`).set("Cookie", c1).send({});
    expect(empty.status).toBe(400);

    // 404 case must not leak existence: check before authZ would be 403
    const noAuth = await request(app).patch(`/api/projects/${id}`);
    expect(noAuth.status).toBe(401);

    // other user forbidden without leaking data
    const forbidden = await request(app).patch(`/api/projects/${id}`).set("Cookie", c2).send({ videoCaptureEnabled: true });
    expect(forbidden.status).toBe(403);

    // owner can set true then false
    const okTrue = await request(app).patch(`/api/projects/${id}`).set("Cookie", c1).send({ videoCaptureEnabled: true });
    expect(okTrue.status).toBe(200);
    expect(okTrue.body.videoCaptureEnabled).toBe(true);
    const okFalse = await request(app).patch(`/api/projects/${id}`).set("Cookie", c1).send({ videoCaptureEnabled: false });
    expect(okFalse.status).toBe(200);
    expect(okFalse.body.videoCaptureEnabled).toBe(false);
    // widget-config reflects false again
    const wc = await request(app).get(`/api/widget-config?project=${encodeURIComponent(p.body.publicKey)}`);
    expect(wc.body.videoCaptureEnabled).toBe(false);

    // nonexistent project -> 404
    const missing = await request(app).patch("/api/projects/does-not-exist").set("Cookie", c1).send({ videoCaptureEnabled: true });
    expect(missing.status).toBe(404);

    // combo patch: widget_label + videoCaptureEnabled together works
    const combo = await request(app).patch(`/api/projects/${id}`).set("Cookie", c1).send({ widget_label: "Help", videoCaptureEnabled: true });
    expect(combo.status).toBe(200);
    expect(combo.body.widget_label).toBe("Help");
    expect(combo.body.videoCaptureEnabled).toBe(true);
  });

  it("widget-settings alias stays working and does not accept videoCaptureEnabled", async () => {
    // Back-compat: PATCH /:id/widget-settings must keep existing behavior and not regress
    const { cookie } = await registerAndLogin("flag-alias@test.com");
    const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Flag Alias" });
    const ok = await request(app).patch(`/api/projects/${p.body.id}/widget-settings`).set("Cookie", cookie).send({ widget_label: "Foo" });
    expect(ok.status).toBe(200);
    expect(ok.body.widget_label).toBe("Foo");
    // widget-settings schema does not know videoCaptureEnabled; extra field stripped/ignored or rejected but must not corrupt
    // Our widgetSettingsSchema is not strict, so it will be stripped — verify it does not toggle the flag
    const withVideo = await request(app).patch(`/api/projects/${p.body.id}/widget-settings`).set("Cookie", cookie).send({ widget_label: "Bar", videoCaptureEnabled: true } as any);
    // either 200 stripping the field, or 400 — but flag must remain false
    expect([200, 400]).toContain(withVideo.status);
    const check = await request(app).get(`/api/projects/${p.body.id}`).set("Cookie", cookie);
    expect(check.body.videoCaptureEnabled).toBe(false);
  });

  it("CORS and ownership not regressed: project list still filtered by owner, CORS on widget-config", async () => {
    const { cookie: c1 } = await registerAndLogin("flag-cors1@test.com");
    const { cookie: c2 } = await registerAndLogin("flag-cors2@test.com");
    const p1 = await request(app).post("/api/projects").set("Cookie", c1).send({ name: "Cors Owner" });
    await request(app).patch(`/api/projects/${p1.body.id}`).set("Cookie", c1).send({ videoCaptureEnabled: true });
    const list2 = await request(app).get("/api/projects").set("Cookie", c2);
    expect(list2.body.find((x: any) => x.id === p1.body.id)).toBeUndefined();
    // widget-config CORS still *
    const wc = await request(app).get(`/api/widget-config?project=${encodeURIComponent(p1.body.publicKey)}`);
    expect(wc.headers["access-control-allow-origin"]).toBe("*");
    expect(wc.body.videoCaptureEnabled).toBe(true);
  });
});
