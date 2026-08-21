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
    // Set when the owner moves the document to the trash. Absent on live
    // documents, so an eq(undefined) index lookup selects exactly those.
    archivedAt: v.optional(v.number()),
  })
    .index("by_owner", ["ownerId"])
    // Matches the order the dashboard shows, so taking a page keeps the
    // documents the user most recently worked on.
    .index("by_owner_and_updated", ["ownerId", "updatedAt"])
    // Lets the dashboard page through live documents without archived ones
    // crowding them out of the take() window, and vice versa for the trash.
    .index("by_owner_and_archived_and_updated", ["ownerId", "archivedAt", "updatedAt"]),

  // One row per (user, document) the user has starred. A separate table rather
  // than a field on documents because starring is per-user: two collaborators
  // can star the same document independently.
  stars: defineTable({
    userId: v.id("users"),
    docId: v.id("documents"),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_doc", ["userId", "docId"])
    .index("by_doc", ["docId"]),

  // Who is looking at which document right now. High-churn heartbeat data,
  // kept away from the documents table so presence writes never contend with
  // document reads. Rows go stale rather than being deleted on tab close —
  // heartbeat() prunes them opportunistically.
  presence: defineTable({
    docId: v.id("documents"),
    userId: v.id("users"),
    lastSeen: v.number(),
  })
    .index("by_doc", ["docId"])
    .index("by_doc_and_user", ["docId", "userId"]),

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

  // Fixed-window counters backing convex/model/rateLimit.ts. One row per
  // (user, action) pair, so the table stays bounded without a cleanup job.
  rateLimits: defineTable({
    key: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_key", ["key"]),

  auditLogs: defineTable({
    action: v.string(),
    userId: v.optional(v.string()),
    docId: v.optional(v.id("documents")),
    metadata: v.optional(v.string()),
    requestId: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_user_and_timestamp", ["userId", "timestamp"])
    .index("by_doc_and_timestamp", ["docId", "timestamp"]),
});
