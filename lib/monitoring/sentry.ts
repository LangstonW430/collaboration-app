import * as Sentry from "@sentry/nextjs";

let initialized = false;

/**
 * Call once at app startup. No-ops when SENTRY_DSN is not set.
 * For full Next.js instrumentation also create sentry.client.config.ts /
 * sentry.server.config.ts and wrap next.config.ts with withSentryConfig.
 */
export function initSentry(): void {
  const dsn =
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn || initialized) return;
  initialized = true;

  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    // Sample 10% of transactions in production to stay within quota.
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    debug: process.env.NODE_ENV === "development",
  });
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(error);
  });
}

export function captureBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: "info",
    timestamp: Date.now() / 1000,
  });
}

export function setUserContext(userId: string, email?: string): void {
  Sentry.setUser({ id: userId, email });
}

export function clearUserContext(): void {
  Sentry.setUser(null);
}
