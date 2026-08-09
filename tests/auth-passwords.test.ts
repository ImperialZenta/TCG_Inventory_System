import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/passwords";
import { disconnectTestDb } from "./helpers/db";
import { truncateAuthTables } from "./helpers/auth";

describe("auth passwords", () => {
  beforeEach(async () => {
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("stores passwords hashed and verifies correctly", async () => {
    const hash = await hashPassword("secret-password");
    expect(hash).not.toContain("secret-password");
    expect(await verifyPassword("secret-password", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
