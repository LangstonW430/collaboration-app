// Thin wrappers over the Sentry SDK. Initialization is owned by
// sentry.client.config.ts / sentry.server.config.ts / sentry.edge.config.ts,
// which Next.js loads automatically — do not call Sentry.init() here.
import * as Sentry from "@sentry/nextjs";

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
