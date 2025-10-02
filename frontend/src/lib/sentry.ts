import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const SENTRY_ENVIRONMENT = import.meta.env.VITE_SENTRY_ENVIRONMENT ?? import.meta.env.MODE;
const SENTRY_TRACES_SAMPLE_RATE = Number.parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0");

let initialized = false;

export const initSentry = () => {
  if (initialized || !SENTRY_DSN || typeof window === "undefined") {
    return false;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: Number.isFinite(SENTRY_TRACES_SAMPLE_RATE) ? SENTRY_TRACES_SAMPLE_RATE : 0,
    integrations: []
  });

  initialized = true;
  return true;
};

export const captureSentryException = (error: unknown, context?: Record<string, unknown>) => {
  if (!initialized) {
    return;
  }
  Sentry.captureException(error, context ? { extra: context } : undefined);
};

export const setSentryUser = (user: { id: string; email?: string | null } | null) => {
  if (!initialized) {
    return;
  }
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email ?? undefined });
  } else {
    Sentry.setUser(null);
  }
};

export const flushSentry = async () => {
  if (!initialized) return;
  try {
    await Sentry.flush(2000);
  } catch (error) {
    console.warn("Failed to flush Sentry events", error);
  }
};

export const isSentryEnabled = () => initialized;
