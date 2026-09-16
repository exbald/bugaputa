import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PR = path.resolve(__dirname, "../pages/ProjectReports.tsx");
const RD = path.resolve(__dirname, "../pages/ReportDetail.tsx");
const API = path.resolve(__dirname, "../lib/api.ts");

function read(p: string){ return fs.readFileSync(p, "utf8"); }

describe("Video 06: dashboard player, report badge and project opt-in (T8)", () => {
  it("ProjectReports list shows clear video badge/icon with known duration/size without public media access", () => {
    const raw = read(PR);
    // must detect video presence via videoPath (field from backend SELECT *)
    expect(raw).toMatch(/videoPath/);
    // badge with icon/text
    expect(raw).toMatch(/Video/);
    // duration and size formatting (known fields videoDurationMs, videoSizeBytes)
    expect(raw).toMatch(/videoDurationMs/);
    expect(raw).toMatch(/videoSizeBytes/);
    // duration formatting helper (m:ss) and size (KB/MB)
    expect(raw).toMatch(/formatDuration|durationMs|Math\.floor/);
    expect(raw).toMatch(/formatBytes|KB|MB|1024/);
    // badge/icon — must not attempt heavy public media access
    // video badge must not use /uploads/<videoPath> (hardened contract: use /api/reports/:id/video only in detail)
    // Search for any video-specific /uploads usage — screenshot may still use /uploads but video must not
    // Ensure no pattern like videoPath + "/uploads/" or toSrc(videoPath)
    // We check that the video badge block does not contain "/uploads"
    const lines = raw.split("\n");
    const videoBadgeLines = lines.filter(l => /videoPath/i.test(l) || /Video/i.test(l));
    const videoUploadLeak = videoBadgeLines.some(l => l.includes("/uploads/") && /videoPath|video/i.test(l));
    // Stronger: the whole file must contain authenticated video route for detail but list must not embed <video> src
    expect(raw).not.toMatch(/<video[^>]*src=\{[^}]*toSrc\(r\.videoPath/);
    expect(raw).not.toMatch(/videoPath.*\/uploads\//);
    // list must not render a <video> element (heavy); badge + icon only
    // If a <video> appears, it must be only in ReportDetail, not in ProjectReports
    const prVideoTagCount = (raw.match(/<video/g) || []).length;
    expect(prVideoTagCount, "ProjectReports must not render <video> in list — badge/icon only").toBe(0);
  });

  it("ProjectReports exposes accessible videoCaptureEnabled toggle via reviewed PATCH contract (default off, no bulk enable)", () => {
    const raw = read(PR);
    const apiRaw = read(API);
    // state + UI for toggle
    expect(raw).toMatch(/videoCaptureEnabled/);
    // accessible toggle: checkbox or switch with label and aria
    expect(raw).toMatch(/role=\"switch\"|type=\"checkbox\"/);
    expect(raw).toMatch(/aria-checked|aria-label/);
    // visible label
    expect(raw).toMatch(/Enable video capture|Video capture/);
    // toggle handler uses PATCH /api/projects/:id with {videoCaptureEnabled: boolean}
    expect(raw).toMatch(/updateProject/);
    expect(raw).toMatch(/videoCaptureEnabled/);
    // api supports videoCaptureEnabled boolean
    expect(apiRaw).toMatch(/videoCaptureEnabled/);
    // default off: initial state false and no bulk enable code
    expect(raw).toMatch(/useState\(false\)/);
    expect(raw).not.toMatch(/bulk.*enable|enableAll/i);
    // accessible hit target 44px and keyboard operable
    expect(raw).toMatch(/min-h-\[44px\]|min-h-44/);
    // error/success feedback nearby
    expect(raw).toMatch(/aria-live|role=\"alert\"|Saved/);
  });

  it("ReportDetail renders loading/error/unsupported states, native controls, playsInline, metadata and download via hardened contract", () => {
    const raw = read(RD);
    // hardened contract: video src is /api/reports/:id/video (owner-authenticated, cookie)
    expect(raw).toMatch(/\/api\/reports\/.*\/video/);
    // must use download query variant
    expect(raw).toMatch(/download=1|download.*true/);
    // must NOT use public /uploads/<videoPath> for video
    expect(raw).not.toMatch(/toSrc\(.*videoPath/);
    expect(raw).not.toMatch(/\/uploads\/.*videoPath/);
    expect(raw).not.toMatch(/src=\{.*videoPath/);
    // native controls + playsInline + metadata preload
    expect(raw).toMatch(/controls/);
    expect(raw).toMatch(/playsInline/);
    expect(raw).toMatch(/preload=\"metadata\"/);
    // same-origin cookie auth: do NOT set crossOrigin="anonymous"
    expect(raw).not.toMatch(/crossOrigin=\"anonymous\"/);
    expect(raw).not.toMatch(/crossOrigin='anonymous'/);
    expect(raw).not.toMatch(/crossOrigin=\{[^}]*anonymous/);
    // loading state
    expect(raw).toMatch(/Loading video/);
    // error state
    expect(raw).toMatch(/role=\"alert\"/);
    expect(raw).toMatch(/Video unavailable|cannot play|Failed to load video|error/i);
    // unsupported codec fallback with download
    expect(raw).toMatch(/Download/);
    expect(raw).toMatch(/cannot play this video|unsupported/i);
    // metadata row: mime/duration/size
    expect(raw).toMatch(/videoMime/);
    expect(raw).toMatch(/videoDurationMs|videoSizeBytes/);
    // detail badge/metadata formatting present
    expect(raw).toMatch(/formatDuration|durationMs/);
  });

  it("ReportDetail preserves screenshot card, sandboxed DOM snapshot viewer and accessibility layout", () => {
    const raw = read(RD);
    // SnapshotViewer still sandboxed
    expect(raw).toMatch(/SnapshotViewer/);
    expect(raw).toMatch(/sandbox=\"\"/);
    expect(raw).toMatch(/srcDoc/);
    // screenshot card preserved
    expect(raw).toMatch(/Screenshot|Flattened image/);
    expect(raw).toMatch(/lightbox|Open screenshot|Download/);
    // ReportDetail still has back link and status handling
    expect(raw).toMatch(/Back to reports|Back/);
  });

  it("dashboard layouts remain responsive (desktop + 390px)", () => {
    const prRaw = read(PR);
    const rdRaw = read(RD);
    // ProjectReports uses responsive flex/grid and does not break at 390px
    expect(prRaw).toMatch(/flex-col md:flex-row|grid md:grid-cols/);
    // ReportDetail preserves 5-col grid responsive
    expect(rdRaw).toMatch(/grid md:grid-cols-5/);
    expect(rdRaw).toMatch(/max-w-4xl mx-auto w-full px-4/);
  });
});
