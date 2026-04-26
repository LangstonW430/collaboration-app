// Convex does not expose a native Sentry SDK hook, so we forward Convex
// errors to Sentry from the client/server boundary instead.
import { captureException, captureBreadcrumb } from "./sentry";

export function handleConvexError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const message = error instanceof Error ? error.message : String(error);
  captureBreadcrumb("convex", message, context);
  captureException(error, { source: "convex", ...context });
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      type: "convex_error",
      message,
      ...context,
    })
  );
}
