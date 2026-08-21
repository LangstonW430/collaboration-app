// @vitest-environment edge-runtime

import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import {
  addCollaborator,
  asUser,
  createDocument,
  createUser,
  setupTest,
} from "./test.helpers";

afterEach(() => {
  vi.useRealTimers();
});

async function scenario() {
  const t = setupTest();
  const owner = await createUser(t, "owner@example.com");
  const viewer = await createUser(t, "viewer@example.com");
  const stranger = await createUser(t, "stranger@example.com");

  const docId = await createDocument(t, owner, { title: "Watched" });
  await addCollaborator(t, docId, viewer, "viewer");

  return { t, owner, viewer, stranger, docId };
}

describe("presence.heartbeat", () => {
  it("keeps one row per user however often it is called", async () => {
    const { t, owner, docId } = await scenario();
    await asUser(t, owner).mutation(api.presence.heartbeat, { docId });
    await asUser(t, owner).mutation(api.presence.heartbeat, { docId });

    const rows = await t.run(async (ctx) =>
      await ctx.db
        .query("presence")
        .withIndex("by_doc", (q) => q.eq("docId", docId))
        .collect()
    );
    expect(rows).toHaveLength(1);
  });

  it("rejects a user with no access", async () => {
    const { t, stranger, docId } = await scenario();
    await expect(
      asUser(t, stranger).mutation(api.presence.heartbeat, { docId })
    ).rejects.toThrow(/Not authorized/);
  });

  it("prunes rows that have been stale for minutes", async () => {
    vi.useFakeTimers();
    const { t, owner, viewer, docId } = await scenario();

    await asUser(t, viewer).mutation(api.presence.heartbeat, { docId });
    vi.advanceTimersByTime(6 * 60_000);
    await asUser(t, owner).mutation(api.presence.heartbeat, { docId });

    const rows = await t.run(async (ctx) =>
      await ctx.db
        .query("presence")
        .withIndex("by_doc", (q) => q.eq("docId", docId))
        .collect()
    );
    expect(rows.map((r) => r.userId)).toEqual([owner]);
  });
});

describe("presence.activeUsers", () => {
  it("shows other recent viewers but not the caller", async () => {
    const { t, owner, viewer, docId } = await scenario();
    await asUser(t, owner).mutation(api.presence.heartbeat, { docId });
    await asUser(t, viewer).mutation(api.presence.heartbeat, { docId });

    const seenByOwner = await asUser(t, owner).query(api.presence.activeUsers, { docId });
    expect(seenByOwner.map((u) => u.userId)).toEqual([viewer]);
    expect(seenByOwner[0].email).toBe("viewer@example.com");

    const seenByViewer = await asUser(t, viewer).query(api.presence.activeUsers, { docId });
    expect(seenByViewer.map((u) => u.userId)).toEqual([owner]);
  });

  it("drops users whose heartbeat has gone quiet", async () => {
    vi.useFakeTimers();
    const { t, owner, viewer, docId } = await scenario();

    await asUser(t, viewer).mutation(api.presence.heartbeat, { docId });
    vi.advanceTimersByTime(60_000);

    expect(await asUser(t, owner).query(api.presence.activeUsers, { docId })).toEqual([]);
  });

  it("reveals nothing to a user with no access", async () => {
    const { t, owner, stranger, docId } = await scenario();
    await asUser(t, owner).mutation(api.presence.heartbeat, { docId });

    expect(await asUser(t, stranger).query(api.presence.activeUsers, { docId })).toEqual([]);
  });
});
