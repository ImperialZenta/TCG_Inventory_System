import "./helpers/next-headers-mock";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { MembershipRole } from "@prisma/client";
import { clearMockCookies, setMockSessionCookie } from "./helpers/next-headers-mock";
import {
  createTestOwner,
  createTestUserWithSession,
  truncateAuthTables,
} from "./helpers/auth";
import { disconnectTestDb } from "./helpers/db";
import { db } from "@/lib/db";
import { INVENTORY_EVENT_TYPES } from "@/lib/events/types";
import {
  canPerform,
  PERMISSIONS,
  roleCanPerform,
} from "@/lib/auth/permissions";
import { ForbiddenError } from "@/lib/auth/errors";
import { deleteAllInventoryAction } from "@/app/settings/delete-actions";
import { removeBlockAction } from "@/app/blocks/actions";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { removeBlockByBlockId } from "@/lib/blocks/remove";
import { resetTestDb } from "./helpers/db";
import { createFormalizedImport } from "./helpers/fixtures";

vi.mock("@/lib/backup", () => ({
  exportInventoryBackup: vi.fn().mockResolvedValue({ version: 1, blocks: [] }),
}));

const ROLES: MembershipRole[] = ["OWNER", "MANAGER", "STAFF", "READ_ONLY"];

describe("ACC-002 permissions matrix", () => {
  it("canPerform matches role table for danger zone", () => {
    expect(roleCanPerform("OWNER", PERMISSIONS.DANGER_ZONE)).toBe(true);
    expect(roleCanPerform("MANAGER", PERMISSIONS.DANGER_ZONE)).toBe(false);
    expect(roleCanPerform("STAFF", PERMISSIONS.DANGER_ZONE)).toBe(false);
    expect(roleCanPerform("READ_ONLY", PERMISSIONS.DANGER_ZONE)).toBe(false);
  });

  it("canPerform matches role table for block remove", () => {
    expect(roleCanPerform("OWNER", PERMISSIONS.BLOCK_REMOVE)).toBe(true);
    expect(roleCanPerform("MANAGER", PERMISSIONS.BLOCK_REMOVE)).toBe(true);
    expect(roleCanPerform("STAFF", PERMISSIONS.BLOCK_REMOVE)).toBe(false);
    expect(roleCanPerform("READ_ONLY", PERMISSIONS.BLOCK_REMOVE)).toBe(false);
  });

  it("read-only cannot perform any mutation permission", () => {
    const mutationPermissions = Object.values(PERMISSIONS).filter(
      (p) => p !== PERMISSIONS.BACKUP_EXPORT,
    );
    for (const permission of mutationPermissions) {
      expect(canPerform({ ...TEST_OWNER_CONTEXT, role: "READ_ONLY" }, permission)).toBe(false);
    }
  });
});

describe("ACC-002 server enforcement", () => {
  let owner: Awaited<ReturnType<typeof createTestOwner>>;

  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
    owner = await createTestOwner();
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
      email: `${role.toLowerCase()}@test.local`,
      role,
    });
  }

  it.each([
    ["MANAGER", false],
    ["STAFF", false],
    ["READ_ONLY", false],
  ] as const)("danger zone refused for %s", async (role, _allowed) => {
    void _allowed;
    const user = await sessionFor(role);
    setMockSessionCookie(user.token);

    const form = new FormData();
    form.set("confirmation", "DELETE");
    const result = await deleteAllInventoryAction(null, form);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Not permitted");
  });

  it("owner can reach danger zone action (confirmation gate only)", async () => {
    setMockSessionCookie(owner.token);
    const form = new FormData();
    form.set("confirmation", "NOPE");
    const result = await deleteAllInventoryAction(null, form);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Type DELETE to confirm");
  });

  it.each([
    ["OWNER", true],
    ["MANAGER", true],
    ["STAFF", false],
    ["READ_ONLY", false],
  ] as const)("block remove via domain for %s", async (role, allowed) => {
    const { binId } = await resetTestDb();
    const freshOwner = await createTestOwner();
    const user =
      role === "OWNER"
        ? freshOwner
        : await createTestUserWithSession({
            ownerCtx: freshOwner.ctx,
            email: `${role.toLowerCase()}-block@test.local`,
            role,
          });
    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;

    if (allowed) {
      const result = await removeBlockByBlockId(user.ctx, blockId);
      expect(result.blockId).toBe(blockId);
    } else {
      await expect(removeBlockByBlockId(user.ctx, blockId)).rejects.toBeInstanceOf(ForbiddenError);
    }
  });

  it("staff crafted removeBlockAction is refused", async () => {
    const staff = await sessionFor("STAFF");
    setMockSessionCookie(staff.token);

    const form = new FormData();
    form.set("blockId", "MTG-00001");
    form.set("confirmation", "MTG-00001");
    const result = await removeBlockAction(null, form);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Not permitted");
  });

  it("records permission denial event", async () => {
    const staff = await sessionFor("STAFF");
    setMockSessionCookie(staff.token);

    const before = Date.now();
    const form = new FormData();
    form.set("confirmation", "DELETE");
    await deleteAllInventoryAction(null, form);
    const after = Date.now();

    const event = await db.inventoryEvent.findFirst({
      where: {
        eventType: INVENTORY_EVENT_TYPES.PERMISSION_DENIED,
        actor: staff.session.userId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(event).not.toBeNull();
    expect(event?.actor).toBe(staff.session.userId);
    expect(event?.payload).toMatchObject({
      permission: PERMISSIONS.DANGER_ZONE,
    });
    expect(event!.createdAt.getTime()).toBeGreaterThanOrEqual(before - 500);
    expect(event!.createdAt.getTime()).toBeLessThanOrEqual(after + 500);
  });
});

describe("ACC-002 API backup export roles", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("GET /api/backup/export returns 403 for staff", async () => {
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

  it("GET /api/backup/export succeeds for owner", async () => {
    const owner = await createTestOwner();
    setMockSessionCookie(owner.token);

    const { GET } = await import("@/app/api/backup/export/route");
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
