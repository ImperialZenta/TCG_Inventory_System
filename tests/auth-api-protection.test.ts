import "./helpers/next-headers-mock";
import { describe, expect, it, beforeEach, afterAll, vi } from "vitest";
import { clearMockCookies, setMockSessionCookie, cookieStore } from "./helpers/next-headers-mock";
import { createTestOwner, createTestUserWithSession, truncateAuthTables } from "./helpers/auth";
import { disconnectTestDb } from "./helpers/db";

vi.mock("@/lib/backup", () => ({
  exportInventoryBackup: vi.fn().mockResolvedValue({ version: 1, blocks: [] }),
}));

describe("auth API route protection", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("GET /api/backup/export returns 401 without session", async () => {
    const { GET } = await import("@/app/api/backup/export/route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });

  it("GET /api/backup/export succeeds with a valid session", async () => {
    const owner = await createTestOwner();
    setMockSessionCookie(owner.token);

    const { GET } = await import("@/app/api/backup/export/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("application/json");
  });

  it("GET /api/backup/export returns 401 with an invalid session cookie", async () => {
    setMockSessionCookie("not-a-real-session-token");

    const { GET } = await import("@/app/api/backup/export/route");
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("GET /api/backup/export returns 403 for staff session", async () => {
    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      role: "STAFF",
    });
    setMockSessionCookie(staff.token);

    const { GET } = await import("@/app/api/backup/export/route");
    const res = await GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Forbidden" });
  });

  it("does not leak backup payload when unauthenticated", async () => {
    cookieStore.sessionToken = undefined;
    const { GET } = await import("@/app/api/backup/export/route");
    const res = await GET();
    const text = await res.text();
    expect(text).not.toContain('"blocks"');
    expect(text).toContain("Unauthorized");
  });
});
