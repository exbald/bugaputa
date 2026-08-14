import { Router } from "express";
import { getDb, WIDGET_DEFAULTS } from "../db.js";
import { widgetConfigQuerySchema } from "../lib/validators.js";

const router = Router();

// Public endpoint — no auth. Returns widget customization for widget.js fallback.
// GET /api/widget-config?project=pk_live_XXX
// Also supports ?key= for backwards compat.
router.get("/", (req, res) => {
  // CORS for widget cross-origin fetch
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");

  const projectKey = (req.query.project as string) || (req.query.key as string) || "";
  if (!projectKey) {
    res.status(400).json({ error: "Missing ?project= query param" });
    return;
  }
  const parsed = widgetConfigQuerySchema.safeParse({ project: projectKey });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid project key" });
    return;
  }
  let row: any;
  try {
    const db = getDb();
    row = db.prepare("SELECT widget_label, widget_color, widget_position FROM projects WHERE publicKey = ?").get(projectKey) as any;
  } catch (err) {
    console.error("[widget-config] DB error:", err);
    res.status(500).json({ error: "Internal server error" });
    return;
  }
  if (!row) {
    // Return defaults rather than 404 so widget still renders
    res.json({
      label: WIDGET_DEFAULTS.label,
      color: WIDGET_DEFAULTS.color,
      position: WIDGET_DEFAULTS.position,
      widget_label: WIDGET_DEFAULTS.label,
      widget_color: WIDGET_DEFAULTS.color,
      widget_position: WIDGET_DEFAULTS.position,
    });
    return;
  }
  res.json({
    label: row.widget_label ?? WIDGET_DEFAULTS.label,
    color: row.widget_color ?? WIDGET_DEFAULTS.color,
    position: row.widget_position ?? WIDGET_DEFAULTS.position,
    widget_label: row.widget_label ?? WIDGET_DEFAULTS.label,
    widget_color: row.widget_color ?? WIDGET_DEFAULTS.color,
    widget_position: row.widget_position ?? WIDGET_DEFAULTS.position,
  });
});

router.options("/", (_req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.status(204).end();
});

export default router;
