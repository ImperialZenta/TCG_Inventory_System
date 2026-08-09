import "./helpers/next-navigation-mock";
import { NextRequest } from "next/server";
import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { middleware } from "@/middleware";
import { redirectToSetupIfNoUsers } from "@/lib/auth/login-guard";
import { createInitialOwner } from "@/lib/auth/bootstrap";
import { redirectMock } from "./helpers/next-navigation-mock";
import { truncateAuthTables } from "./helpers/auth";
import { disconnectTestDb } from "./helpers/db";

function request(path: string): NextRequest {
  return new NextRequest(`http://localhost${path}`);
}

describe("auth bootstrap flow", () => {
  beforeEach(async () => {
    redirectMock.mockClear();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("redirectToSetupIfNoUsers sends fresh installs to /setup", async () => {
    await expect(redirectToSetupIfNoUsers()).rejects.toThrow("NEXT_REDIRECT:/setup");
    expect(redirectMock).toHaveBeenCalledWith("/setup");
  });

  it("redirectToSetupIfNoUsers is a no-op once an owner exists", async () => {
    await createInitialOwner({
      email: "owner@test.local",
      displayName: "Andrew",
      password: "password123",
    });

    await expect(redirectToSetupIfNoUsers()).resolves.toBeUndefined();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("chains middleware login redirect with login guard setup redirect when no users", async () => {
    const protectedRes = middleware(request("/inventory"));
    expect(protectedRes.status).toBe(307);
    expect(protectedRes.headers.get("location")).toMatch(/\/login/);

    await expect(redirectToSetupIfNoUsers()).rejects.toThrow("NEXT_REDIRECT:/setup");
  });
});
