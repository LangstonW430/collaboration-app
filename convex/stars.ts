// Per-user document stars. Starring is a personal bookmark, not a property of
// the document, so it lives in its own table keyed by (user, doc) and never
// shows up in anyone else's view.

import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireDocumentAccess } from "./model/documentAccess";

/**
 * Stars the document if it is not starred, unstars it if it is. Returns the
 * new state so optimistic UIs can settle on the truth.
 */
export const toggle = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    // Read access is enough: viewers can bookmark documents shared with them.
    const { userId } = await requireDocumentAccess(ctx, args.docId, "read");

    const existing = await ctx.db
      .query("stars")
      .withIndex("by_user_and_doc", (q) =>
        q.eq("userId", userId).eq("docId", args.docId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { starred: false };
    }

    await ctx.db.insert("stars", { userId, docId: args.docId });
    return { starred: true };
  },
});
