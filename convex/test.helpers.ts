/// <reference types="vite/client" />
// Shared setup for Convex function tests.
//
// The double dot in the filename keeps this out of a deploy: the Convex
// bundler skips any file in convex/ whose basename contains more than one dot,
// which is also why the test files themselves are safe to colocate here.

import { convexTest, type TestConvex as ConvexTestClient } from "convex-test";
import schema from "./schema";
import type { Id } from "./_generated/dataModel";

// Resolved relative to convex/, so convex-test sees every function module.
const modules = import.meta.glob("./**/*.ts");

// Bound to this app's schema, so ctx.db in t.run() is typed against the real
// tables rather than falling back to the system tables only.
export type TestConvex = ConvexTestClient<typeof schema>;

export function setupTest(): TestConvex {
  return convexTest(schema, modules);
}

/** Creates a user row and returns its ID. */
export async function createUser(t: TestConvex, email: string): Promise<Id<"users">> {
  return await t.run(async (ctx) => await ctx.db.insert("users", { email }));
}

/**
 * A client acting as `userId`.
 *
 * getAuthUserId() reads the user ID from the identity's subject claim, taking
 * everything before the session divider, so the bare ID is a valid subject.
 */
export function asUser(t: TestConvex, userId: Id<"users">) {
  return t.withIdentity({ subject: userId });
}

/** Creates a document owned by `ownerId` and returns its ID. */
export async function createDocument(
  t: TestConvex,
  ownerId: Id<"users">,
  fields: { title?: string; content?: string } = {}
): Promise<Id<"documents">> {
  const now = Date.now();
  return await t.run(async (ctx) =>
    await ctx.db.insert("documents", {
      title: fields.title ?? "Test Document",
      content: fields.content ?? "<p>body</p>",
      ownerId,
      createdAt: now,
      updatedAt: now,
    })
  );
}

/** Grants `userId` a role on `docId`. */
export async function addCollaborator(
  t: TestConvex,
  docId: Id<"documents">,
  userId: Id<"users">,
  role: "editor" | "viewer"
): Promise<Id<"collaborators">> {
  return await t.run(async (ctx) =>
    await ctx.db.insert("collaborators", { docId, userId, role })
  );
}
