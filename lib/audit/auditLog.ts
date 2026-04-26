"use client";

import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export const AUDIT_ACTIONS = {
  DOCUMENT_CREATED: "DOCUMENT_CREATED",
  DOCUMENT_UPDATED: "DOCUMENT_UPDATED",
  DOCUMENT_DELETED: "DOCUMENT_DELETED",
  USER_LOGGED_IN: "USER_LOGGED_IN",
  USER_LOGGED_OUT: "USER_LOGGED_OUT",
  COLLABORATOR_ADDED: "COLLABORATOR_ADDED",
  COLLABORATOR_REMOVED: "COLLABORATOR_REMOVED",
  COMMENT_ADDED: "COMMENT_ADDED",
  COMMENT_RESOLVED: "COMMENT_RESOLVED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

/**
 * Returns an `auditLog(action, userId, docId, metadata?)` function bound to
 * the Convex mutation. The server always derives the authoritative userId from
 * ctx.auth; the `userId` arg here is stored as extra metadata only.
 *
 * Audit logs are append-only (insert-only table, no patch/replace calls).
 */
export function useAuditLog() {
  const logAction = useMutation(api.logging.logAction);

  return useCallback(
    (
      action: AuditAction,
      userId: string,
      docId?: Id<"documents">,
      metadata?: Record<string, unknown>
    ) => {
      const meta = metadata
        ? JSON.stringify({ ...metadata, callerUserId: userId })
        : JSON.stringify({ callerUserId: userId });

      // Fire-and-forget; audit logs must not block the main thread.
      void logAction({ action, docId, metadata: meta });
    },
    [logAction]
  );
}
