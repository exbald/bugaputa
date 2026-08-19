export const CANONICAL_ORIGIN: string =
  ((import.meta.env as Record<string, string | undefined>).VITE_CANONICAL_ORIGIN || "https://bugaputa.com").replace(/\/$/, "");
export const WIDGET_SRC = CANONICAL_ORIGIN + "/widget.js";
export const WIDGET_CSS = CANONICAL_ORIGIN + "/widget.css";
