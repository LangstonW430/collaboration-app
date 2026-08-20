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

/**
 * Sets up a document with an owner, an editor, a viewer, and an unrelated user
 * who has no relationship to it at all.
 */
async function scenario() {
  const t = setupTest();
  const owner = await createUser(t, "owner@example.com");
  const editor = await createUser(t, "editor@example.com");
  const viewer = await createUser(t, "viewer@example.com");
  const stranger = await createUser(t, "stranger@example.com");

  const docId = await createDocument(t, owner);
  await addCollaborator(t, docId, editor, "editor");
  await addCollaborator(t, docId, viewer, "viewer");

  return { t, owner, editor, viewer, stranger, docId };
}

async function addComment(
  t: ReturnType<typeof setupTest>,
  userId: Awaited<ReturnType<typeof createUser>>,
  docId: Awaited<ReturnType<typeof createDocument>>,
  text = "a comment"
) {
  return await asUser(t, userId).mutation(api.comments.create, {
    docId,
    markId: "mark-1",
    text,
    quotedText: "quoted",
  });
}

describe("comments.list", () => {
  it("returns comments to the document owner", async () => {
    const { t, owner, docId } = await scenario();
    await addComment(t, owner, docId, "owner comment");

    const comments = await asUser(t, owner).query(api.comments.list, { docId });
    expect(comments).toHaveLength(1);
    expect(comments[0].text).toBe("owner comment");
    expect(comments[0].authorEmail).toBe("owner@example.com");
  });

  it("returns comments to collaborators of either role", async () => {
    const { t, owner, editor, viewer, docId } = await scenario();
    await addComment(t, owner, docId);

    expect(await asUser(t, editor).query(api.comments.list, { docId })).toHaveLength(1);
    expect(await asUser(t, viewer).query(api.comments.list, { docId })).toHaveLength(1);
  });

  it("returns nothing to a signed-in user with no access to the document", async () => {
    const { t, owner, stranger, docId } = await scenario();
    await addComment(t, owner, docId, "confidential");

    expect(await asUser(t, stranger).query(api.comments.list, { docId })).toEqual([]);
  });

  it("returns nothing to an anonymous caller", async () => {
    const { t, owner, docId } = await scenario();
    await addComment(t, owner, docId);

    expect(await t.query(api.comments.list, { docId })).toEqual([]);
  });

  it("omits resolved comments", async () => {
    const { t, owner, docId } = await scenario();
    const commentId = await addComment(t, owner, docId);
    await asUser(t, owner).mutation(api.comments.resolve, { commentId });

    expect(await asUser(t, owner).query(api.comments.list, { docId })).toEqual([]);
  });
});

describe("comments.create", () => {
  it("lets an editor comment", async () => {
    const { t, editor, docId } = await scenario();
    await expect(addComment(t, editor, docId)).resolves.toBeDefined();
  });

  it("lets a viewer comment without being able to edit the document", async () => {
    const { t, viewer, docId } = await scenario();
    await expect(addComment(t, viewer, docId)).resolves.toBeDefined();

    await expect(
      asUser(t, viewer).mutation(api.documents.update, { id: docId, content: "<p>nope</p>" })
    ).rejects.toThrow(/Not authorized/);
  });

  it("rejects a user with no access to the document", async () => {
    const { t, stranger, docId } = await scenario();
    await expect(addComment(t, stranger, docId)).rejects.toThrow(/Not authorized/);
  });

  it("rejects an anonymous caller", async () => {
    const { t, docId } = await scenario();
    await expect(
      t.mutation(api.comments.create, {
        docId,
        markId: "mark-1",
        text: "hi",
        quotedText: "",
      })
    ).rejects.toThrow(/Not authenticated/);
  });

  it("records the author from the session, not from the arguments", async () => {
    const { t, editor, docId } = await scenario();
    const commentId = await addComment(t, editor, docId);

    const comment = await t.run(async (ctx) => await ctx.db.get(commentId));
    expect(comment?.authorId).toBe(editor);
  });

  it("rejects a comment that is empty once trimmed", async () => {
    const { t, editor, docId } = await scenario();
    await expect(addComment(t, editor, docId, "   ")).rejects.toThrow(/cannot be empty/i);
  });

  it("stores the comment trimmed", async () => {
    const { t, editor, docId } = await scenario();
    const commentId = await addComment(t, editor, docId, "  padded  ");

    const comment = await t.run(async (ctx) => await ctx.db.get(commentId));
    expect(comment?.text).toBe("padded");
  });

  it("rejects a comment over the length limit", async () => {
    const { t, editor, docId } = await scenario();
    await expect(addComment(t, editor, docId, "x".repeat(2001))).rejects.toThrow(/2000/);
  });
});

describe("comments.resolve", () => {
  it("lets the author resolve their own comment", async () => {
    const { t, viewer, docId } = await scenario();
    const commentId = await addComment(t, viewer, docId);

    await asUser(t, viewer).mutation(api.comments.resolve, { commentId });
    const comment = await t.run(async (ctx) => await ctx.db.get(commentId));
    expect(comment?.resolved).toBe(true);
  });

  it("lets an editor resolve someone else's comment", async () => {
    const { t, viewer, editor, docId } = await scenario();
    const commentId = await addComment(t, viewer, docId);

    await expect(
      asUser(t, editor).mutation(api.comments.resolve, { commentId })
    ).resolves.not.toThrow();
  });

  it("stops a viewer resolving someone else's comment", async () => {
    const { t, owner, viewer, docId } = await scenario();
    const commentId = await addComment(t, owner, docId);

    await expect(
      asUser(t, viewer).mutation(api.comments.resolve, { commentId })
    ).rejects.toThrow(/Not authorized/);
  });

  it("stops a user with no access to the document", async () => {
    const { t, owner, stranger, docId } = await scenario();
    const commentId = await addComment(t, owner, docId);

    await expect(
      asUser(t, stranger).mutation(api.comments.resolve, { commentId })
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("comments.deleteComment", () => {
  it("lets the author delete their own comment", async () => {
    const { t, viewer, docId } = await scenario();
    const commentId = await addComment(t, viewer, docId);

    await asUser(t, viewer).mutation(api.comments.deleteComment, { commentId });
    expect(await t.run(async (ctx) => await ctx.db.get(commentId))).toBeNull();
  });

  it("lets the document owner delete anyone's comment", async () => {
    const { t, owner, viewer, docId } = await scenario();
    const commentId = await addComment(t, viewer, docId);

    await asUser(t, owner).mutation(api.comments.deleteComment, { commentId });
    expect(await t.run(async (ctx) => await ctx.db.get(commentId))).toBeNull();
  });

  it("stops an editor deleting someone else's comment", async () => {
    const { t, owner, editor, docId } = await scenario();
    const commentId = await addComment(t, owner, docId);

    await expect(
      asUser(t, editor).mutation(api.comments.deleteComment, { commentId })
    ).rejects.toThrow(/Not authorized/);
  });

  it("stops a user with no access to the document", async () => {
    const { t, owner, stranger, docId } = await scenario();
    const commentId = await addComment(t, owner, docId);

    await expect(
      asUser(t, stranger).mutation(api.comments.deleteComment, { commentId })
    ).rejects.toThrow(/Not authorized/);
  });
});

describe("comments.list author details", () => {
  it("attaches each comment's author email", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const editor = await createUser(t, "editor@example.com");
    const docId = await createDocument(t, owner);
    await addCollaborator(t, docId, editor, "editor");

    await asUser(t, owner).mutation(api.comments.create, {
      docId, markId: "m1", text: "from owner", quotedText: "q",
    });
    await asUser(t, editor).mutation(api.comments.create, {
      docId, markId: "m2", text: "from editor", quotedText: "q",
    });

    const comments = await asUser(t, owner).query(api.comments.list, { docId });
    const byText = new Map(comments.map((c) => [c.text, c.authorEmail]));

    expect(byText.get("from owner")).toBe("owner@example.com");
    expect(byText.get("from editor")).toBe("editor@example.com");
  });

  it("labels a comment whose author no longer exists", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const editor = await createUser(t, "editor@example.com");
    const docId = await createDocument(t, owner);
    await addCollaborator(t, docId, editor, "editor");
    await asUser(t, editor).mutation(api.comments.create, {
      docId, markId: "m1", text: "orphaned", quotedText: "q",
    });

    await t.run(async (ctx) => await ctx.db.delete(editor));

    const [comment] = await asUser(t, owner).query(api.comments.list, { docId });
    expect(comment.authorEmail).toBe("Unknown");
  });

  it("gives every comment by one author the same email", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const docId = await createDocument(t, owner);
    for (let i = 0; i < 5; i++) {
      await asUser(t, owner).mutation(api.comments.create, {
        docId, markId: `m${i}`, text: `note ${i}`, quotedText: "q",
      });
    }

    const comments = await asUser(t, owner).query(api.comments.list, { docId });
    expect(comments).toHaveLength(5);
    expect(new Set(comments.map((c) => c.authorEmail))).toEqual(
      new Set(["owner@example.com"])
    );
  });
});
