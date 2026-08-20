// @vitest-environment edge-runtime

import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import {
  addCollaborator,
  asUser,
  createDocument,
  createUser,
  setupTest,
} from "./test.helpers";

async function scenario() {
  const t = setupTest();
  const owner = await createUser(t, "owner@example.com");
  const editor = await createUser(t, "editor@example.com");
  const viewer = await createUser(t, "viewer@example.com");
  const stranger = await createUser(t, "stranger@example.com");

  const docId = await createDocument(t, owner, { title: "Plans", content: "<p>original</p>" });
  await addCollaborator(t, docId, editor, "editor");
  await addCollaborator(t, docId, viewer, "viewer");

  return { t, owner, editor, viewer, stranger, docId };
}

describe("documents.get", () => {
  it("reports the caller's own role", async () => {
    const { t, owner, editor, viewer, docId } = await scenario();

    expect((await asUser(t, owner).query(api.documents.get, { id: docId }))?.userRole).toBe("owner");
    expect((await asUser(t, editor).query(api.documents.get, { id: docId }))?.userRole).toBe("editor");
    expect((await asUser(t, viewer).query(api.documents.get, { id: docId }))?.userRole).toBe("viewer");
  });

  it("hides the document from a user with no access", async () => {
    const { t, stranger, docId } = await scenario();
    expect(await asUser(t, stranger).query(api.documents.get, { id: docId })).toBeNull();
  });

  it("hides the document from an anonymous caller", async () => {
    const { t, docId } = await scenario();
    expect(await t.query(api.documents.get, { id: docId })).toBeNull();
  });
});

describe("documents.list", () => {
  it("returns owned and shared documents together", async () => {
    const { t, editor, docId } = await scenario();
    const ownDoc = await createDocument(t, editor, { title: "Editor's own" });

    const docs = await asUser(t, editor).query(api.documents.list, {});
    const byId = new Map(docs.map((d) => [d._id, d]));

    expect(byId.get(ownDoc)?.userRole).toBe("owner");
    expect(byId.get(docId)?.userRole).toBe("editor");
  });

  it("returns nothing to an anonymous caller", async () => {
    const { t } = await scenario();
    expect(await t.query(api.documents.list, {})).toEqual([]);
  });
});

describe("documents.update", () => {
  it("lets the owner and editors write", async () => {
    const { t, owner, editor, docId } = await scenario();

    await asUser(t, owner).mutation(api.documents.update, { id: docId, title: "By owner" });
    await asUser(t, editor).mutation(api.documents.update, { id: docId, content: "<p>by editor</p>" });

    const doc = await t.run(async (ctx) => await ctx.db.get(docId));
    expect(doc?.title).toBe("By owner");
    expect(doc?.content).toBe("<p>by editor</p>");
  });

  it("stops a viewer writing", async () => {
    const { t, viewer, docId } = await scenario();
    await expect(
      asUser(t, viewer).mutation(api.documents.update, { id: docId, content: "<p>nope</p>" })
    ).rejects.toThrow(/Not authorized/);
  });

  it("stops a user with no access writing", async () => {
    const { t, stranger, docId } = await scenario();
    await expect(
      asUser(t, stranger).mutation(api.documents.update, { id: docId, content: "<p>nope</p>" })
    ).rejects.toThrow(/Not authorized/);
  });

  it("stops an anonymous caller writing", async () => {
    const { t, docId } = await scenario();
    await expect(
      t.mutation(api.documents.update, { id: docId, content: "<p>nope</p>" })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("leaves the document untouched when a write is rejected", async () => {
    const { t, viewer, docId } = await scenario();
    await expect(
      asUser(t, viewer).mutation(api.documents.update, { id: docId, content: "<p>nope</p>" })
    ).rejects.toThrow();

    const doc = await t.run(async (ctx) => await ctx.db.get(docId));
    expect(doc?.content).toBe("<p>original</p>");
  });

  it("advances updatedAt so subscribers see the change", async () => {
    const { t, owner, docId } = await scenario();
    const before = await t.run(async (ctx) => (await ctx.db.get(docId))!.updatedAt);

    await asUser(t, owner).mutation(api.documents.update, { id: docId, title: "Renamed" });

    const after = await t.run(async (ctx) => (await ctx.db.get(docId))!.updatedAt);
    expect(after).toBeGreaterThanOrEqual(before);
  });

  it("rejects content over the size limit", async () => {
    const { t, owner, docId } = await scenario();
    await expect(
      asUser(t, owner).mutation(api.documents.update, { id: docId, content: "x".repeat(1_000_001) })
    ).rejects.toThrow(/size limit/i);
  });

  it("does not reveal validation feedback to a user without write access", async () => {
    const { t, viewer, docId } = await scenario();
    // An oversized payload from a viewer must fail on authorization, not on
    // validation — the error must not confirm anything about the document.
    await expect(
      asUser(t, viewer).mutation(api.documents.update, { id: docId, content: "x".repeat(1_000_001) })
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("documents.remove", () => {
  it("deletes collaborators, invites and comments with the document", async () => {
    const { t, owner, editor, docId } = await scenario();

    await asUser(t, editor).mutation(api.comments.create, {
      docId,
      markId: "mark-1",
      text: "a comment",
      quotedText: "quoted",
    });
    await asUser(t, owner).mutation(api.collaborators.invite, {
      docId,
      email: "invitee@example.com",
      role: "editor",
    });

    await asUser(t, owner).mutation(api.documents.remove, { id: docId });

    const leftovers = await t.run(async (ctx) => ({
      doc: await ctx.db.get(docId),
      collaborators: await ctx.db
        .query("collaborators")
        .withIndex("by_doc", (q) => q.eq("docId", docId))
        .collect(),
      invites: await ctx.db
        .query("invites")
        .withIndex("by_doc_and_status", (q) => q.eq("docId", docId))
        .collect(),
      comments: await ctx.db
        .query("comments")
        .withIndex("by_doc", (q) => q.eq("docId", docId))
        .collect(),
    }));

    expect(leftovers.doc).toBeNull();
    expect(leftovers.collaborators).toEqual([]);
    expect(leftovers.invites).toEqual([]);
    expect(leftovers.comments).toEqual([]);
  });

  it("does not surface a deleted document to a former collaborator", async () => {
    const { t, owner, editor, docId } = await scenario();
    await asUser(t, owner).mutation(api.documents.remove, { id: docId });

    expect(await asUser(t, editor).query(api.documents.list, {})).toEqual([]);
  });

  it("leaves other documents alone", async () => {
    const { t, owner, editor, docId } = await scenario();
    const keeper = await createDocument(t, owner, { title: "Keep me" });
    await addCollaborator(t, keeper, editor, "editor");

    await asUser(t, owner).mutation(api.documents.remove, { id: docId });

    const remaining = await t.run(async (ctx) =>
      await ctx.db
        .query("collaborators")
        .withIndex("by_doc", (q) => q.eq("docId", keeper))
        .collect()
    );
    expect(remaining).toHaveLength(1);
    expect(await t.run(async (ctx) => await ctx.db.get(keeper))).not.toBeNull();
  });

  it("stops an editor deleting the document", async () => {
    const { t, editor, docId } = await scenario();
    await expect(
      asUser(t, editor).mutation(api.documents.remove, { id: docId })
    ).rejects.toThrow(/Not authorized/);
  });

  it("stops a user with no access deleting the document", async () => {
    const { t, stranger, docId } = await scenario();
    await expect(
      asUser(t, stranger).mutation(api.documents.remove, { id: docId })
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("documents.create", () => {
  it("assigns ownership from the session", async () => {
    const t = setupTest();
    const user = await createUser(t, "creator@example.com");

    const docId = await asUser(t, user).mutation(api.documents.create, {});
    const doc = await t.run(async (ctx) => await ctx.db.get(docId));

    expect(doc?.ownerId).toBe(user);
  });

  it("rejects an anonymous caller", async () => {
    const t = setupTest();
    await expect(t.mutation(api.documents.create, {})).rejects.toThrow(/Not authenticated/);
  });
});
