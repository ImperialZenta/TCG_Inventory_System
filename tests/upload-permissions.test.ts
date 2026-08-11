import "./helpers/next-headers-mock";
import "./helpers/next-navigation-mock";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MembershipRole } from "@prisma/client";
import { clearMockCookies, setMockSessionCookie } from "./helpers/next-headers-mock";
import {
  createTestOwner,
  createTestUserWithSession,
} from "./helpers/auth";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { db } from "@/lib/db";
import { PERMISSIONS, roleCanPerform } from "@/lib/auth/permissions";
import {
  completeUploadSessionAction,
  createUploadSessionAction,
} from "@/app/uploads/actions";
import { createFormalizedImport } from "./helpers/fixtures";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import {
  createUploadSession,
  generateUploadSessionCsv,
} from "@/lib/upload-sessions";
import { GET as exportUploadCsv } from "@/app/api/uploads/[sessionId]/export-csv/route";
import { GET as exportBlockCsv } from "@/app/api/blocks/[blockId]/export-csv/route";
import { configureCatalogAccessAction } from "@/app/uploads/catalog-actions";

vi.mock("@/lib/upload-sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/upload-sessions")>();
  return {
    ...actual,
    listUploadSessions: vi.fn().mockResolvedValue([]),
  };
});

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("CHL-014 upload permissions matrix", () => {
  it("matches role table for upload session actions", () => {
    expect(roleCanPerform("STAFF", PERMISSIONS.UPLOAD_SESSION_CREATE)).toBe(true);
    expect(roleCanPerform("STAFF", PERMISSIONS.UPLOAD_SESSION_COMPLETE)).toBe(false);
    expect(roleCanPerform("MANAGER", PERMISSIONS.UPLOAD_SESSION_COMPLETE)).toBe(true);
    expect(roleCanPerform("READ_ONLY", PERMISSIONS.UPLOAD_SESSION_CREATE)).toBe(false);
    expect(roleCanPerform("MANAGER", PERMISSIONS.CATALOG_CONFIGURE)).toBe(true);
    expect(roleCanPerform("STAFF", PERMISSIONS.CATALOG_CONFIGURE)).toBe(false);
  });
});

describe("CHL-014 upload session enforcement", () => {
  let owner: Awaited<ReturnType<typeof createTestOwner>>;
  let binId: string;
  let blockInternalId: string;
  let blockMtgId: string;

  beforeEach(async () => {
    clearMockCookies();
    ({ binId } = await resetTestDb());
    owner = await createTestOwner();

    const fixture = await createFormalizedImport(binId, 1);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, fixture.internalIds);
    await db.cardLine.updateMany({
      where: { blockId: fixture.internalIds[0]! },
      data: { scryfallId: "perm-test-scryfall-id" },
    });
    blockInternalId = fixture.internalIds[0]!;
    blockMtgId = fixture.blockIds[0]!;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  async function sessionFor(role: MembershipRole) {
    if (role === "OWNER") {
      return owner;
    }
    return createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: `${role.toLowerCase()}@upload-perm.test`,
      role,
    });
  }

  it("staff can create upload sessions", async () => {
    const staff = await sessionFor("STAFF");
    setMockSessionCookie(staff.token);

    const formData = new FormData();
    formData.set("channel", "MANAPOOL");
    formData.append("blockIds", blockInternalId);

    await expect(createUploadSessionAction(null, formData)).rejects.toThrow(/NEXT_REDIRECT/);
  });

  it("staff cannot complete upload sessions", async () => {
    const { sessionId } = await createUploadSession(owner.ctx, [blockInternalId], "MANAPOOL");
    await generateUploadSessionCsv(owner.ctx, sessionId);

    const staff = await sessionFor("STAFF");
    setMockSessionCookie(staff.token);

    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("confirmed", "true");

    const result = await completeUploadSessionAction(null, formData);
    expect(result).toEqual({ ok: false, message: "Not permitted" });
  });

  it("manager can complete upload sessions", async () => {
    const { sessionId } = await createUploadSession(owner.ctx, [blockInternalId], "MANAPOOL");
    await generateUploadSessionCsv(owner.ctx, sessionId);

    const manager = await sessionFor("MANAGER");
    setMockSessionCookie(manager.token);

    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("confirmed", "true");

    const result = await completeUploadSessionAction(null, formData);
    expect(result.ok).toBe(true);
  });

  it("read-only cannot create upload sessions", async () => {
    const reader = await sessionFor("READ_ONLY");
    setMockSessionCookie(reader.token);

    const formData = new FormData();
    formData.set("channel", "MANAPOOL");
    formData.append("blockIds", blockInternalId);

    const result = await createUploadSessionAction(null, formData);
    expect(result).toEqual({ ok: false, message: "Not permitted" });
  });

  it("read-only cannot download upload session CSV", async () => {
    const { sessionId } = await createUploadSession(owner.ctx, [blockInternalId], "MANAPOOL");
    await generateUploadSessionCsv(owner.ctx, sessionId);

    const reader = await sessionFor("READ_ONLY");
    setMockSessionCookie(reader.token);

    const response = await exportUploadCsv(
      new Request(`http://localhost/api/uploads/${sessionId}/export-csv`),
      { params: Promise.resolve({ sessionId }) },
    );

    expect(response.status).toBe(403);
  });

  it("staff can download block listing CSV", async () => {
    const staff = await sessionFor("STAFF");
    setMockSessionCookie(staff.token);

    const response = await exportBlockCsv(
      new Request(`http://localhost/api/blocks/${blockMtgId}/export-csv`),
      { params: Promise.resolve({ blockId: blockMtgId }) },
    );

    expect(response.status).toBe(200);
  });

  it("read-only cannot download block listing CSV", async () => {
    const reader = await sessionFor("READ_ONLY");
    setMockSessionCookie(reader.token);

    const response = await exportBlockCsv(
      new Request(`http://localhost/api/blocks/${blockMtgId}/export-csv`),
      { params: Promise.resolve({ blockId: blockMtgId }) },
    );

    expect(response.status).toBe(403);
  });

  it("manager can pass catalog configure permission check", async () => {
    const manager = await sessionFor("MANAGER");
    setMockSessionCookie(manager.token);

    const result = await configureCatalogAccessAction();
    expect(result.ok).toBe(true);
  });

  it("staff cannot configure catalogs", async () => {
    const staff = await sessionFor("STAFF");
    setMockSessionCookie(staff.token);

    const result = await configureCatalogAccessAction();
    expect(result).toEqual({ ok: false, message: "Not permitted" });
  });
});

describe("CHL-005 complete confirmation", () => {
  let owner: Awaited<ReturnType<typeof createTestOwner>>;
  let blockInternalId: string;

  beforeEach(async () => {
    clearMockCookies();
    const { binId } = await resetTestDb();
    owner = await createTestOwner();

    const fixture = await createFormalizedImport(binId, 1);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, fixture.internalIds);
    await db.cardLine.updateMany({
      where: { blockId: fixture.internalIds[0]! },
      data: { scryfallId: "chl005-confirm-id" },
    });
    blockInternalId = fixture.internalIds[0]!;
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  async function sessionFor(role: MembershipRole) {
    if (role === "OWNER") {
      return owner;
    }
    return createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: `${role.toLowerCase()}@upload-confirm.test`,
      role,
    });
  }

  it("rejects complete without explicit confirmation", async () => {
    const { sessionId } = await createUploadSession(owner.ctx, [blockInternalId], "MANAPOOL");
    await generateUploadSessionCsv(owner.ctx, sessionId);

    const manager = await sessionFor("MANAGER");
    setMockSessionCookie(manager.token);

    const formData = new FormData();
    formData.set("sessionId", sessionId);

    const result = await completeUploadSessionAction(null, formData);
    expect(result).toEqual({ ok: false, message: "Confirmation required" });

    const block = await db.block.findUnique({ where: { id: blockInternalId } });
    expect(block?.status).toBe("SEALED");

    const session = await db.uploadSession.findUnique({ where: { sessionId } });
    expect(session?.status).toBe("CSV_READY");
  });
});

describe("CHL-014 upload page access", () => {
  it("redirects read-only users away from /uploads", async () => {
    const { getCurrentSession } = await import("@/lib/auth");
    vi.mocked(getCurrentSession).mockResolvedValue({
      sessionId: "reader-session",
      userId: "reader-id",
      email: "reader@test.local",
      displayName: "Reader",
      enabled: true,
      organizationId: "org-id",
      role: "READ_ONLY",
    });

    const UploadsPage = (await import("@/app/uploads/page")).default;

    await expect(UploadsPage()).rejects.toThrow("NEXT_REDIRECT:/inventory");
  });
});
