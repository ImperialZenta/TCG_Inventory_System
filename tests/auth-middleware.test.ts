import { describe, expect, it, beforeEach, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { createTestOwner, truncateAuthTables } from "./helpers/auth";
import { disconnectTestDb } from "./helpers/db";

function request(path: string, cookie?: string): NextRequest {
  const headers: Record<string, string> = {};
  if (cookie) {
    headers.Cookie = cookie;
  }
  return new NextRequest(`http://localhost${path}`, { headers });
}

describe("auth middleware", () => {
  beforeEach(async () => {
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("returns 401 JSON for unauthenticated staff API routes", async () => {
    const res = middleware(request("/api/backup/export"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("redirects unauthenticated page requests to login with callback", async () => {
    const res = middleware(request("/blocks"));
    expect(res.status).toBe(307);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
    expect(location).toContain("callbackUrl=%2Fblocks");
  });

  it("allows public setup and webhook paths without a session cookie", async () => {
    const setup = middleware(request("/setup"));
    expect(setup.headers.get("location")).toBeNull();

    const webhook = middleware(request("/api/webhooks/manapool"));
    expect(webhook.headers.get("location")).toBeNull();
    expect(webhook.status).not.toBe(401);
  });

  it("blocks app content when no users exist (redirect to login, not through)", async () => {
    const res = middleware(request("/inventory"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toMatch(/\/login/);
  });

  it("allows requests with a session cookie to reach the app", async () => {
    const owner = await createTestOwner();
    const res = middleware(
      request("/inventory", `${SESSION_COOKIE_NAME}=${owner.token}`),
    );
    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });
});
