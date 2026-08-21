// @vitest-environment edge-runtime

import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import { asUser, createUser, setupTest } from "./test.helpers";

describe("users.me", () => {
  it("returns the caller's own identity", async () => {
    const t = setupTest();
    const user = await createUser(t, "me@example.com");

    const me = await asUser(t, user).query(api.users.me, {});
    expect(me).toEqual({ _id: user, name: null, email: "me@example.com" });
  });

  it("returns null to an anonymous caller", async () => {
    const t = setupTest();
    expect(await t.query(api.users.me, {})).toBeNull();
  });
});
