/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_CANONICAL_ORIGIN?: string;
  readonly VITE_LANDING_WIDGET_PROJECT_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
