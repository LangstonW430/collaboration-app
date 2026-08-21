// Who is looking at a document right now.
//
// Each open editor calls heartbeat() every HEARTBEAT_INTERVAL_MS; a user whose
// row was touched within ACTIVE_WINDOW_MS counts as present. There is no
// explicit "leave": closing the tab simply stops the heartbeat and the row
// goes stale. heartbeat() deletes stale rows for the document it touches, so
// the table cleans itself up exactly where it is being used.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireDocumentAccess, getDocumentAccess } from "./model/documentAccess";

/** How often clients are expected to call heartbeat(). */
export const HEARTBEAT_INTERVAL_MS = 10_000;

/**
 * How recently a row must have been touched for its user to count as present.
 * Three missed heartbeats — generous enough to ride out a slow request without
 * flickering, short enough that a closed tab disappears promptly.
 */
export const ACTIVE_WINDOW_MS = 30_000;

/** Rows older than this are deleted whenever a heartbeat touches the doc. */
const PRUNE_AFTER_MS = 5 * 60_000;

/** Most stale rows removed per heartbeat, so the write stays small. */
const PRUNE_BATCH = 20;

/**
 * Records that the caller is viewing the document. Any participant may call
 * it — viewers are just as present as editors.
 */
export const heartbeat = mutation({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const { userId } = await requireDocumentAccess(ctx, args.docId, "read");
    const now = Date.now();

    const existing = await ctx.db
      .query("presence")
      .withIndex("by_doc_and_user", (q) =>
        q.eq("docId", args.docId).eq("userId", userId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastSeen: now });
    } else {
      await ctx.db.insert("presence", { docId: args.docId, userId, lastSeen: now });
    }

    // Opportunistic cleanup of long-dead rows on the same document.
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .take(PRUNE_BATCH);
    await Promise.all(
      rows
        .filter((row) => now - row.lastSeen > PRUNE_AFTER_MS)
        .map((row) => ctx.db.delete(row._id))
    );

    return null;
  },
});

/**
 * The other people currently viewing the document — the caller is excluded,
 * since their own presence is not news to them. Returns name/email so the
 * editor can draw initialled avatars.
 */
export const activeUsers = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const access = await getDocumentAccess(ctx, args.docId);
    if (!access) return [];

    const cutoff = Date.now() - ACTIVE_WINDOW_MS;
    const rows = await ctx.db
      .query("presence")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .take(50);

    const active = rows.filter(
      (row) => row.userId !== access.userId && row.lastSeen >= cutoff
    );

    const users = await Promise.all(active.map((row) => ctx.db.get(row.userId)));
    return users.flatMap((user, i) =>
      user
        ? [
            {
              userId: active[i].userId,
              name: user.name ?? null,
              email: user.email ?? null,
            },
          ]
        : []
    );
  },
});
