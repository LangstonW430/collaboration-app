// @vitest-environment edge-runtime
//
// documents.duplicate and documents.search — features layered on top of the
// core CRUD covered in documents.test.ts.

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
  const viewer = await createUser(t, "viewer@example.com");
  const stranger = await createUser(t, "stranger@example.com");

  const docId = await createDocument(t, owner, {
    title: "Quarterly plan",
    content: "<p>Ship the <strong>reporting</strong> dashboard</p>",
  });
  await addCollaborator(t, docId, viewer, "viewer");

  return { t, owner, viewer, stranger, docId };
}

describe("documents.duplicate", () => {
  it("copies title and content into a document the caller owns", async () => {
    const { t, owner, docId } = await scenario();

    const copyId = await asUser(t, owner).mutation(api.documents.duplicate, { id: docId });
    const copy = await t.run(async (ctx) => await ctx.db.get(copyId!));

    expect(copy?.title).toBe("Quarterly plan (copy)");
    expect(copy?.content).toBe("<p>Ship the <strong>reporting</strong> dashboard</p>");
    expect(copy?.ownerId).toBe(owner);
  });

  it("makes a viewer the owner of their copy, with no shared collaborators", async () => {
    const { t, viewer, docId } = await scenario();

    const copyId = await asUser(t, viewer).mutation(api.documents.duplicate, { id: docId });
    const copy = await t.run(async (ctx) => await ctx.db.get(copyId!));
    expect(copy?.ownerId).toBe(viewer);

    const collaborators = await t.run(async (ctx) =>
      await ctx.db
        .query("collaborators")
        .withIndex("by_doc", (q) => q.eq("docId", copyId!))
        .collect()
    );
    expect(collaborators).toEqual([]);
  });

  it("leaves the original untouched", async () => {
    const { t, owner, docId } = await scenario();
    await asUser(t, owner).mutation(api.documents.duplicate, { id: docId });

    const original = await t.run(async (ctx) => await ctx.db.get(docId));
    expect(original?.title).toBe("Quarterly plan");
  });

  it("rejects a user with no access to the source", async () => {
    const { t, stranger, docId } = await scenario();
    await expect(
      asUser(t, stranger).mutation(api.documents.duplicate, { id: docId })
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("documents.search", () => {
  it("matches words in the title", async () => {
    const { t, owner, docId } = await scenario();
    const { documents } = await asUser(t, owner).query(api.documents.search, { query: "quarterly" });
    expect(documents.map((d) => d._id)).toEqual([docId]);
  });

  it("matches words in the body, ignoring markup", async () => {
    const { t, owner, docId } = await scenario();
    const { documents } = await asUser(t, owner).query(api.documents.search, { query: "REPORTING dashboard" });
    expect(documents.map((d) => d._id)).toEqual([docId]);

    // "strong" only appears as a tag, not as text.
    const byTag = await asUser(t, owner).query(api.documents.search, { query: "strong" });
    expect(byTag.documents).toEqual([]);
  });

  it("requires every word to match", async () => {
    const { t, owner } = await scenario();
    const { documents } = await asUser(t, owner).query(api.documents.search, {
      query: "quarterly zebra",
    });
    expect(documents).toEqual([]);
  });

  it("searches documents shared with the caller", async () => {
    const { t, viewer, docId } = await scenario();
    const { documents } = await asUser(t, viewer).query(api.documents.search, { query: "reporting" });
    expect(documents.map((d) => d._id)).toEqual([docId]);
    expect(documents[0].userRole).toBe("viewer");
  });

  it("never returns documents the caller cannot read", async () => {
    const { t, stranger } = await scenario();
    const { documents } = await asUser(t, stranger).query(api.documents.search, { query: "quarterly" });
    expect(documents).toEqual([]);
  });

  it("skips documents in the trash", async () => {
    const { t, owner, docId } = await scenario();
    await asUser(t, owner).mutation(api.documents.archive, { id: docId });
    const { documents } = await asUser(t, owner).query(api.documents.search, { query: "quarterly" });
    expect(documents).toEqual([]);
  });

  it("matches nothing on a blank query", async () => {
    const { t, owner } = await scenario();
    const { documents } = await asUser(t, owner).query(api.documents.search, { query: "   " });
    expect(documents).toEqual([]);
  });
});
