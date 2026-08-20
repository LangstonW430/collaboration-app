import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { Id } from "./_generated/dataModel";

/**
 * Reads the audit trail, newest first.
 *
 * Internal on purpose: audit records describe who has access to what across
 * every document, so there is no safe way to expose them to a client without
 * an administrative identity to check first. Audit rows are written by
 * recordAudit() in convex/model/audit.ts, inside the mutations themselves.
 */
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
