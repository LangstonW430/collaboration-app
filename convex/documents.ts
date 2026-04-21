import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Returns all documents the current user owns or collaborates on. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const ownedDocs = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .order("desc")
      .take(100);

    const collabs = await ctx.db
      .query("collaborators")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .take(100);

    const sharedDocs = (
      await Promise.all(
        collabs.map(async (c) => {
          const doc = await ctx.db.get(c.docId);
          if (!doc) return null;
          return { ...doc, userRole: c.role as "editor" | "viewer" };
        })
      )
    ).filter((d): d is NonNullable<typeof d> => d !== null);

    const all = [
      ...ownedDocs.map((d) => ({ ...d, userRole: "owner" as const })),
      ...sharedDocs,
    ];

    return all.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Returns a single document by ID — if the caller is owner or collaborator. */
export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const doc = await ctx.db.get(args.id);
    if (!doc) return null;

    if (doc.ownerId === userId) {
      return { ...doc, userRole: "owner" as const };
    }

    const collab = await ctx.db
      .query("collaborators")
      .withIndex("by_doc_and_user", (q) =>
        q.eq("docId", args.id).eq("userId", userId)
      )
      .unique();

    if (!collab) return null;

    return { ...doc, userRole: collab.role as "editor" | "viewer" };
  },
});

/** Creates a new blank document and returns its ID. */
export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    return await ctx.db.insert("documents", {
      title: "Untitled Document",
      content: "",
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Updates the title and/or content. Owner or editor only. */
export const update = mutation({
  args: {
    id: v.id("documents"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc) throw new Error("Document not found");

    if (doc.ownerId !== userId) {
      const collab = await ctx.db
        .query("collaborators")
        .withIndex("by_doc_and_user", (q) =>
          q.eq("docId", args.id).eq("userId", userId)
        )
        .unique();
      if (!collab || collab.role !== "editor") throw new Error("Not authorized");
    }

    const { id, ...fields } = args;
    await ctx.db.patch(id, { ...fields, updatedAt: Date.now() });
  },
});

/** Permanently deletes a document the caller owns. */
export const remove = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.ownerId !== userId) throw new Error("Document not found");

    await ctx.db.delete(args.id);
  },
});
