import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { inviteFieldsSchema } from "../lib/validation/documentSchema";
import { getDocumentAccess, requireDocumentOwner } from "./model/documentAccess";
import { AUDIT_ACTIONS, recordAudit } from "./model/audit";
import { enforceRateLimit } from "./model/rateLimit";

async function getCurrentUserEmail(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<string | null> {
  const user = await ctx.db.get(userId);
  return user?.email ?? null;
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

    const validation = inviteFieldsSchema.safeParse({ email: args.email });
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? "Validation failed";
      console.error("[collaborators.invite] Validation failure", { userId, issues: validation.error.issues });
      throw new Error(message);
    }

    await requireDocumentOwner(ctx, args.docId);
    await enforceRateLimit(ctx, userId, "collaborators.invite");

    const inviteeEmail = validation.data.email.toLowerCase();

    // Prevent inviting yourself
    const myEmail = await getCurrentUserEmail(ctx, userId);
    if (myEmail && myEmail.toLowerCase() === inviteeEmail) {
      throw new Error("Cannot invite yourself");
    }

    // Looked up by email rather than by scanning a page of the document's
    // invites, which would miss a duplicate on a document with many pending.
    const pendingForEmail = await ctx.db
      .query("invites")
      .withIndex("by_invitee_email_and_status", (q) =>
        q.eq("inviteeEmail", inviteeEmail).eq("status", "pending")
      )
      .collect();

    if (pendingForEmail.some((inv) => inv.docId === args.docId)) {
      throw new Error("Invite already sent to this email");
    }

    await ctx.db.insert("invites", {
      docId: args.docId,
      inviterUserId: userId,
      inviteeEmail,
      role: args.role,
      status: "pending",
    });

    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.COLLABORATOR_INVITED,
      userId,
      docId: args.docId,
      metadata: { inviteeEmail, role: args.role },
    });
  },
});

/** List all collaborators and pending invites for a document. Owner only. */
export const listForDoc = query({
  args: { docId: v.id("documents") },
  handler: async (ctx, args) => {
    const access = await getDocumentAccess(ctx, args.docId);
    if (!access || access.role !== "owner") return null;

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
          name: user?.name ?? null,
          email: user?.email ?? null,
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
          inviterName: inviter?.name ?? inviter?.email ?? "Someone",
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

    if (existing === null) {
      await ctx.db.insert("collaborators", {
        docId: invite.docId,
        userId,
        role: invite.role,
      });
    } else if (existing.role !== invite.role) {
      // Already a collaborator in a different role. The owner sent this invite
      // to change it, so accepting applies the new role — previously the invite
      // was marked accepted and the old role silently kept, which is how an
      // owner promoted a viewer to editor and nothing happened.
      await ctx.db.patch(existing._id, { role: invite.role });
    }

    await ctx.db.patch(args.inviteId, { status: "accepted" });

    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.COLLABORATOR_ADDED,
      userId,
      docId: invite.docId,
      metadata: { role: invite.role, viaInvite: args.inviteId },
    });
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

    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.INVITE_DECLINED,
      userId,
      docId: invite.docId,
    });
  },
});

/** Remove a collaborator from a document. Owner only. */
export const removeCollaborator = mutation({
  args: {
    docId: v.id("documents"),
    collaboratorId: v.id("collaborators"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireDocumentOwner(ctx, args.docId);

    const collab = await ctx.db.get(args.collaboratorId);
    if (!collab || collab.docId !== args.docId) throw new Error("Collaborator not found");

    await ctx.db.delete(args.collaboratorId);

    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.COLLABORATOR_REMOVED,
      userId,
      docId: args.docId,
      metadata: { removedUserId: collab.userId, role: collab.role },
    });
  },
});
