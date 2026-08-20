// Shared document authorization. Every function that reads or writes data
// belonging to a document must go through this module, so the rules for who
// can see and change a document live in exactly one place.

import { getAuthUserId } from "@convex-dev/auth/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export type DocumentRole = "owner" | "editor" | "viewer";

export interface DocumentAccess {
  userId: Id<"users">;
  doc: Doc<"documents">;
  role: DocumentRole;
}

/** Roles allowed to change a document and the comments attached to it. */
export function canWrite(role: DocumentRole): boolean {
  return role === "owner" || role === "editor";
}

/** The caller's role on `doc`, or null if they are not a participant. */
async function resolveRole(
  ctx: QueryCtx | MutationCtx,
  doc: Doc<"documents">,
  userId: Id<"users">
): Promise<DocumentRole | null> {
  if (doc.ownerId === userId) return "owner";

  const collaborator = await ctx.db
    .query("collaborators")
    .withIndex("by_doc_and_user", (q) => q.eq("docId", doc._id).eq("userId", userId))
    .unique();

  return collaborator?.role ?? null;
}

/**
 * Resolves the caller's access to a document, or null when they are signed
 * out, the document does not exist, or they are neither its owner nor a
 * collaborator. Use from queries, which report "no access" as an empty result.
 */
export async function getDocumentAccess(
  ctx: QueryCtx | MutationCtx,
  docId: Id<"documents">
): Promise<DocumentAccess | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;

  const doc = await ctx.db.get(docId);
  if (!doc) return null;

  const role = await resolveRole(ctx, doc, userId);
  if (!role) return null;

  return { userId, doc, role };
}

/**
 * Same as getDocumentAccess, but throws instead of returning null. Use from
 * mutations, where the caller needs to know why the write was rejected.
 *
 * @param level "read" allows any collaborator; "write" allows owner and editor.
 */
export async function requireDocumentAccess(
  ctx: QueryCtx | MutationCtx,
  docId: Id<"documents">,
  level: "read" | "write"
): Promise<DocumentAccess> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");

  const doc = await ctx.db.get(docId);
  if (!doc) throw new Error("Document not found");

  const role = await resolveRole(ctx, doc, userId);
  if (!role) throw new Error("Not authorized");
  if (level === "write" && !canWrite(role)) throw new Error("Not authorized");

  return { userId, doc, role };
}

/** Throws unless the caller owns the document. For owner-only administration. */
export async function requireDocumentOwner(
  ctx: QueryCtx | MutationCtx,
  docId: Id<"documents">
): Promise<DocumentAccess> {
  const access = await requireDocumentAccess(ctx, docId, "read");
  if (access.role !== "owner") throw new Error("Not authorized");
  return access;
}
