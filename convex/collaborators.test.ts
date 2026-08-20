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
  const invitee = await createUser(t, "invitee@example.com");
  const stranger = await createUser(t, "stranger@example.com");

  const docId = await createDocument(t, owner);
  await addCollaborator(t, docId, editor, "editor");

  return { t, owner, editor, invitee, stranger, docId };
}

describe("collaborators.invite", () => {
  it("lets the owner invite by email", async () => {
    const { t, owner, docId } = await scenario();

    await asUser(t, owner).mutation(api.collaborators.invite, {
      docId,
      email: "invitee@example.com",
      role: "editor",
    });

    const invites = await t.run(async (ctx) =>
      await ctx.db
        .query("invites")
        .withIndex("by_doc_and_status", (q) => q.eq("docId", docId).eq("status", "pending"))
        .collect()
    );
    expect(invites).toHaveLength(1);
    expect(invites[0].inviteeEmail).toBe("invitee@example.com");
  });

  it("normalises the invited address to lower case", async () => {
    const { t, owner, docId } = await scenario();

    await asUser(t, owner).mutation(api.collaborators.invite, {
      docId,
      email: "Invitee@Example.COM",
      role: "viewer",
    });

    const invites = await asUser(t, await createUser(t, "x@example.com")).query(
      api.collaborators.listMyInvites,
      {}
    );
    expect(invites).toEqual([]);

    const stored = await t.run(async (ctx) =>
      await ctx.db
        .query("invites")
        .withIndex("by_doc_and_status", (q) => q.eq("docId", docId).eq("status", "pending"))
        .collect()
    );
    expect(stored[0].inviteeEmail).toBe("invitee@example.com");
  });

  it("stops an editor inviting others", async () => {
    const { t, editor, docId } = await scenario();

    await expect(
      asUser(t, editor).mutation(api.collaborators.invite, {
        docId,
        email: "someone@example.com",
        role: "editor",
      })
    ).rejects.toThrow(/Not authorized/);
  });

  it("stops a user with no access inviting others", async () => {
    const { t, stranger, docId } = await scenario();

    await expect(
      asUser(t, stranger).mutation(api.collaborators.invite, {
        docId,
        email: "someone@example.com",
        role: "editor",
      })
    ).rejects.toThrow(/Not authorized/);
  });

  it("rejects a malformed email address", async () => {
    const { t, owner, docId } = await scenario();

    await expect(
      asUser(t, owner).mutation(api.collaborators.invite, {
        docId,
        email: "not-an-email",
        role: "editor",
      })
    ).rejects.toThrow(/valid email/i);
  });

  it("rejects a duplicate pending invite", async () => {
    const { t, owner, docId } = await scenario();
    const args = { docId, email: "invitee@example.com", role: "editor" as const };

    await asUser(t, owner).mutation(api.collaborators.invite, args);
    await expect(asUser(t, owner).mutation(api.collaborators.invite, args)).rejects.toThrow(
      /already sent/i
    );
  });

  it("rejects inviting yourself", async () => {
    const { t, owner, docId } = await scenario();

    await expect(
      asUser(t, owner).mutation(api.collaborators.invite, {
        docId,
        email: "owner@example.com",
        role: "editor",
      })
    ).rejects.toThrow(/yourself/i);
  });
});

describe("collaborators.listForDoc", () => {
  it("returns collaborators and pending invites to the owner", async () => {
    const { t, owner, docId } = await scenario();
    await asUser(t, owner).mutation(api.collaborators.invite, {
      docId,
      email: "invitee@example.com",
      role: "viewer",
    });

    const result = await asUser(t, owner).query(api.collaborators.listForDoc, { docId });
    expect(result?.collaborators).toHaveLength(1);
    expect(result?.collaborators[0].email).toBe("editor@example.com");
    expect(result?.pendingInvites).toHaveLength(1);
  });

  it("hides the collaborator list from an editor", async () => {
    const { t, editor, docId } = await scenario();
    expect(await asUser(t, editor).query(api.collaborators.listForDoc, { docId })).toBeNull();
  });

  it("hides the collaborator list from a user with no access", async () => {
    const { t, stranger, docId } = await scenario();
    expect(await asUser(t, stranger).query(api.collaborators.listForDoc, { docId })).toBeNull();
  });
});

describe("collaborators.acceptInvite", () => {
  async function pendingInvite() {
    const s = await scenario();
    await asUser(s.t, s.owner).mutation(api.collaborators.invite, {
      docId: s.docId,
      email: "invitee@example.com",
      role: "editor",
    });
    const [invite] = await asUser(s.t, s.invitee).query(api.collaborators.listMyInvites, {});
    return { ...s, inviteId: invite._id };
  }

  it("grants the invited role and gives access to the document", async () => {
    const { t, invitee, docId, inviteId } = await pendingInvite();

    await asUser(t, invitee).mutation(api.collaborators.acceptInvite, { inviteId });

    const doc = await asUser(t, invitee).query(api.documents.get, { id: docId });
    expect(doc?.userRole).toBe("editor");
  });

  it("stops someone else accepting an invite addressed to another person", async () => {
    const { t, stranger, inviteId } = await pendingInvite();

    await expect(
      asUser(t, stranger).mutation(api.collaborators.acceptInvite, { inviteId })
    ).rejects.toThrow(/Not authorized/);
  });

  it("cannot be accepted twice", async () => {
    const { t, invitee, inviteId } = await pendingInvite();

    await asUser(t, invitee).mutation(api.collaborators.acceptInvite, { inviteId });
    await expect(
      asUser(t, invitee).mutation(api.collaborators.acceptInvite, { inviteId })
    ).rejects.toThrow(/Invite not found/);
  });

  it("declining leaves the document inaccessible", async () => {
    const { t, invitee, docId, inviteId } = await pendingInvite();

    await asUser(t, invitee).mutation(api.collaborators.declineInvite, { inviteId });
    expect(await asUser(t, invitee).query(api.documents.get, { id: docId })).toBeNull();
  });
});

describe("collaborators.removeCollaborator", () => {
  it("revokes the collaborator's access", async () => {
    const { t, owner, editor, docId } = await scenario();
    const result = await asUser(t, owner).query(api.collaborators.listForDoc, { docId });
    const collaboratorId = result!.collaborators[0]._id;

    await asUser(t, owner).mutation(api.collaborators.removeCollaborator, { docId, collaboratorId });

    expect(await asUser(t, editor).query(api.documents.get, { id: docId })).toBeNull();
  });

  it("stops an editor removing collaborators", async () => {
    const { t, owner, editor, docId } = await scenario();
    const result = await asUser(t, owner).query(api.collaborators.listForDoc, { docId });
    const collaboratorId = result!.collaborators[0]._id;

    await expect(
      asUser(t, editor).mutation(api.collaborators.removeCollaborator, { docId, collaboratorId })
    ).rejects.toThrow(/Not authorized/);
  });

  it("stops removing a collaborator that belongs to a different document", async () => {
    const { t, owner, editor, docId } = await scenario();
    const otherDoc = await createDocument(t, owner);
    const otherCollaborator = await addCollaborator(t, otherDoc, editor, "editor");

    await expect(
      asUser(t, owner).mutation(api.collaborators.removeCollaborator, {
        docId,
        collaboratorId: otherCollaborator,
      })
    ).rejects.toThrow(/not found/i);
  });
});
