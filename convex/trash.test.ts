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
  const stranger = await createUser(t, "stranger@example.com");

  const docId = await createDocument(t, owner, { title: "Plans", content: "<p>original</p>" });
  await addCollaborator(t, docId, editor, "editor");

  return { t, owner, editor, stranger, docId };
}

describe("documents.archive", () => {
  it("moves the document out of the dashboard list and into the trash", async () => {
    const { t, owner, docId } = await scenario();

    await asUser(t, owner).mutation(api.documents.archive, { id: docId });

    const { documents } = await asUser(t, owner).query(api.documents.list, {});
    expect(documents.find((d) => d._id === docId)).toBeUndefined();

    const trash = await asUser(t, owner).query(api.documents.listTrash, {});
    expect(trash.documents.map((d) => d._id)).toEqual([docId]);
    expect(trash.documents[0].archivedAt).toBeTypeOf("number");
  });

  it("hides the document from collaborators while it is in the trash", async () => {
    const { t, owner, editor, docId } = await scenario();
    await asUser(t, owner).mutation(api.documents.archive, { id: docId });

    expect(await asUser(t, editor).query(api.documents.get, { id: docId })).toBeNull();
    const { documents } = await asUser(t, editor).query(api.documents.list, {});
    expect(documents).toEqual([]);
    const trash = await asUser(t, editor).query(api.documents.listTrash, {});
    expect(trash.documents).toEqual([]);
  });

  it("still lets the owner read it, e.g. to preview before restoring", async () => {
    const { t, owner, docId } = await scenario();
    await asUser(t, owner).mutation(api.documents.archive, { id: docId });

    const doc = await asUser(t, owner).query(api.documents.get, { id: docId });
    expect(doc?.title).toBe("Plans");
  });

  it("blocks edits while the document is in the trash", async () => {
    const { t, owner, docId } = await scenario();
    await asUser(t, owner).mutation(api.documents.archive, { id: docId });

    await expect(
      asUser(t, owner).mutation(api.documents.update, { id: docId, title: "Nope" })
    ).rejects.toThrow(/trash/i);
  });

  it("is owner-only", async () => {
    const { t, editor, stranger, docId } = await scenario();
    await expect(
      asUser(t, editor).mutation(api.documents.archive, { id: docId })
    ).rejects.toThrow(/Not authorized/);
    await expect(
      asUser(t, stranger).mutation(api.documents.archive, { id: docId })
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("documents.restore", () => {
  it("puts the document back for the owner and collaborators alike", async () => {
    const { t, owner, editor, docId } = await scenario();
    await asUser(t, owner).mutation(api.documents.archive, { id: docId });
    await asUser(t, owner).mutation(api.documents.restore, { id: docId });

    const { documents } = await asUser(t, editor).query(api.documents.list, {});
    expect(documents.map((d) => d._id)).toContain(docId);

    const trash = await asUser(t, owner).query(api.documents.listTrash, {});
    expect(trash.documents).toEqual([]);

    // Collaborator rows survived the round trip.
    expect(
      (await asUser(t, editor).query(api.documents.get, { id: docId }))?.userRole
    ).toBe("editor");
  });

  it("makes the document editable again", async () => {
    const { t, owner, docId } = await scenario();
    await asUser(t, owner).mutation(api.documents.archive, { id: docId });
    await asUser(t, owner).mutation(api.documents.restore, { id: docId });

    await asUser(t, owner).mutation(api.documents.update, { id: docId, title: "Back" });
    const doc = await t.run(async (ctx) => await ctx.db.get(docId));
    expect(doc?.title).toBe("Back");
  });

  it("is owner-only", async () => {
    const { t, owner, editor, docId } = await scenario();
    await asUser(t, owner).mutation(api.documents.archive, { id: docId });
    await expect(
      asUser(t, editor).mutation(api.documents.restore, { id: docId })
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("documents.remove from the trash", () => {
  it("permanently deletes an archived document", async () => {
    const { t, owner, docId } = await scenario();
    await asUser(t, owner).mutation(api.documents.archive, { id: docId });
    await asUser(t, owner).mutation(api.documents.remove, { id: docId });

    expect(await t.run(async (ctx) => await ctx.db.get(docId))).toBeNull();
  });

  it("cleans up stars and presence rows with the document", async () => {
    const { t, owner, editor, docId } = await scenario();
    await asUser(t, editor).mutation(api.stars.toggle, { docId });
    await asUser(t, editor).mutation(api.presence.heartbeat, { docId });

    await asUser(t, owner).mutation(api.documents.remove, { id: docId });

    const leftovers = await t.run(async (ctx) => ({
      stars: await ctx.db
        .query("stars")
        .withIndex("by_doc", (q) => q.eq("docId", docId))
        .collect(),
      presence: await ctx.db
        .query("presence")
        .withIndex("by_doc", (q) => q.eq("docId", docId))
        .collect(),
    }));
    expect(leftovers.stars).toEqual([]);
    expect(leftovers.presence).toEqual([]);
  });
});
