import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { z } from "zod";

const inviteSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .max(254, 'Email address is too long')
    .email('Please enter a valid email address'),
});

async function getCurrentUserEmail(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<string | null> {
  const user = await ctx.db.get(userId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (user as any)?.email ?? null;
}

/** Invite a user by email to collaborate on a document. Only the owner can invite. */
export const invite = mutation({
  args: {
    docId: v.id("documents"),
    email: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const validation = inviteSchema.safeParse({ email: args.email });
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? "Validation failed";
      console.error("[collaborators.invite] Validation failure", { userId, issues: validation.error.issues });
      throw new Error(message);
    }

    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.ownerId !== userId) throw new Error("Not authorized");

    // Prevent inviting yourself
    const myEmail = await getCurrentUserEmail(ctx, userId);
    if (myEmail && myEmail.toLowerCase() === args.email.toLowerCase()) {
      throw new Error("Cannot invite yourself");
    }

    // Check for existing pending invite
    const existing = await ctx.db
      .query("invites")
      .withIndex("by_doc_and_status", (q) =>
        q.eq("docId", args.docId).eq("status", "pending")
      )
      .take(100);

    const alreadyPending = existing.some(
      (inv) => inv.inviteeEmail.toLowerCase() === args.email.toLowerCase()
    );
    if (alreadyPending) throw new Error("Invite already sent to this email");

    await ctx.db.insert("invites", {
      docId: args.docId,
      inviterUserId: userId,
      inviteeEmail: args.email.toLowerCase(),
      role: args.role,
      status: "pending",
    });
  },
});

/** List all collaborators and pending invites for a document. Owner only. */
export const listForDoc = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.ownerId !== userId) return null;

    const collaborators = await ctx.db
      .query("collaborators")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .take(50);

    const collaboratorsWithInfo = await Promise.all(
      collaborators.map(async (collab) => {
        const user = await ctx.db.get(collab.userId);
        return {
          _id: collab._id,
          userId: collab.userId,
          role: collab.role,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: (user as any)?.name ?? null as string | null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          email: (user as any)?.email ?? null as string | null,
        };
      })
    );

    const pendingInvites = await ctx.db
      .query("invites")
      .withIndex("by_doc_and_status", (q) =>
        q.eq("docId", args.docId).eq("status", "pending")
      )
      .take(50);

    return { collaborators: collaboratorsWithInfo, pendingInvites };
  },
});

/** List all pending invites for the current user. */
export const listMyInvites = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const email = await getCurrentUserEmail(ctx, userId);
    if (!email) return [];

    const invites = await ctx.db
      .query("invites")
      .withIndex("by_invitee_email_and_status", (q) =>
        q.eq("inviteeEmail", email.toLowerCase()).eq("status", "pending")
      )
      .take(20);

    return await Promise.all(
      invites.map(async (inv) => {
        const doc = await ctx.db.get(inv.docId);
        const inviter = await ctx.db.get(inv.inviterUserId);
        return {
          _id: inv._id,
          docId: inv.docId,
          docTitle: doc?.title ?? "Untitled Document",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inviterName: (inviter as any)?.name ?? (inviter as any)?.email ?? "Someone",
          role: inv.role,
        };
      })
    );
  },
});

/** Accept a pending invite — creates a collaborator record. */
export const acceptInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.status !== "pending") throw new Error("Invite not found");

    const myEmail = await getCurrentUserEmail(ctx, userId);
    if (!myEmail || myEmail.toLowerCase() !== invite.inviteeEmail.toLowerCase()) {
      throw new Error("Not authorized");
    }

    // Prevent duplicate collaborator entry
    const existing = await ctx.db
      .query("collaborators")
      .withIndex("by_doc_and_user", (q) =>
        q.eq("docId", invite.docId).eq("userId", userId)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("collaborators", {
        docId: invite.docId,
        userId,
        role: invite.role,
      });
    }

    await ctx.db.patch(args.inviteId, { status: "accepted" });
  },
});

/** Decline a pending invite. */
export const declineInvite = mutation({
  args: { inviteId: v.id("invites") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.status !== "pending") throw new Error("Invite not found");

    const myEmail = await getCurrentUserEmail(ctx, userId);
    if (!myEmail || myEmail.toLowerCase() !== invite.inviteeEmail.toLowerCase()) {
      throw new Error("Not authorized");
    }

    await ctx.db.patch(args.inviteId, { status: "declined" });
  },
});

/** Remove a collaborator from a document. Owner only. */
export const removeCollaborator = mutation({
  args: {
    docId: v.id("documents"),
    collaboratorId: v.id("collaborators"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const doc = await ctx.db.get(args.docId);
    if (!doc || doc.ownerId !== userId) throw new Error("Not authorized");

    const collab = await ctx.db.get(args.collaboratorId);
    if (!collab || collab.docId !== args.docId) throw new Error("Collaborator not found");

    await ctx.db.delete(args.collaboratorId);
  },
});
