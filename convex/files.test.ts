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

/** Puts a file in storage and returns its ID. */
async function storeFile(t: ReturnType<typeof setupTest>) {
  return await t.run(async (ctx) => await ctx.storage.store(new Blob(["image bytes"])));
}

describe("files.generateUploadUrl", () => {
  it("issues an upload URL to someone who can edit the document", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const docId = await createDocument(t, owner);

    await expect(
      asUser(t, owner).mutation(api.files.generateUploadUrl, { docId })
    ).resolves.toEqual(expect.any(String));
  });

  it("refuses a viewer, who cannot add images to the document anyway", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const viewer = await createUser(t, "viewer@example.com");
    const docId = await createDocument(t, owner);
    await addCollaborator(t, docId, viewer, "viewer");

    await expect(
      asUser(t, viewer).mutation(api.files.generateUploadUrl, { docId })
    ).rejects.toThrow(/Not authorized/);
  });

  it("refuses a user with no access to the document", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const stranger = await createUser(t, "stranger@example.com");
    const docId = await createDocument(t, owner);

    await expect(
      asUser(t, stranger).mutation(api.files.generateUploadUrl, { docId })
    ).rejects.toThrow(/Not authorized/);
  });

  it("refuses an anonymous caller", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const docId = await createDocument(t, owner);

    await expect(
      t.mutation(api.files.generateUploadUrl, { docId })
    ).rejects.toThrow(/Not authenticated/);
  });
});

describe("files.getImageUrl", () => {
  /** A document that embeds `storageId`, as the editor would save it. */
  async function documentEmbedding(t: ReturnType<typeof setupTest>, ownerId: any, storageId: string) {
    return await createDocument(t, ownerId, {
      content: `<p>before</p><img data-storage-id="${storageId}" data-align="left"><p>after</p>`,
    });
  }

  it("resolves a URL for someone who can read the document", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const viewer = await createUser(t, "viewer@example.com");
    const storageId = await storeFile(t);
    const docId = await documentEmbedding(t, owner, storageId);
    await addCollaborator(t, docId, viewer, "viewer");

    expect(await asUser(t, owner).query(api.files.getImageUrl, { storageId, docId })).toEqual(
      expect.any(String)
    );
    expect(await asUser(t, viewer).query(api.files.getImageUrl, { storageId, docId })).toEqual(
      expect.any(String)
    );
  });

  it("refuses a user with no access to the document", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const stranger = await createUser(t, "stranger@example.com");
    const storageId = await storeFile(t);
    const docId = await documentEmbedding(t, owner, storageId);

    expect(await asUser(t, stranger).query(api.files.getImageUrl, { storageId, docId })).toBeNull();
  });

  it("refuses an anonymous caller", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const storageId = await storeFile(t);
    const docId = await documentEmbedding(t, owner, storageId);

    expect(await t.query(api.files.getImageUrl, { storageId, docId })).toBeNull();
  });

  it("refuses a storage ID the named document does not embed", async () => {
    const t = setupTest();
    const attacker = await createUser(t, "attacker@example.com");
    const victim = await createUser(t, "victim@example.com");

    const secret = await storeFile(t);
    await documentEmbedding(t, victim, secret);

    // The attacker owns a document, so they pass the access check — but the
    // document they name does not embed the file they are asking for.
    const ownDoc = await createDocument(t, attacker, { content: "<p>nothing here</p>" });

    expect(
      await asUser(t, attacker).query(api.files.getImageUrl, { storageId: secret, docId: ownDoc })
    ).toBeNull();
  });

  it("returns null until the document embedding the upload is saved", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const storageId = await storeFile(t);
    const docId = await createDocument(t, owner, { content: "<p>not saved yet</p>" });

    expect(await asUser(t, owner).query(api.files.getImageUrl, { storageId, docId })).toBeNull();

    await asUser(t, owner).mutation(api.documents.update, {
      id: docId,
      content: `<img data-storage-id="${storageId}">`,
    });

    expect(await asUser(t, owner).query(api.files.getImageUrl, { storageId, docId })).toEqual(
      expect.any(String)
    );
  });
});
