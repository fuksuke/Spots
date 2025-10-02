/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_MIXPANEL_TOKEN?: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
