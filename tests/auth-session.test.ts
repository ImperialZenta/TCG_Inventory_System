import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { authenticate } from "@/lib/auth/login";
import { createSession, validateSessionToken } from "@/lib/auth/sessions";
import { createInitialOwner } from "@/lib/auth/bootstrap";
import { truncateAuthTables } from "./helpers/auth";
import { disconnectTestDb } from "./helpers/db";

describe("auth session (sign-in flow)", () => {
  beforeEach(async () => {
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("creates a session after successful authentication with displayName", async () => {
    await createInitialOwner({
      email: "owner@test.local",
      displayName: "Andrew",
      password: "password123",
    });

    const user = await authenticate("owner@test.local", "password123");
    expect(user).not.toBeNull();
    expect(user!.displayName).toBe("Andrew");

    const { token } = await createSession(user!.userId);
    const session = await validateSessionToken(token);
    expect(session).not.toBeNull();
    expect(session!.displayName).toBe("Andrew");
    expect(session!.email).toBe("owner@test.local");
    expect(session!.role).toBe("OWNER");
  });

  it("rejects expired or unknown session tokens", async () => {
    expect(await validateSessionToken("deadbeef".repeat(8))).toBeNull();
  });
});
