// @vitest-environment edge-runtime

import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import {
  addCollaborator,
  asUser,
  createDocument,
  createUser,
  setupTest,
  type TestConvex,
} from "./test.helpers";

async function auditTrail(t: TestConvex) {
  return await t.query(internal.logging.getAuditLogs, { limit: 50 });
}

describe("audit trail", () => {
  it("records who created a document", async () => {
    const t = setupTest();
    const user = await createUser(t, "creator@example.com");

    const docId = await asUser(t, user).mutation(api.documents.create, {});

    const [entry] = await auditTrail(t);
    expect(entry.action).toBe("DOCUMENT_CREATED");
    expect(entry.userId).toBe(user);
    expect(entry.docId).toBe(docId);
  });

  it("records a deletion with what it took down", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const editor = await createUser(t, "editor@example.com");
    const docId = await createDocument(t, owner, { title: "Roadmap" });
    await addCollaborator(t, docId, editor, "editor");
    await asUser(t, editor).mutation(api.comments.create, {
      docId,
      markId: "m1",
      text: "a note",
      quotedText: "q",
    });

    await asUser(t, owner).mutation(api.documents.remove, { id: docId });

    const [entry] = await auditTrail(t);
    expect(entry.action).toBe("DOCUMENT_DELETED");
    expect(entry.userId).toBe(owner);
    expect(JSON.parse(entry.metadata!)).toMatchObject({
      title: "Roadmap",
      collaboratorsRemoved: 1,
      commentsRemoved: 1,
    });
  });

  it("records the whole invite lifecycle", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const invitee = await createUser(t, "invitee@example.com");
    const docId = await createDocument(t, owner);

    await asUser(t, owner).mutation(api.collaborators.invite, {
      docId,
      email: "invitee@example.com",
      role: "editor",
    });
    const [invite] = await asUser(t, invitee).query(api.collaborators.listMyInvites, {});
    await asUser(t, invitee).mutation(api.collaborators.acceptInvite, { inviteId: invite._id });

    const actions = (await auditTrail(t)).map((entry) => entry.action);
    expect(actions).toContain("COLLABORATOR_INVITED");
    expect(actions).toContain("COLLABORATOR_ADDED");
  });

  it("records who revoked access, and whose", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const editor = await createUser(t, "editor@example.com");
    const docId = await createDocument(t, owner);
    await addCollaborator(t, docId, editor, "editor");

    const listed = await asUser(t, owner).query(api.collaborators.listForDoc, { docId });
    await asUser(t, owner).mutation(api.collaborators.removeCollaborator, {
      docId,
      collaboratorId: listed!.collaborators[0]._id,
    });

    const [entry] = await auditTrail(t);
    expect(entry.action).toBe("COLLABORATOR_REMOVED");
    expect(entry.userId).toBe(owner);
    expect(JSON.parse(entry.metadata!)).toMatchObject({ removedUserId: editor, role: "editor" });
  });

  it("does not record ordinary edits, which autosave makes constantly", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const docId = await createDocument(t, owner);

    for (const title of ["a", "ab", "abc"]) {
      await asUser(t, owner).mutation(api.documents.update, { id: docId, title });
    }

    expect(await auditTrail(t)).toEqual([]);
  });

  it("writes nothing when the mutation it belongs to is rejected", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const stranger = await createUser(t, "stranger@example.com");
    const docId = await createDocument(t, owner);

    await expect(
      asUser(t, stranger).mutation(api.documents.remove, { id: docId })
    ).rejects.toThrow();

    expect(await auditTrail(t)).toEqual([]);
  });

  it("attributes the action to the session, and can be read back per document", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const docId = await asUser(t, owner).mutation(api.documents.create, {});
    const otherDoc = await asUser(t, owner).mutation(api.documents.create, {});

    const forDoc = await t.query(internal.logging.getAuditLogs, { limit: 10, docId });
    expect(forDoc).toHaveLength(1);
    expect(forDoc[0].docId).toBe(docId);
    expect(forDoc[0].docId).not.toBe(otherDoc);
  });
});
