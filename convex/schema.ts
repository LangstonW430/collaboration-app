import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Auth tables managed by @convex-dev/auth (users, sessions, accounts, etc.)
  ...authTables,

  documents: defineTable({
    title: v.string(),
    content: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  collaborators: defineTable({
    docId: v.id("documents"),
    userId: v.id("users"),
    role: v.union(
      v.literal("editor"),
      v.literal("viewer")
    ),
  })
    .index("by_doc", ["docId"])
    .index("by_user", ["userId"])
    .index("by_doc_and_user", ["docId", "userId"]),

  invites: defineTable({
    docId: v.id("documents"),
    inviterUserId: v.id("users"),
    inviteeEmail: v.string(),
    role: v.union(v.literal("editor"), v.literal("viewer")),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("declined")),
  })
    .index("by_doc_and_status", ["docId", "status"])
    .index("by_invitee_email_and_status", ["inviteeEmail", "status"]),

  comments: defineTable({
    docId: v.id("documents"),
    authorId: v.id("users"),
    markId: v.string(),
    text: v.string(),
    quotedText: v.string(),
    resolved: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_doc", ["docId"])
    .index("by_doc_and_resolved", ["docId", "resolved"]),
});
