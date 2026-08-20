// Server-side rate limiting.
//
// lib/rateLimit.ts throttles the UI, but it lives in one browser tab's memory
// and any client can simply not call it, so it is a courtesy to the user rather
// than a control. These limits are enforced inside the mutation, where they
// cannot be skipped.

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

interface Limit {
  /** Calls permitted per window. */
  limit: number;
  windowMs: number;
}

/**
 * Only low-frequency mutations are listed.
 *
 * documents.update is deliberately absent: autosave writes about once per
 * second per editor, and counting those would put every save behind a read and
 * a write of the same counter row, turning the user's own typing into a source
 * of write contention. Convex's own function limits cover that case; these
 * limits exist to stop a client creating unbounded rows or sending unbounded
 * invitations.
 */
export const RATE_LIMITS = {
  "documents.create": { limit: 60, windowMs: 60_000 },
  "comments.create": { limit: 120, windowMs: 60_000 },
  "collaborators.invite": { limit: 20, windowMs: 60_000 },
  "files.upload": { limit: 60, windowMs: 60_000 },
} as const satisfies Record<string, Limit>;

export type RateLimitedAction = keyof typeof RATE_LIMITS;

/**
 * Consumes one unit of `action`'s budget for `userId`, throwing when the budget
 * for the current window is spent.
 *
 * The window is fixed rather than sliding: a counter resets once windowMs has
 * passed since it started, so a caller can spend two windows' worth across a
 * window boundary. That is accepted for the far cheaper bookkeeping — one row
 * per user and action, no per-call timestamp list to store and prune.
 *
 * Call after authorizing, so a caller who is going to be rejected anyway does
 * not consume budget or create rows.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
  action: RateLimitedAction
): Promise<void> {
  const { limit, windowMs } = RATE_LIMITS[action];
  const key = `${userId}:${action}`;
  const now = Date.now();

  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();

  if (existing === null) {
    await ctx.db.insert("rateLimits", { key, windowStart: now, count: 1 });
    return;
  }

  if (now - existing.windowStart >= windowMs) {
    await ctx.db.patch(existing._id, { windowStart: now, count: 1 });
    return;
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.ceil((existing.windowStart + windowMs - now) / 1000);
    throw new Error(`Too many requests. Try again in ${retryAfterSeconds}s.`);
  }

  await ctx.db.patch(existing._id, { count: existing.count + 1 });
}
