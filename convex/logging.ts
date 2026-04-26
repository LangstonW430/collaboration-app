import { v } from "convex/values";
import { mutation, internalMutation, internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Public mutation — userId derived server-side from auth, never accepted as arg.
export const logAction = mutation({
  args: {
    action: v.string(),
    docId: v.optional(v.id("documents")),
    metadata: v.optional(v.string()),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    await ctx.db.insert("auditLogs", {
      action: args.action,
      userId: identity?.tokenIdentifier ?? "anonymous",
      docId: args.docId,
      metadata: args.metadata,
      requestId: args.requestId,
      timestamp: Date.now(),
    });
  },
});

// Internal mutation — called from other Convex functions that have already
// validated the userId themselves.
export const logInternalAction = internalMutation({
  args: {
    action: v.string(),
    userId: v.optional(v.string()),
    docId: v.optional(v.id("documents")),
    metadata: v.optional(v.string()),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      action: args.action,
      userId: args.userId,
      docId: args.docId,
      metadata: args.metadata,
      requestId: args.requestId,
      timestamp: Date.now(),
    });
  },
});

export const getAuditLogs = internalQuery({
  args: {
    limit: v.number(),
    docId: v.optional(v.id("documents")),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.docId) {
      return await ctx.db
        .query("auditLogs")
        .withIndex("by_doc_and_timestamp", (q) =>
          q.eq("docId", args.docId as Id<"documents">)
        )
        .order("desc")
        .take(args.limit);
    }
    if (args.userId) {
      return await ctx.db
        .query("auditLogs")
        .withIndex("by_user_and_timestamp", (q) =>
          q.eq("userId", args.userId as string)
        )
        .order("desc")
        .take(args.limit);
    }
    return await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(args.limit);
  },
});
