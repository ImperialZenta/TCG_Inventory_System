import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { BootstrapError, createInitialOwner, hasAnyUser } from "@/lib/auth/bootstrap";
import { truncateAuthTables } from "./helpers/auth";
import { disconnectTestDb } from "./helpers/db";

describe("auth bootstrap", () => {
  beforeEach(async () => {
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("creates the initial owner when no users exist", async () => {
    expect(await hasAnyUser()).toBe(false);
    const { userId } = await createInitialOwner({
      email: "owner@test.local",
      displayName: "Owner",
      password: "password123",
    });
    expect(userId).toBeTruthy();
    expect(await hasAnyUser()).toBe(true);
  });

  it("rejects a second owner bootstrap", async () => {
    await createInitialOwner({
      email: "owner@test.local",
      displayName: "Owner",
      password: "password123",
    });
    await expect(
      createInitialOwner({
        email: "other@test.local",
        displayName: "Other",
        password: "password123",
      }),
    ).rejects.toBeInstanceOf(BootstrapError);
  });
});
