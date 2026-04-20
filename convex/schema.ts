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

  // Phase 2: collaborator access control (not used in MVP)
  collaborators: defineTable({
    docId: v.id("documents"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("editor"),
      v.literal("viewer")
    ),
  })
    .index("by_doc", ["docId"])
    .index("by_user", ["userId"]),
});
