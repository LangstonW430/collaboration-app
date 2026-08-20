// @vitest-environment edge-runtime

import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "./_generated/api";
import { RATE_LIMITS } from "./model/rateLimit";
import { asUser, createDocument, createUser, setupTest } from "./test.helpers";

afterEach(() => {
  vi.useRealTimers();
});

describe("documents.create", () => {
  it("stops a client creating documents without bound", async () => {
    const t = setupTest();
    const user = await createUser(t, "spammer@example.com");
    const { limit } = RATE_LIMITS["documents.create"];

    for (let i = 0; i < limit; i++) {
      await asUser(t, user).mutation(api.documents.create, {});
    }

    await expect(asUser(t, user).mutation(api.documents.create, {})).rejects.toThrow(
      /Too many requests/
    );
  });

  it("says how long to wait", async () => {
    const t = setupTest();
    const user = await createUser(t, "spammer@example.com");
    const { limit } = RATE_LIMITS["documents.create"];

    for (let i = 0; i < limit; i++) {
      await asUser(t, user).mutation(api.documents.create, {});
    }

    await expect(asUser(t, user).mutation(api.documents.create, {})).rejects.toThrow(/\d+s/);
  });

  it("budgets each user separately", async () => {
    const t = setupTest();
    const heavy = await createUser(t, "heavy@example.com");
    const light = await createUser(t, "light@example.com");
    const { limit } = RATE_LIMITS["documents.create"];

    for (let i = 0; i < limit; i++) {
      await asUser(t, heavy).mutation(api.documents.create, {});
    }

    await expect(asUser(t, heavy).mutation(api.documents.create, {})).rejects.toThrow();
    await expect(asUser(t, light).mutation(api.documents.create, {})).resolves.toBeDefined();
  });

  it("lets the caller through again once the window passes", async () => {
    vi.useFakeTimers();
    const t = setupTest();
    const user = await createUser(t, "patient@example.com");
    const { limit, windowMs } = RATE_LIMITS["documents.create"];

    for (let i = 0; i < limit; i++) {
      await asUser(t, user).mutation(api.documents.create, {});
    }
    await expect(asUser(t, user).mutation(api.documents.create, {})).rejects.toThrow();

    vi.advanceTimersByTime(windowMs);

    await expect(asUser(t, user).mutation(api.documents.create, {})).resolves.toBeDefined();
  });
});

describe("collaborators.invite", () => {
  it("stops one owner sending unbounded invitations", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const docId = await createDocument(t, owner);
    const { limit } = RATE_LIMITS["collaborators.invite"];

    for (let i = 0; i < limit; i++) {
      await asUser(t, owner).mutation(api.collaborators.invite, {
        docId,
        email: `person${i}@example.com`,
        role: "viewer",
      });
    }

    await expect(
      asUser(t, owner).mutation(api.collaborators.invite, {
        docId,
        email: "one-too-many@example.com",
        role: "viewer",
      })
    ).rejects.toThrow(/Too many requests/);
  });
});

describe("files.generateUploadUrl", () => {
  it("caps how many upload URLs one user can take", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const docId = await createDocument(t, owner);
    const { limit } = RATE_LIMITS["files.upload"];

    for (let i = 0; i < limit; i++) {
      await asUser(t, owner).mutation(api.files.generateUploadUrl, { docId });
    }

    await expect(
      asUser(t, owner).mutation(api.files.generateUploadUrl, { docId })
    ).rejects.toThrow(/Too many requests/);
  });
});

describe("budget is spent only by callers who get through", () => {
  it("does not charge a caller who is rejected for authorization", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const stranger = await createUser(t, "stranger@example.com");
    const docId = await createDocument(t, owner);

    // Rejected before the limiter is reached, so no counter row is created.
    for (let i = 0; i < 5; i++) {
      await expect(
        asUser(t, stranger).mutation(api.files.generateUploadUrl, { docId })
      ).rejects.toThrow(/Not authorized/);
    }

    const rows = await t.run(async (ctx) => await ctx.db.query("rateLimits").collect());
    expect(rows).toEqual([]);
  });

  it("does not charge editing, which autosave does constantly", async () => {
    const t = setupTest();
    const owner = await createUser(t, "owner@example.com");
    const docId = await createDocument(t, owner);

    for (let i = 0; i < 200; i++) {
      await asUser(t, owner).mutation(api.documents.update, { id: docId, title: `v${i}` });
    }

    const rows = await t.run(async (ctx) => await ctx.db.query("rateLimits").collect());
    expect(rows).toEqual([]);
  });
});
