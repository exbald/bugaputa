import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import request from "supertest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createApp } from "../src/app.js";
import { closeDb } from "../src/db.js";
import { clearRateLimit } from "../src/lib/rateLimit.js";

function makeWebmBuffer(opts?: { durationMs?: number }): Buffer {
  // Minimal synthetic EBML-like buffer: EBML header + Duration element
  // EBML: 0x1A 0x45 0xDF 0xA3 + dummy
  const header = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]);
  if (opts?.durationMs === undefined) {
    // No duration element — unparsable, should store NULL
    return Buffer.concat([header, Buffer.alloc(100, 0x00)]);
  }
  const durationSec = opts.durationMs / 1000;
  // Duration element: 0x44 0x89 + vint size + float64
  const vint = Buffer.from([0x88]); // size 8, marker 1xxx
  const durBuf = Buffer.alloc(8);
  durBuf.writeDoubleBE(durationSec, 0);
  const durEl = Buffer.concat([Buffer.from([0x44, 0x89]), vint, durBuf]);
  // TimecodeScale default; no explicit element -> 1_000_000
  return Buffer.concat([header, durEl, Buffer.alloc(200, 0x00)]);
}

function makeMp4Buffer(opts?: { durationMs?: number }): Buffer {
  // Minimal MP4: ftyp + mvhd
  // ftyp box: size 20 (4) + 'ftyp' (4) + brand 'isom' (4) + ver 0 (4) + compat 'isom' (4)
  const ftyp = Buffer.alloc(20);
  ftyp.writeUInt32BE(20, 0);
  ftyp.write("ftyp", 4);
  ftyp.write("isom", 8);
  ftyp.writeUInt32BE(0, 12);
  ftyp.write("isom", 16);
  if (opts?.durationMs === undefined) {
    return Buffer.concat([ftyp, Buffer.alloc(100, 0x00)]);
  }
  // mvhd box: size (4) + 'mvhd' (4) + version 0 (1) + flags 0 (3) + creation 0 (4) + modification 0 (4) + timescale 1000 (4) + duration (4)
  const mvhd = Buffer.alloc(4 + 4 + 1 + 3 + 4 + 4 + 4 + 4);
  let off = 0;
  mvhd.writeUInt32BE(mvhd.length, off); off += 4;
  mvhd.write("mvhd", off); off += 4;
  mvhd.writeUInt8(0, off); off += 1;
  mvhd.writeUIntBE(0, off, 3); off += 3;
  mvhd.writeUInt32BE(0, off); off += 4;
  mvhd.writeUInt32BE(0, off); off += 4;
  const timescale = 1000;
  mvhd.writeUInt32BE(timescale, off); off += 4;
  const duration = Math.round((opts.durationMs / 1000) * timescale);
  mvhd.writeUInt32BE(duration, off);
  return Buffer.concat([ftyp, mvhd, Buffer.alloc(50, 0x00)]);
}

describe("video backend foundation", () => {
  let app: ReturnType<typeof createApp>;
  let tmpDir: string;
  let dbPath: string;
  let uploadDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bugaputa-video-"));
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

  async function registerAndLogin(email: string, password = "password123") {
    const reg = await request(app).post("/api/auth/register").send({ email, password });
    expect(reg.status).toBe(201);
    const login = await request(app).post("/api/auth/login").send({ email, password });
    const cookie = login.headers["set-cookie"]?.[0] || reg.headers["set-cookie"]?.[0] || "";
    return { cookie };
  }

  function countUploadFiles(): number {
    if (!fs.existsSync(uploadDir)) return 0;
    return fs.readdirSync(uploadDir).length;
  }

  describe("migration", () => {
    it("has nullable video columns and project flag", async () => {
      const { getDb } = await import("../src/db.js");
      const db = getDb();
      const reportCols = (db.prepare("PRAGMA table_info(reports)").all() as any[]).map((c: any) => c.name);
      expect(reportCols).toEqual(expect.arrayContaining(["videoPath", "videoMime", "videoDurationMs", "videoSizeBytes"]));
      const projCols = (db.prepare("PRAGMA table_info(projects)").all() as any[]).map((c: any) => c.name);
      expect(projCols).toContain("videoCaptureEnabled");
      // Re-init is idempotent — call initDb again on same path should not throw
      const { initDb } = await import("../src/db.js");
      expect(() => initDb(dbPath)).not.toThrow();
    });
  });

  describe("video upload", () => {
    let projectKey: string;
    let ownerCookie: string;
    let projectId: string;

    beforeAll(async () => {
      const { cookie } = await registerAndLogin("video-owner@test.com");
      ownerCookie = cookie;
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Video Project" });
      expect(p.status).toBe(201);
      projectKey = p.body.publicKey;
      projectId = p.body.id;
    });

    it("accepts video/webm with valid EBML magic", async () => {
      const webm = makeWebmBuffer({ durationMs: 5000 });
      const before = countUploadFiles();
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with video capture enough length here")
        .field("pageUrl", "https://example.com/video")
        .attach("video", webm, { filename: "capture.webm", contentType: "video/webm" });
      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      // Random filename, correct ext
      const detail = await request(app).get(`/api/reports/${res.body.id}`).set("Cookie", ownerCookie);
      expect(detail.status).toBe(200);
      expect(detail.body.videoPath).toMatch(/\.webm$/);
      expect(detail.body.videoMime).toBe("video/webm");
      expect(detail.body.videoDurationMs).toBe(5000);
      expect(detail.body.videoSizeBytes).toBeGreaterThan(0);
      expect(countUploadFiles()).toBe(before + 1);
      // Cleanup via delete
      const del = await request(app).delete(`/api/reports/${res.body.id}`).set("Cookie", ownerCookie);
      expect(del.status).toBe(204);
      expect(countUploadFiles()).toBe(before);
    });

    it("accepts video/mp4 with valid ftyp magic", async () => {
      const mp4 = makeMp4Buffer({ durationMs: 8000 });
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with mp4 video capture enough length")
        .field("pageUrl", "https://example.com/video")
        .attach("video", mp4, { filename: "capture.mp4", contentType: "video/mp4" });
      expect(res.status).toBe(201);
      const detail = await request(app).get(`/api/reports/${res.body.id}`).set("Cookie", ownerCookie);
      expect(detail.body.videoPath).toMatch(/\.mp4$/);
      expect(detail.body.videoMime).toBe("video/mp4");
      expect(detail.body.videoDurationMs).toBe(8000);
      await request(app).delete(`/api/reports/${res.body.id}`).set("Cookie", ownerCookie);
    });

    it("accepts codec-suffixed mime video/webm;codecs=vp9,opus maps to .webm and base mime", async () => {
      const webm = makeWebmBuffer({ durationMs: 2000 });
      // supertest maps contentType string with semicolon as base+charset; instead send as video/webm
      // and verify the server normalizes base mime — we test the base mapping via .webm ext and mime normalization
      // by checking that the upload with standard mime creates .webm and stores video/webm.
      // Direct codec-suffixed mime via raw request is tested via baseMime helper: verify it normalizes.
      const { baseMime } = await import("../src/lib/video.js");
      expect(baseMime("video/webm;codecs=vp9,opus")).toBe("video/webm");
      expect(baseMime("video/mp4;codecs=h264,aac")).toBe("video/mp4");
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with codec suffix video enough length")
        .field("pageUrl", "https://example.com/video")
        .attach("video", webm, { filename: "capture.webm", contentType: "video/webm" });
      expect(res.status).toBe(201);
      const detail = await request(app).get(`/api/reports/${res.body.id}`).set("Cookie", ownerCookie);
      expect(detail.body.videoMime).toBe("video/webm");
      expect(detail.body.videoPath).toMatch(/\.webm$/);
      await request(app).delete(`/api/reports/${res.body.id}`).set("Cookie", ownerCookie);
    });

    it("stores NULL duration when header unparsable (manual fallback bounded by bytes)", async () => {
      const webmNoDur = makeWebmBuffer(); // no duration element
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with unparsable duration enough length")
        .field("pageUrl", "https://example.com/video")
        .attach("video", webmNoDur, { filename: "capture.webm", contentType: "video/webm" });
      expect(res.status).toBe(201);
      const detail = await request(app).get(`/api/reports/${res.body.id}`).set("Cookie", ownerCookie);
      expect(detail.body.videoDurationMs).toBeNull();
      await request(app).delete(`/api/reports/${res.body.id}`).set("Cookie", ownerCookie);
    });

    it("rejects video >61s when duration parse succeeds", async () => {
      const longWebm = makeWebmBuffer({ durationMs: 62_000 });
      const before = countUploadFiles();
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with long video enough length here")
        .field("pageUrl", "https://example.com/video")
        .attach("video", longWebm, { filename: "capture.webm", contentType: "video/webm" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/too long/i);
      expect(countUploadFiles()).toBe(before);
    });

    it("rejects magic spoof: claimed video/webm with PNG bytes", async () => {
      const png = Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
        "hex"
      );
      const before = countUploadFiles();
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with spoofed video enough length here")
        .field("pageUrl", "https://example.com/video")
        .attach("video", png, { filename: "spoof.webm", contentType: "video/webm" });
      expect(res.status).toBe(400);
      expect(countUploadFiles()).toBe(before);
    });

    it("rejects disallowed mime text/plain as video", async () => {
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with bad mime video enough length")
        .field("pageUrl", "https://example.com/video")
        .attach("video", Buffer.from("hello"), { filename: "evil.txt", contentType: "text/plain" as any });
      expect(res.status).toBe(400);
    });

    it("rejects oversize video >25MB via handler (small allocation for test)", async () => {
      // Use multer global limit path: >25MB should be 400 File too large from multer
      const big = Buffer.alloc(25 * 1024 * 1024 + 1, 0x00);
      // Patch header to be valid webm so it passes magic, but size triggers first
      big[0] = 0x1a; big[1] = 0x45; big[2] = 0xdf; big[3] = 0xa3;
      const before = countUploadFiles();
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with oversize video enough length here")
        .field("pageUrl", "https://example.com/video")
        .attach("video", big, { filename: "big.webm", contentType: "video/webm" });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/too large/i);
      expect(countUploadFiles()).toBe(before);
    });

    it("rejects unexpected file field without leaking", async () => {
      const webm = makeWebmBuffer({ durationMs: 1000 });
      const before = countUploadFiles();
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with evil field enough length here")
        .field("pageUrl", "https://example.com/video")
        .attach("evil", webm, { filename: "evil.webm", contentType: "video/webm" });
      expect(res.status).toBe(400);
      expect(countUploadFiles()).toBe(before);
    });

    it("cleans up video on honeypot, bad key, validation failure", async () => {
      const webm = makeWebmBuffer({ durationMs: 1000 });
      // honeypot
      let before = countUploadFiles();
      let res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with honeypot video enough length")
        .field("pageUrl", "https://example.com/video")
        .field("website", "http://spam.example")
        .attach("video", webm, { filename: "capture.webm", contentType: "video/webm" });
      expect(res.status).toBe(201);
      expect(countUploadFiles()).toBe(before);

      // bad key
      before = countUploadFiles();
      res = await request(app)
        .post("/api/reports")
        .field("message", "Bug with bad key video enough length here")
        .field("pageUrl", "https://example.com/video")
        .field("projectKey", "pk_live_invalid999999")
        .attach("video", webm, { filename: "capture.webm", contentType: "video/webm" });
      expect(res.status).toBe(400);
      expect(countUploadFiles()).toBe(before);

      // validation failure short message
      before = countUploadFiles();
      res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "short")
        .field("pageUrl", "https://example.com/video")
        .attach("video", webm, { filename: "capture.webm", contentType: "video/webm" });
      expect(res.status).toBe(400);
      expect(countUploadFiles()).toBe(before);
    });

    it("allows video combined with screenshot and snapshot", async () => {
      const webm = makeWebmBuffer({ durationMs: 1000 });
      const png = Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
        "hex"
      );
      const html = Buffer.from("<html><body>snapshot</body></html>");
      const res = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Bug with all artifacts video enough length")
        .field("pageUrl", "https://example.com/video")
        .attach("screenshot", png, { filename: "a.png", contentType: "image/png" })
        .attach("domSnapshot", html, { filename: "s.html", contentType: "text/html" })
        .attach("video", webm, { filename: "c.webm", contentType: "video/webm" });
      expect(res.status).toBe(201);
      const detail = await request(app).get(`/api/reports/${res.body.id}`).set("Cookie", ownerCookie);
      expect(detail.body.screenshotPath).toBeTruthy();
      expect(detail.body.snapshotPath).toBeTruthy();
      expect(detail.body.videoPath).toBeTruthy();
      await request(app).delete(`/api/reports/${res.body.id}`).set("Cookie", ownerCookie);
    });

    it("video namespace rate limit 5/min does not starve text reports", async () => {
      // Isolated project + IP for this test
      const { cookie } = await registerAndLogin("video-ratelimit@test.com");
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Video RateLimit" });
      const pk = p.body.publicKey;
      const testIp = "198.51.100.77";
      const webm = makeWebmBuffer({ durationMs: 1000 });
      for (let i = 0; i < 5; i++) {
        const r = await request(app)
          .post("/api/reports")
          .set("x-forwarded-for", testIp)
          .set("x-project-key", pk)
          .field("message", `Video rate fill ${i} enough length for test`)
          .field("pageUrl", "https://example.com/video")
          .attach("video", webm, { filename: "c.webm", contentType: "video/webm" });
        expect(r.status).toBe(201);
      }
      const before = countUploadFiles();
      const limited = await request(app)
        .post("/api/reports")
        .set("x-forwarded-for", testIp)
        .set("x-project-key", pk)
        .field("message", "Video rate limited enough length here now")
        .field("pageUrl", "https://example.com/video")
        .attach("video", webm, { filename: "c.webm", contentType: "video/webm" });
      expect(limited.status).toBe(429);
      expect(limited.headers["retry-after"]).toBeDefined();
      expect(countUploadFiles()).toBe(before);

      // Text report on same IP/project should still succeed (separate namespace)
      const textOk = await request(app)
        .post("/api/reports")
        .set("x-forwarded-for", testIp)
        .send({ projectKey: pk, message: "Text report after video rate limit enough length", pageUrl: "https://example.com/page" });
      expect(textOk.status).toBe(201);
    });

    it("quota 1GiB enforcement via real file size", async () => {
      const { cookie } = await registerAndLogin("video-quota@test.com");
      const p = await request(app).post("/api/projects").set("Cookie", cookie).send({ name: "Video Quota" });
      const pk = p.body.publicKey;
      const projectIdQuota = p.body.id;
      // Use isolated IP so rate limiter doesn't interfere
      const quotaIp = "203.0.113.88";
      // Seed a large usage directly in DB to simulate near-quota without allocating 1GB
      const { getDb } = await import("../src/db.js");
      const db = getDb();
      const seed = await request(app)
        .post("/api/reports")
        .set("x-forwarded-for", quotaIp)
        .set("x-project-key", pk)
        .field("message", "Seed report for quota test enough length")
        .field("pageUrl", "https://example.com/video")
        .attach("video", makeWebmBuffer({ durationMs: 1000 }), { filename: "c.webm", contentType: "video/webm" });
      expect(seed.status).toBe(201);
      // Bump its size to near quota
      db.prepare("UPDATE reports SET videoSizeBytes = ? WHERE id = ?").run(1024 * 1024 * 1024, seed.body.id);
      const before = countUploadFiles();
      const over = await request(app)
        .post("/api/reports")
        .set("x-forwarded-for", quotaIp)
        .set("x-project-key", pk)
        .field("message", "Quota exceeded video enough length here now")
        .field("pageUrl", "https://example.com/video")
        .attach("video", makeWebmBuffer({ durationMs: 1000 }), { filename: "c.webm", contentType: "video/webm" });
      expect(over.status).toBe(413);
      expect(over.body.error).toMatch(/quota/i);
      expect(countUploadFiles()).toBe(before);
      // Cleanup: remove seeded report to not pollute other tests (uses owner cookie)
      await request(app).delete(`/api/reports/${seed.body.id}`).set("Cookie", cookie);
      // Also directly clear any remaining large quota state
      db.prepare("DELETE FROM reports WHERE projectId = ?").run(projectIdQuota);
    });
  });

  describe("authenticated video serving", () => {
    let projectKey: string;
    let ownerCookie: string;
    let otherCookie: string;
    let reportId: string;
    let videoFilename: string;
    const webm = makeWebmBuffer({ durationMs: 3000 });

    beforeAll(async () => {
      const owner = await registerAndLogin("video-serve-owner@test.com");
      ownerCookie = owner.cookie;
      const other = await registerAndLogin("video-serve-other@test.com");
      otherCookie = other.cookie;
      const p = await request(app).post("/api/projects").set("Cookie", ownerCookie).send({ name: "Video Serve" });
      projectKey = p.body.publicKey;
      const created = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Video serve test report enough length here")
        .field("pageUrl", "https://example.com/video")
        .attach("video", webm, { filename: "c.webm", contentType: "video/webm" });
      expect(created.status).toBe(201);
      reportId = created.body.id;
      const detail = await request(app).get(`/api/reports/${reportId}`).set("Cookie", ownerCookie);
      videoFilename = detail.body.videoPath;
    });

    afterAll(async () => {
      try { await request(app).delete(`/api/reports/${reportId}`).set("Cookie", ownerCookie); } catch {}
    });

    it("GET /api/reports/:id/video requires auth (401 without cookie)", async () => {
      const res = await request(app).get(`/api/reports/${reportId}/video`);
      expect(res.status).toBe(401);
    });

    it("non-owner gets 404 (not 403 leak)", async () => {
      const res = await request(app).get(`/api/reports/${reportId}/video`).set("Cookie", otherCookie);
      expect(res.status).toBe(404);
    });

    it("owner gets video with correct MIME, private caching, nosniff", async () => {
      const res = await request(app).get(`/api/reports/${reportId}/video`).set("Cookie", ownerCookie);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/video\/webm/);
      expect(res.headers["accept-ranges"]).toBe("bytes");
      expect(res.headers["cache-control"]).toMatch(/private/);
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("Range request returns 206 with Content-Range", async () => {
      const res = await request(app)
        .get(`/api/reports/${reportId}/video`)
        .set("Cookie", ownerCookie)
        .set("Range", "bytes=0-5");
      expect(res.status).toBe(206);
      expect(res.headers["content-range"]).toMatch(/^bytes 0-5\//);
      expect(res.headers["accept-ranges"]).toBe("bytes");
      expect(Number(res.headers["content-length"])).toBe(6);
    });

    it("invalid Range returns 416 with bytes */total", async () => {
      const res = await request(app)
        .get(`/api/reports/${reportId}/video`)
        .set("Cookie", ownerCookie)
        .set("Range", "bytes=999999-1000000");
      expect(res.status).toBe(416);
      expect(res.headers["content-range"]).toMatch(/^bytes \*\//);
    });

    it("download mode sets attachment disposition", async () => {
      const res = await request(app).get(`/api/reports/${reportId}/video?download=1`).set("Cookie", ownerCookie);
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toMatch(/attachment/);
    });

    it("video is NOT exposed via public /uploads/:filename", async () => {
      const publicRes = await request(app).get(`/uploads/${videoFilename}`);
      expect(publicRes.status).toBe(404);
      // Ensure screenshot path would remain public if it existed — not asserting here, but snapshot stays as attachment
    });

    it("legacy screenshot still public on /uploads/:filename", async () => {
      const png = Buffer.from(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
        "hex"
      );
      const created = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Screenshot still public test enough length")
        .field("pageUrl", "https://example.com/page")
        .attach("screenshot", png, { filename: "a.png", contentType: "image/png" });
      expect(created.status).toBe(201);
      const detail = await request(app).get(`/api/reports/${created.body.id}`).set("Cookie", ownerCookie);
      const served = await request(app).get(`/uploads/${detail.body.screenshotPath}`);
      expect(served.status).toBe(200);
      expect(served.headers["content-type"]).toMatch(/image\/png/);
      await request(app).delete(`/api/reports/${created.body.id}`).set("Cookie", ownerCookie);
    });

    it("snapshot still served as attachment not video", async () => {
      const html = Buffer.from("<html><body>hi</body></html>");
      const created = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Snapshot attachment test enough length here")
        .field("pageUrl", "https://example.com/page")
        .attach("domSnapshot", html, { filename: "s.html", contentType: "text/html" });
      expect(created.status).toBe(201);
      const detail = await request(app).get(`/api/reports/${created.body.id}`).set("Cookie", ownerCookie);
      const served = await request(app).get(`/uploads/${detail.body.snapshotPath}`);
      expect(served.headers["content-type"]).toMatch(/application\/octet-stream/);
      expect(served.headers["content-disposition"]).toMatch(/attachment/);
      await request(app).delete(`/api/reports/${created.body.id}`).set("Cookie", ownerCookie);
    });

    it("delete removes video file and future GET is 404", async () => {
      const created = await request(app)
        .post("/api/reports")
        .set("x-project-key", projectKey)
        .field("message", "Delete video file test enough length here")
        .field("pageUrl", "https://example.com/video")
        .attach("video", webm, { filename: "c.webm", contentType: "video/webm" });
      expect(created.status).toBe(201);
      const rid = created.body.id;
      const before = (() => { try { return fs.readdirSync(uploadDir).length; } catch { return 0; } })();
      const del = await request(app).delete(`/api/reports/${rid}`).set("Cookie", ownerCookie);
      expect(del.status).toBe(204);
      const after = (() => { try { return fs.readdirSync(uploadDir).length; } catch { return 0; } })();
      expect(after).toBe(before - 1);
      const get = await request(app).get(`/api/reports/${rid}/video`).set("Cookie", ownerCookie);
      expect(get.status).toBe(404);
    });
  });

  describe("CSP", () => {
    it("helmet CSP includes media-src with blob:", async () => {
      const res = await request(app).get("/health");
      const csp = res.headers["content-security-policy"] || "";
      expect(csp).toMatch(/media-src/);
      expect(csp).toMatch(/blob:/);
    });
  });
});
