// The signed-in user's own profile.

import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Who the caller is, for showing their identity in the UI. Returns only the
 * fields the interface needs, never the whole auth record.
 */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
    };
  },
});
