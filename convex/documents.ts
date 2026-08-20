import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
import { updateDocumentFieldsSchema } from "../lib/validation/documentSchema";
import { AUDIT_ACTIONS, recordAudit } from "./model/audit";
import { enforceRateLimit } from "./model/rateLimit";
import {
  getDocumentAccess,
  requireDocumentAccess,
  requireDocumentOwner,
} from "./model/documentAccess";

/**
 * The number of documents the dashboard loads in each category. A user with
 * more than this sees the ones they worked on most recently; listForUser
 * reports when it had to leave some out.
 */
const LIST_LIMIT = 100;

/** Length of the plain-text preview the dashboard shows on each card. */
const PREVIEW_LENGTH = 180;

/**
 * Reduces a stored document to what a list needs.
 *
 * The body is deliberately not returned. The dashboard shows a short text
 * preview, and this is a live subscription: sending whole documents would push
 * every body to every viewer again each time anyone saved anything.
 */
function toSummary(
  doc: Doc<"documents">,
  userRole: "owner" | "editor" | "viewer"
) {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    title: doc.title,
    preview: doc.content
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, PREVIEW_LENGTH),
    ownerId: doc.ownerId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    userRole,
  };
}

/**
 * Returns the documents the current user owns or collaborates on, most
 * recently updated first.
 *
 * `truncated` says whether either category hit LIST_LIMIT, so the dashboard can
 * tell the user some documents are not shown rather than silently omitting
 * them.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { documents: [], truncated: false };

    const ownedDocs = await ctx.db
      .query("documents")
      .withIndex("by_owner_and_updated", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(LIST_LIMIT);

    const collabs = await ctx.db
      .query("collaborators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(LIST_LIMIT);

    const sharedDocs = (
      await Promise.all(collabs.map((c) => ctx.db.get(c.docId)))
    ).flatMap((doc, i) => (doc ? [toSummary(doc, collabs[i].role)] : []));

    const documents = [
      ...ownedDocs.map((doc) => toSummary(doc, "owner")),
      ...sharedDocs,
    ].sort((a, b) => b.updatedAt - a.updatedAt);

    return {
      documents,
      truncated: ownedDocs.length === LIST_LIMIT || collabs.length === LIST_LIMIT,
    };
  },
});

/** Returns a single document by ID — if the caller is owner or collaborator. */
export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const access = await getDocumentAccess(ctx, args.id);
    if (!access) return null;

    return { ...access.doc, userRole: access.role };
  },
});

/** Creates a new blank document and returns its ID. */
export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await enforceRateLimit(ctx, userId, "documents.create");

    const now = Date.now();
    const docId = await ctx.db.insert("documents", {
      title: "Untitled Document",
      content: "",
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordAudit(ctx, { action: AUDIT_ACTIONS.DOCUMENT_CREATED, userId, docId });

    return docId;
  },
});

/**
 * Updates the title and/or content. Owner or editor only.
 * Returns the updatedAt it wrote, which the client uses to recognise the echo
 * of its own save.
 */
export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Authorize before validating, so validation feedback is only ever
    // returned to someone allowed to edit the document.
    const { userId } = await requireDocumentAccess(ctx, args.id, "write");

    // Backend validation — independent of any client-side checks
    const validation = updateDocumentFieldsSchema.safeParse({ title: args.title, content: args.content });
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? "Validation failed";
      console.error("[documents.update] Validation failure", { userId, issues: validation.error.issues });
      throw new Error(message);
    }

    // Writes the validated values, so a field is stored trimmed rather than as
    // it arrived. Only fields the caller actually sent are patched.
    const { title, content } = validation.data;
    const updatedAt = Date.now();
    await ctx.db.patch(args.id, {
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { content } : {}),
      updatedAt,
    });

    // Returned so the client records the server's own timestamp rather than
    // guessing with its clock. See SyncManager.onServerUpdate.
    return { updatedAt };
  },
});

/**
 * Permanently deletes a document the caller owns, along with every row that
 * hangs off it. Without the cascade, deleted documents leave behind
 * collaborator rows that keep appearing in documents.list, invites that can
 * still be accepted, and comments that outlive the text they annotate.
 *
 * Rows are collected and deleted in one transaction, which suits the volumes
 * a single document accumulates. Files in storage are deliberately left
 * alone: the same upload can be embedded in more than one document, so
 * reclaiming them needs reference counting rather than a cascade.
 */
export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const { userId, doc } = await requireDocumentOwner(ctx, args.id);

    const collaborators = await ctx.db
      .query("collaborators")
      .withIndex("by_doc", (q) => q.eq("docId", args.id))
      .collect();

    // Index prefix — matches every invite for the document, any status.
    const invites = await ctx.db
      .query("invites")
      .withIndex("by_doc_and_status", (q) => q.eq("docId", args.id))
      .collect();

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_doc", (q) => q.eq("docId", args.id))
      .collect();

    await Promise.all([
      ...collaborators.map((row) => ctx.db.delete(row._id)),
      ...invites.map((row) => ctx.db.delete(row._id)),
      ...comments.map((row) => ctx.db.delete(row._id)),
    ]);

    // Recorded before the delete, while the document is still readable. The
    // title is kept so the trail stays meaningful once the document is gone.
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.DOCUMENT_DELETED,
      userId,
      docId: args.id,
      metadata: {
        title: doc.title,
        collaboratorsRemoved: collaborators.length,
        invitesRemoved: invites.length,
        commentsRemoved: comments.length,
      },
    });

    await ctx.db.delete(args.id);
  },
});
