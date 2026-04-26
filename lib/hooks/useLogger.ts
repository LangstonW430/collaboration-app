"use client";

import { useCallback } from "react";
import { captureBreadcrumb } from "@/lib/monitoring/sentry";

export type LogLevel = "error" | "warn" | "info" | "debug";

export interface LogContext {
  [key: string]: unknown;
}

/**
 * Returns a structured logger scoped to `componentName`.
 * Logs are written asynchronously via queueMicrotask to avoid blocking renders.
 *
 * Usage:
 *   const log = useLogger('DocumentEditor');
 *   log.info('user-clicked-save', { docId, size });
 */
export function useLogger(componentName: string) {
  const emit = useCallback(
    (level: LogLevel, message: string, context?: LogContext) => {
      queueMicrotask(() => {
        const entry = JSON.stringify({
          timestamp: new Date().toISOString(),
          level,
          component: componentName,
          message,
          ...context,
        });

        if (level === "error") console.error(entry);
        else if (level === "warn") console.warn(entry);
        else console.log(entry);

        if (level === "error" || level === "warn") {
          captureBreadcrumb(componentName, message, context);
        }
      });
    },
    [componentName]
  );

  return {
    error: (message: string, context?: LogContext) =>
      emit("error", message, context),
    warn: (message: string, context?: LogContext) =>
      emit("warn", message, context),
    info: (message: string, context?: LogContext) =>
      emit("info", message, context),
    debug: (message: string, context?: LogContext) =>
      emit("debug", message, context),
  };
}
