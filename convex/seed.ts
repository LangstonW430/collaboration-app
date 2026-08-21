// Demo content for a public showcase deployment.
//
// Internal on purpose, and destructive: it clears every document owned by the
// named account before inserting fresh ones, so re-running it restores a known
// state after visitors have edited things. Point it only at a throwaway demo
// account, never at a real one.
//
// Run it from the Convex dashboard (Functions -> seed:resetDemoContent) or:
//   npx convex run seed:resetDemoContent '{"email":"demo@example.com"}' --prod
//
// The account has to exist first — sign up through the app, then run this.

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { DEMO_DOCUMENTS } from "./model/demoContent";

/**
 * Replaces the demo account's documents with the sample set above.
 *
 * Returns what it created, so the caller can tell a successful run from one
 * that silently did nothing.
 */
export const resetDemoContent = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase();

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();

    if (user === null) {
      throw new Error(
        `No account found for ${email}. Sign up through the app first, then run this again.`
      );
    }

    // Clear the previous run. Comments are removed alongside their documents so
    // no thread is left pointing at a document that no longer exists.
    const owned = await ctx.db
      .query("documents")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    for (const doc of owned) {
      const comments = await ctx.db
        .query("comments")
        .withIndex("by_doc", (q) => q.eq("docId", doc._id))
        .collect();
      const collaborators = await ctx.db
        .query("collaborators")
        .withIndex("by_doc", (q) => q.eq("docId", doc._id))
        .collect();

      await Promise.all([
        ...comments.map((row) => ctx.db.delete(row._id)),
        ...collaborators.map((row) => ctx.db.delete(row._id)),
      ]);
      await ctx.db.delete(doc._id);
    }

    const now = Date.now();
    let commentsCreated = 0;

    for (const demo of DEMO_DOCUMENTS) {
      const updatedAt = now - demo.editedMinutesAgo * 60_000;
      const docId = await ctx.db.insert("documents", {
        title: demo.title,
        content: demo.content,
        ownerId: user._id,
        createdAt: updatedAt,
        updatedAt,
      });

      for (const comment of demo.comments ?? []) {
        await ctx.db.insert("comments", {
          docId,
          authorId: user._id,
          markId: comment.markId,
          text: comment.text,
          quotedText: comment.quotedText,
          resolved: false,
          createdAt: updatedAt,
        });
        commentsCreated++;
      }
    }

    return {
      documentsRemoved: owned.length,
      documentsCreated: DEMO_DOCUMENTS.length,
      commentsCreated,
    };
  },
});
