import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { authenticate } from "@/lib/auth/login";
import { verifyPassword } from "@/lib/auth/passwords";
import { createUser, listUsers, resetUserPassword, setUserEnabled } from "@/lib/auth/users";
import { createTestOwner, truncateAuthTables } from "./helpers/auth";
import { disconnectTestDb } from "./helpers/db";

describe("auth users (owner management)", () => {
  beforeEach(async () => {
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("lets the owner create and disable staff", async () => {
    const owner = await createTestOwner();
    await createUser(owner.ctx, {
      email: "staff@test.local",
      displayName: "Staff One",
      password: "staffpass123",
      role: "STAFF",
    });

    const users = await listUsers(owner.ctx);
    expect(users).toHaveLength(2);
    const staff = users.find((u) => u.email === "staff@test.local");
    expect(staff?.enabled).toBe(true);

    await setUserEnabled(owner.ctx, staff!.id, false);
    expect(await authenticate("staff@test.local", "staffpass123")).toBeNull();
  });

  it("stores password hashes in the database, not plaintext", async () => {
    const owner = await createTestOwner();
    const plain = "staffpass123";
    await createUser(owner.ctx, {
      email: "staff@test.local",
      displayName: "Staff One",
      password: plain,
      role: "STAFF",
    });

    const row = await db.user.findUnique({ where: { email: "staff@test.local" } });
    expect(row?.passwordHash).toBeTruthy();
    expect(row!.passwordHash).not.toBe(plain);
    expect(row!.passwordHash).not.toContain(plain);
    expect(await verifyPassword(plain, row!.passwordHash)).toBe(true);
  });

  it("resets password and invalidates the old password", async () => {
    const owner = await createTestOwner();
    await createUser(owner.ctx, {
      email: "staff@test.local",
      displayName: "Staff One",
      password: "old-password",
      role: "STAFF",
    });

    const staff = await db.user.findUnique({ where: { email: "staff@test.local" } });
    await resetUserPassword(owner.ctx, staff!.id, "new-password-99");

    expect(await authenticate("staff@test.local", "old-password")).toBeNull();
    expect(await authenticate("staff@test.local", "new-password-99")).not.toBeNull();
  });
});
