// Next.js loads this automatically on server start. Without it the
// sentry.server.config.ts and sentry.edge.config.ts files are never imported,
// so server and edge errors are not reported at all.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports errors thrown while rendering on the server.
export const onRequestError = Sentry.captureRequestError;
