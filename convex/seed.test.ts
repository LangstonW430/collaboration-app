// @vitest-environment edge-runtime

import { describe, expect, it } from "vitest";
import { internal } from "./_generated/api";
import { DEMO_DOCUMENTS } from "./model/demoContent";
import { asUser, createDocument, createUser, setupTest } from "./test.helpers";

describe("seed.resetDemoContent", () => {
  it("fills an empty demo account", async () => {
    const t = setupTest();
    await createUser(t, "demo@example.com");

    const result = await t.mutation(internal.seed.resetDemoContent, {
      email: "demo@example.com",
    });

    expect(result.documentsCreated).toBe(DEMO_DOCUMENTS.length);
    expect(result.commentsCreated).toBeGreaterThan(0);
  });

  it("refuses when the account does not exist yet", async () => {
    const t = setupTest();
    await expect(
      t.mutation(internal.seed.resetDemoContent, { email: "nobody@example.com" })
    ).rejects.toThrow(/Sign up through the app first/);
  });

  it("matches the account by email regardless of case", async () => {
    const t = setupTest();
    await createUser(t, "demo@example.com");

    await expect(
      t.mutation(internal.seed.resetDemoContent, { email: "DEMO@Example.com" })
    ).resolves.toMatchObject({ documentsCreated: DEMO_DOCUMENTS.length });
  });

  it("restores a known state after visitors have changed things", async () => {
    const t = setupTest();
    const demo = await createUser(t, "demo@example.com");
    await t.mutation(internal.seed.resetDemoContent, { email: "demo@example.com" });

    // A visitor renames one document and adds another of their own.
    const docs = await asUser(t, demo).query(await import("./_generated/api").then((m) => m.api.documents.list), {});
    await asUser(t, demo).mutation(
      await import("./_generated/api").then((m) => m.api.documents.update),
      { id: docs.documents[0]._id, title: "Defaced" }
    );
    await createDocument(t, demo, { title: "Visitor's own doc" });

    const second = await t.mutation(internal.seed.resetDemoContent, {
      email: "demo@example.com",
    });

    expect(second.documentsRemoved).toBe(DEMO_DOCUMENTS.length + 1);
    const after = await t.run(async (ctx) => await ctx.db.query("documents").collect());
    expect(after).toHaveLength(DEMO_DOCUMENTS.length);
    expect(after.map((d) => d.title)).not.toContain("Defaced");
    expect(after.map((d) => d.title)).not.toContain("Visitor's own doc");
  });

  it("leaves no comment pointing at a document it deleted", async () => {
    const t = setupTest();
    await createUser(t, "demo@example.com");
    await t.mutation(internal.seed.resetDemoContent, { email: "demo@example.com" });
    await t.mutation(internal.seed.resetDemoContent, { email: "demo@example.com" });

    const orphans = await t.run(async (ctx) => {
      const comments = await ctx.db.query("comments").collect();
      const alive = await Promise.all(comments.map((c) => ctx.db.get(c.docId)));
      return alive.filter((doc) => doc === null);
    });
    expect(orphans).toEqual([]);
  });

  it("does not touch another user's documents", async () => {
    const t = setupTest();
    await createUser(t, "demo@example.com");
    const other = await createUser(t, "someone@example.com");
    const theirDoc = await createDocument(t, other, { title: "Not the demo's" });

    await t.mutation(internal.seed.resetDemoContent, { email: "demo@example.com" });

    expect(await t.run(async (ctx) => await ctx.db.get(theirDoc))).not.toBeNull();
  });

  it("every comment anchors to a mark that exists in its document", async () => {
    const t = setupTest();
    await createUser(t, "demo@example.com");
    await t.mutation(internal.seed.resetDemoContent, { email: "demo@example.com" });

    const dangling = await t.run(async (ctx) => {
      const comments = await ctx.db.query("comments").collect();
      const results = [];
      for (const comment of comments) {
        const doc = await ctx.db.get(comment.docId);
        if (!doc?.content.includes(`data-comment-id="${comment.markId}"`)) {
          results.push(comment.markId);
        }
      }
      return results;
    });
    expect(dangling).toEqual([]);
  });
});
