import * as Sentry from "@sentry/node";
import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";

const SENTRY_DSN = process.env.SENTRY_DSN;
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
const SENTRY_TRACES_SAMPLE_RATE = Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0");

export const isSentryEnabled = Boolean(SENTRY_DSN);

if (isSentryEnabled) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    tracesSampleRate: Number.isFinite(SENTRY_TRACES_SAMPLE_RATE) ? SENTRY_TRACES_SAMPLE_RATE : 0
  });
}

export const getSentry = () => (isSentryEnabled ? Sentry : null);

export const captureSentryException = (error: unknown, context?: Record<string, unknown>) => {
  if (!isSentryEnabled) return;
  const err = error instanceof Error ? error : new Error(String(error));
  Sentry.captureException(err, context ? { extra: context } : undefined);
};

export const sentryRequestHandler = (): RequestHandler => {
  if (!isSentryEnabled) {
    return (_req: Request, _res: Response, next: NextFunction) => next();
  }
  return Sentry.Handlers.requestHandler();
};

export const sentryErrorHandler = (): ErrorRequestHandler => {
  if (!isSentryEnabled) {
    return (err: Error, _req: Request, _res: Response, next: NextFunction) => next(err);
  }
  return Sentry.Handlers.errorHandler();
};
