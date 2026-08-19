import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import { CANONICAL_ORIGIN, LEGACY_ORIGIN } from "../src/lib/canonical.js";

/**
 * Canonical redirect regression tests — backend domain migration.
 * Covers www -> apex, legacy document redirect, compat allowlist, query
 * preservation, Accept/CORS invariants, and loop avoidance.
 */

let app: ReturnType<typeof createApp>;
let tmpDir: string;
let dbPath: string;
let uploadDir: string;

describe("canonical redirect", () => {
  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bugaputa-canonical-"));
    dbPath = path.join(tmpDir, "test.db");
    uploadDir = path.join(tmpDir, "uploads");
    process.env.JWT_SECRET = "test-secret-canonical";
    // Keep CANONICAL_ORIGIN at default https://bugaputa.com for assertions
    app = createApp({ dbPath, uploadDir });
  });

  afterAll(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  beforeEach(() => {});

  function hostReq(method: "get" | "post" | "put" | "patch" | "delete", path: string, host: string) {
    const r: any = (request(app) as any)[method](path);
    r.set("Host", host);
    return r;
  }

  // ---- www -> apex (any method, any path) ----
  it("www GET / -> 308 to apex preserving path", async () => {
    const res = await hostReq("get", "/", "www.bugaputa.com");
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(CANONICAL_ORIGIN + "/");
  });

  it("www GET with query preserved", async () => {
    const res = await hostReq("get", "/dashboard?foo=bar&baz=1", "www.bugaputa.com");
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(CANONICAL_ORIGIN + "/dashboard?foo=bar&baz=1");
  });

  it("www POST also redirects (any method)", async () => {
    const res = await hostReq("post", "/api/auth/login", "www.bugaputa.com").send({});
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(CANONICAL_ORIGIN + "/api/auth/login");
  });

  it("www via X-Forwarded-Host (Traefik) also redirects", async () => {
    const res = await request(app)
      .get("/some/page?x=1")
      .set("Host", "bugaputa.com")
      .set("X-Forwarded-Host", "www.bugaputa.com");
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(CANONICAL_ORIGIN + "/some/page?x=1");
  });

  it("www with port suffix still redirects", async () => {
    const res = await hostReq("get", "/", "www.bugaputa.com:443");
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(CANONICAL_ORIGIN + "/");
  });

  // ---- legacy document GET with text/html -> 308 ----
  it("legacy GET / with Accept text/html -> 308", async () => {
    const res = await hostReq("get", "/", "bugaputa.no-code.gdn").set("Accept", "text/html");
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(CANONICAL_ORIGIN + "/");
  });

  it("legacy GET with Accept text/html,application/xhtml+xml -> 308", async () => {
    const res = await hostReq("get", "/projects", "bugaputa.no-code.gdn").set(
      "Accept",
      "text/html,application/xhtml+xml"
    );
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(CANONICAL_ORIGIN + "/projects");
  });

  it("legacy GET with query preserved", async () => {
    const res = await hostReq("get", "/foo?bar=baz&x=1", "bugaputa.no-code.gdn").set(
      "Accept",
      "text/html"
    );
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(CANONICAL_ORIGIN + "/foo?bar=baz&x=1");
  });

  it("legacy via X-Forwarded-Host also redirects for document GET", async () => {
    const res = await request(app)
      .get("/hello")
      .set("Host", "bugaputa.com")
      .set("X-Forwarded-Host", "bugaputa.no-code.gdn")
      .set("Accept", "text/html");
    expect(res.status).toBe(308);
    expect(res.headers.location).toBe(CANONICAL_ORIGIN + "/hello");
  });

  // ---- legacy without text/html -> no redirect ----
  it("legacy GET without text/html Accept -> 200 (no redirect, api/health)", async () => {
    const res = await hostReq("get", "/api/health", "bugaputa.no-code.gdn");
    expect(res.status).toBe(200);
  });

  it("legacy GET Accept: application/json -> not redirected", async () => {
    const res = await hostReq("get", "/", "bugaputa.no-code.gdn").set("Accept", "application/json");
    // SPA fallback may 200 or 404 depending on dist presence; just assert not 308
    expect(res.status).not.toBe(308);
  });

  it("legacy GET with empty Accept -> not redirected", async () => {
    const res = await hostReq("get", "/", "bugaputa.no-code.gdn");
    expect(res.status).not.toBe(308);
  });

  // ---- compat allowlist: must NOT redirect even with text/html ----
  const allowlisted = [
    "/api/reports",
    "/api/widget-config?project=pk_live_xxx",
    "/widget.js",
    "/widget.css",
    "/modern-screenshot.min.js",
    "/html2canvas.min.js",
    "/health",
    "/api/health",
    "/uploads/some-file.png",
    "/uploads/abc.html",
  ];
  for (const p of allowlisted) {
    it(`legacy GET ${p} with Accept text/html -> not redirected (allowlist)`, async () => {
      const res = await hostReq("get", p, "bugaputa.no-code.gdn").set("Accept", "text/html");
      expect(res.status).not.toBe(308);
    });
  }

  // ---- legacy POST must not redirect even with text/html ----
  it("legacy POST /api/reports with text/html -> not redirected", async () => {
    const res = await hostReq("post", "/api/reports", "bugaputa.no-code.gdn")
      .set("Accept", "text/html")
      .send({});
    expect(res.status).not.toBe(308);
  });

  it("legacy POST / with text/html -> not redirected (non-GET)", async () => {
    const res = await hostReq("post", "/", "bugaputa.no-code.gdn").set("Accept", "text/html").send({});
    expect(res.status).not.toBe(308);
  });

  // ---- apex itself never redirects ----
  it("apex GET / with text/html -> not redirected", async () => {
    const res = await hostReq("get", "/", "bugaputa.com").set("Accept", "text/html");
    expect(res.status).not.toBe(308);
  });

  it("apex POST -> not redirected", async () => {
    const res = await hostReq("post", "/api/reports", "bugaputa.com").send({});
    expect(res.status).not.toBe(308);
  });

  it("no host header -> not redirected", async () => {
    const res = await request(app).get("/").set("Accept", "text/html");
    expect(res.status).not.toBe(308);
  });

  // ---- CSP dual-origin ----
  it("CSP header contains both canonical and legacy origins", async () => {
    const res = await hostReq("get", "/api/health", "bugaputa.com");
    const csp = res.headers["content-security-policy"] || "";
    expect(csp).toContain(CANONICAL_ORIGIN);
    expect(csp).toContain(LEGACY_ORIGIN);
  });

  // ---- widget/CORS invariants unaffected ----
  it("widget assets still carry ACAO * and CORP cross-origin (apex)", async () => {
    // Use a path that exists as compat; check headers
    // Our widget route may return 200 or placeholder; headers still set
    const res = await hostReq("get", "/widget.js", "bugaputa.com");
    // CORP header is set by middleware; for widget it should be cross-origin
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("widget assets on legacy still carry ACAO * (no redirect due allowlist)", async () => {
    const res = await hostReq("get", "/widget.js", "bugaputa.no-code.gdn").set(
      "Accept",
      "text/html"
    );
    expect(res.status).not.toBe(308);
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });

  it("public POST /api/reports still CORS allow-all (preflight)", async () => {
    const res = await request(app)
      .options("/api/reports")
      .set("Origin", "https://example.com")
      .set("Access-Control-Request-Method", "POST");
    // reports router handles OPTIONS with ACAO *
    expect(res.headers["access-control-allow-origin"]).toBe("*");
  });
});
