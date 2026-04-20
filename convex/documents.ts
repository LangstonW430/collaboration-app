import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** Returns all documents owned by the currently authenticated user. */
export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("documents")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex("by_owner", (q: any) => q.eq("ownerId", userId))
      .order("desc")
      .collect();
  },
});

/** Returns a single document by ID — only if the caller owns it. */
export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const doc = await ctx.db.get(args.id);
    if (!doc || doc.ownerId !== userId) return null;

    return doc;
  },
});

/** Creates a new blank document and returns its ID. */
export const create = mutation({
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

/** Updates the title and/or content of a document the caller owns. */
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
    if (!doc || doc.ownerId !== userId) throw new Error("Document not found");

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
