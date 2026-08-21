import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
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
 * How many stars are loaded when annotating a list. Far above what LIST_LIMIT
 * documents can carry; anything beyond it would belong to documents the list
 * is not showing anyway.
 */
const STARS_LIMIT = 500;

/** Most matches a single search returns. */
const SEARCH_LIMIT = 50;

/** The document body as the words a reader sees, with markup dropped. */
function toPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Reduces a stored document to what a list needs.
 *
 * The body is deliberately not returned. The dashboard shows a short text
 * preview, and this is a live subscription: sending whole documents would push
 * every body to every viewer again each time anyone saved anything.
 */
function toSummary(
  doc: Doc<"documents">,
  userRole: "owner" | "editor" | "viewer",
  starred: boolean
) {
  return {
    _id: doc._id,
    _creationTime: doc._creationTime,
    title: doc.title,
    preview: toPlainText(doc.content).slice(0, PREVIEW_LENGTH),
    ownerId: doc.ownerId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    userRole,
    starred,
  };
}

/** The IDs of every document `userId` has starred (bounded). */
async function loadStarredIds(
  ctx: QueryCtx,
  userId: Id<"users">
): Promise<Set<Id<"documents">>> {
  const stars = await ctx.db
    .query("stars")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(STARS_LIMIT);
  return new Set(stars.map((s) => s.docId));
}

/**
 * The live (non-archived) documents the user owns or collaborates on, newest
 * update first, as full rows plus the caller's role on each. Shared by list
 * and search so both see exactly the same set of documents.
 */
async function loadAccessibleDocs(ctx: QueryCtx, userId: Id<"users">) {
  const ownedDocs = await ctx.db
    .query("documents")
    .withIndex("by_owner_and_archived_and_updated", (q) =>
      q.eq("ownerId", userId).eq("archivedAt", undefined)
    )
    .order("desc")
    .take(LIST_LIMIT);

  const collabs = await ctx.db
    .query("collaborators")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(LIST_LIMIT);

  const sharedDocs = (
    await Promise.all(collabs.map((c) => ctx.db.get(c.docId)))
  ).flatMap((doc, i) =>
    // Trashed documents disappear for collaborators until restored.
    doc && doc.archivedAt === undefined ? [{ doc, role: collabs[i].role }] : []
  );

  const rows = [
    ...ownedDocs.map((doc) => ({ doc, role: "owner" as const })),
    ...sharedDocs.map((r) => ({ doc: r.doc, role: r.role })),
  ].sort((a, b) => b.doc.updatedAt - a.doc.updatedAt);

  return {
    rows,
    truncated: ownedDocs.length === LIST_LIMIT || collabs.length === LIST_LIMIT,
  };
}

/**
 * Returns the documents the current user owns or collaborates on, most
 * recently updated first. Documents in the trash are not included — see
 * listTrash.
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

    const [{ rows, truncated }, starredIds] = await Promise.all([
      loadAccessibleDocs(ctx, userId),
      loadStarredIds(ctx, userId),
    ]);

    return {
      documents: rows.map(({ doc, role }) =>
        toSummary(doc, role, starredIds.has(doc._id))
      ),
      truncated,
    };
  },
});

/**
 * Full-content search over the same documents `list` shows. Every word of the
 * query must appear in the title or body text, case-insensitively. An empty
 * query matches nothing rather than everything, so the dashboard can keep the
 * subscription open while the search box is blank.
 */
export const search = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { documents: [] };

    const words = args.query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return { documents: [] };

    const [{ rows }, starredIds] = await Promise.all([
      loadAccessibleDocs(ctx, userId),
      loadStarredIds(ctx, userId),
    ]);

    const documents = rows
      .filter(({ doc }) => {
        const haystack = `${doc.title} ${toPlainText(doc.content)}`.toLowerCase();
        return words.every((w) => haystack.includes(w));
      })
      .slice(0, SEARCH_LIMIT)
      .map(({ doc, role }) => toSummary(doc, role, starredIds.has(doc._id)));

    return { documents };
  },
});

/**
 * The caller's trashed documents, most recently trashed first. Owner only by
 * construction: archiving is owner-only, and collaborators stop seeing a
 * document the moment it is archived.
 */
export const listTrash = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { documents: [] };

    // The index puts undefined (live) first, so descending order yields the
    // archived rows before the live ones; stop reading at the boundary.
    const rows = await ctx.db
      .query("documents")
      .withIndex("by_owner_and_archived_and_updated", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(LIST_LIMIT * 2);

    const documents = rows
      .filter((doc) => doc.archivedAt !== undefined)
      .sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
      .slice(0, LIST_LIMIT)
      .map((doc) => ({ ...toSummary(doc, "owner", false), archivedAt: doc.archivedAt! }));

    return { documents };
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
 * Moves a document the caller owns to the trash. Collaborators lose access
 * immediately; the document keeps its collaborator rows, invites and comments
 * so a restore puts everything back exactly as it was.
 */
export const archive = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const { userId, doc } = await requireDocumentOwner(ctx, args.id);
    if (doc.archivedAt !== undefined) return null;

    await ctx.db.patch(args.id, { archivedAt: Date.now() });

    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.DOCUMENT_ARCHIVED,
      userId,
      docId: args.id,
      metadata: { title: doc.title },
    });

    return null;
  },
});

/** Brings a trashed document back, restoring collaborator access with it. */
export const restore = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const { userId, doc } = await requireDocumentOwner(ctx, args.id);
    if (doc.archivedAt === undefined) return null;

    await ctx.db.patch(args.id, { archivedAt: undefined, updatedAt: Date.now() });

    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.DOCUMENT_RESTORED,
      userId,
      docId: args.id,
      metadata: { title: doc.title },
    });

    return null;
  },
});

/**
 * Copies a document into the caller's own account and returns the new ID.
 * Anyone who can read the document may duplicate it — they can already see
 * every byte of it — but the copy is theirs alone: no collaborators, invites
 * or comments come along.
 */
export const duplicate = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const { userId, doc } = await requireDocumentAccess(ctx, args.id, "read");

    // Duplication creates a document, so it spends the same budget.
    await enforceRateLimit(ctx, userId, "documents.create");

    const now = Date.now();
    const docId = await ctx.db.insert("documents", {
      title: `${doc.title} (copy)`,
      content: doc.content,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    });

    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.DOCUMENT_DUPLICATED,
      userId,
      docId,
      metadata: { sourceDocId: args.id, title: doc.title },
    });

    return docId;
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

    const stars = await ctx.db
      .query("stars")
      .withIndex("by_doc", (q) => q.eq("docId", args.id))
      .collect();

    const presence = await ctx.db
      .query("presence")
      .withIndex("by_doc", (q) => q.eq("docId", args.id))
      .collect();

    await Promise.all([
      ...collaborators.map((row) => ctx.db.delete(row._id)),
      ...invites.map((row) => ctx.db.delete(row._id)),
      ...comments.map((row) => ctx.db.delete(row._id)),
      ...stars.map((row) => ctx.db.delete(row._id)),
      ...presence.map((row) => ctx.db.delete(row._id)),
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
