import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { authenticate, INVALID_CREDENTIALS_MESSAGE } from "@/lib/auth/login";
import { createTestOwner, createTestStaff, truncateAuthTables } from "./helpers/auth";
import { setUserEnabled } from "@/lib/auth/users";
import { disconnectTestDb } from "./helpers/db";

describe("auth login", () => {
  beforeEach(async () => {
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("authenticates with valid credentials", async () => {
    await createTestOwner({ email: "owner@test.local", password: "password123" });
    const user = await authenticate("owner@test.local", "password123");
    expect(user?.email).toBe("owner@test.local");
    expect(user?.role).toBe("OWNER");
  });

  it("rejects invalid credentials without distinguishing missing email", async () => {
    await createTestOwner();
    expect(await authenticate("owner@test.local", "wrong")).toBeNull();
    expect(await authenticate("nobody@test.local", "password123")).toBeNull();
    expect(INVALID_CREDENTIALS_MESSAGE).toBe("Invalid email or password");
  });

  it("rejects disabled users", async () => {
    const owner = await createTestOwner();
    const staff = await createTestStaff(owner.ctx, { email: "staff@test.local" });
    const staffUser = await authenticate(staff.email, staff.password);
    expect(staffUser).not.toBeNull();

    await setUserEnabled(owner.ctx, staffUser!.userId, false);
    expect(await authenticate(staff.email, staff.password)).toBeNull();
  });
});
