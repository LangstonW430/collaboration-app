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
  const viewer = await createUser(t, "viewer@example.com");
  const stranger = await createUser(t, "stranger@example.com");

  const docId = await createDocument(t, owner, { title: "Starrable" });
  await addCollaborator(t, docId, viewer, "viewer");

  return { t, owner, viewer, stranger, docId };
}

describe("stars.toggle", () => {
  it("stars and unstars, reporting the new state", async () => {
    const { t, owner, docId } = await scenario();

    expect(await asUser(t, owner).mutation(api.stars.toggle, { docId })).toEqual({ starred: true });
    expect(await asUser(t, owner).mutation(api.stars.toggle, { docId })).toEqual({ starred: false });
  });

  it("shows up as starred in the document list", async () => {
    const { t, owner, docId } = await scenario();
    await asUser(t, owner).mutation(api.stars.toggle, { docId });

    const { documents } = await asUser(t, owner).query(api.documents.list, {});
    expect(documents.find((d) => d._id === docId)?.starred).toBe(true);
  });

  it("is per-user: one collaborator's star is invisible to another", async () => {
    const { t, owner, viewer, docId } = await scenario();
    await asUser(t, viewer).mutation(api.stars.toggle, { docId });

    const ownerList = await asUser(t, owner).query(api.documents.list, {});
    expect(ownerList.documents.find((d) => d._id === docId)?.starred).toBe(false);

    const viewerList = await asUser(t, viewer).query(api.documents.list, {});
    expect(viewerList.documents.find((d) => d._id === docId)?.starred).toBe(true);
  });

  it("lets viewers star documents shared with them", async () => {
    const { t, viewer, docId } = await scenario();
    expect(await asUser(t, viewer).mutation(api.stars.toggle, { docId })).toEqual({ starred: true });
  });

  it("rejects a user with no access to the document", async () => {
    const { t, stranger, docId } = await scenario();
    await expect(
      asUser(t, stranger).mutation(api.stars.toggle, { docId })
    ).rejects.toThrow(/Not authorized/);
  });

  it("rejects an anonymous caller", async () => {
    const { t, docId } = await scenario();
    await expect(t.mutation(api.stars.toggle, { docId })).rejects.toThrow(/Not authenticated/);
  });
});
