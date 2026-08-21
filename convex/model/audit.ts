// Append-only audit trail.
//
// Audit rows are written inside the mutation that performs the action, so a
// recorded event and the change it describes commit together — an action can
// never be logged for a transaction that later fails, and vice versa.

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const AUDIT_ACTIONS = {
  DOCUMENT_CREATED: "DOCUMENT_CREATED",
  DOCUMENT_DELETED: "DOCUMENT_DELETED",
  DOCUMENT_ARCHIVED: "DOCUMENT_ARCHIVED",
  DOCUMENT_RESTORED: "DOCUMENT_RESTORED",
  DOCUMENT_DUPLICATED: "DOCUMENT_DUPLICATED",
  COLLABORATOR_INVITED: "COLLABORATOR_INVITED",
  COLLABORATOR_ADDED: "COLLABORATOR_ADDED",
  COLLABORATOR_REMOVED: "COLLABORATOR_REMOVED",
  INVITE_DECLINED: "INVITE_DECLINED",
  COMMENT_DELETED: "COMMENT_DELETED",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

interface AuditEntry {
  action: AuditAction;
  /** Always the caller resolved from ctx.auth, never a value from arguments. */
  userId: Id<"users">;
  docId?: Id<"documents">;
  /** Extra context, serialized. Must not carry document contents. */
  metadata?: Record<string, unknown>;
}

/**
 * Records one audited action.
 *
 * Deliberately not called for document edits: autosave writes roughly once per
 * second per editor, and an audit row per keystroke burst would cost more than
 * the documents themselves while saying nothing useful. Only actions that
 * change who can reach a document, or destroy data, are recorded.
 */
export async function recordAudit(
  ctx: MutationCtx,
  { action, userId, docId, metadata }: AuditEntry
): Promise<void> {
  await ctx.db.insert("auditLogs", {
    action,
    userId,
    docId,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
    timestamp: Date.now(),
  });
}
