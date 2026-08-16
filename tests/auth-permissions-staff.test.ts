import "./helpers/next-headers-mock";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
import { clearMockCookies, setMockSessionCookie } from "./helpers/next-headers-mock";
import {
  createTestOwner,
  createTestUserWithSession,
  truncateAuthTables,
} from "./helpers/auth";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { db } from "@/lib/db";
import { INVENTORY_EVENT_TYPES } from "@/lib/events/types";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { ForbiddenError } from "@/lib/auth/errors";
import { deleteAllInventoryAction } from "@/app/settings/delete-actions";
import { removeBlockAction } from "@/app/blocks/actions";
import { removeBlockByBlockId } from "@/lib/blocks/remove";
import { formalizeStagingImportAction, reorderStagingBlockAction, uploadStagingCsv } from "@/app/staging/actions";
import { sealBlockAction } from "@/app/blocks/actions";
import { pickItemAction } from "@/app/pick/actions";
import { counterPickAction } from "@/app/blocks/actions";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
import {
  createFormalizedImport,
  createMultiBlockImport,
  createTestExternalOrder,
  makeBlocksPickable,
} from "./helpers/fixtures";

describe("ACC-002 staff positive permissions", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  async function staffSessionAfterReset() {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "staff-positive@test.local",
      role: "STAFF",
    });
    setMockSessionCookie(staff.token);
    return { binId, staff, owner };
  }

  it("staff can upload staging CSV", async () => {
    await staffSessionAfterReset();
    const csv = readFileSync(
      join(process.cwd(), "docs/fixtures/staging-05-undo.csv"),
      "utf8",
    );
    const form = new FormData();
    form.set("csv", new File([csv], "staff-upload.csv", { type: "text/csv" }));

    const result = await uploadStagingCsv(null, form);
    expect(result.ok, result.message).toBe(true);

    const imports = await db.stagingImport.count();
    expect(imports).toBeGreaterThan(0);
  });

  it("staff can formalize a staging import", async () => {
    const { binId } = await staffSessionAfterReset();
    const { importId } = await createMultiBlockImport(1);

    const form = new FormData();
    form.set("importId", importId);
    form.set("bin_1", binId);

    const result = await formalizeStagingImportAction(null, form);
    expect(result.ok, result.message).toBe(true);

    const blocks = await db.block.count();
    expect(blocks).toBe(1);
  });

  it("staff can seal an open block", async () => {
    const { binId } = await staffSessionAfterReset();
    const fixture = await createFormalizedImport(binId, 1);

    const form = new FormData();
    form.set("blockId", fixture.blockIds[0]!);

    const result = await sealBlockAction(null, form);
    expect(result.ok).toBe(true);

    const block = await db.block.findUnique({ where: { blockId: fixture.blockIds[0]! } });
    expect(block?.status).toBe("SEALED");
  });

  it("staff can mark a pick item picked", async () => {
    const { binId, staff } = await staffSessionAfterReset();
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId, humanPickListId } = await createPickListForOrder(
      externalOrderId,
      staff.ctx,
    );

    const item = await db.pickItem.findFirst({ where: { pickListId } });
    expect(item).not.toBeNull();

    await pickItemAction(item!.id, humanPickListId);

    const picked = await db.pickItem.findUnique({ where: { id: item!.id } });
    expect(picked?.status).toBe("PICKED");
  });

  it("staff can record a counter pick", async () => {
    const { binId } = await staffSessionAfterReset();
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const result = await counterPickAction(fixture.blockIds[0]!, 1);
    expect(result.ok).toBe(true);

    const history = await db.pickHistory.findFirst({
      where: { mtgBlockId: fixture.blockIds[0]!, isCounterPick: true },
    });
    expect(history).not.toBeNull();
  });
});

describe("ACC-002 read-only server refusal", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("read-only crafted removeBlockAction is refused", async () => {
    const owner = await createTestOwner();
    const readOnly = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "readonly@test.local",
      role: "READ_ONLY",
    });
    setMockSessionCookie(readOnly.token);

    const form = new FormData();
    form.set("blockId", "MTG-00001");
    form.set("confirmation", "MTG-00001");

    const result = await removeBlockAction(null, form);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Not permitted");
  });

  it("read-only staging upload is refused", async () => {
    const owner = await createTestOwner();
    const readOnly = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "readonly-upload@test.local",
      role: "READ_ONLY",
    });
    setMockSessionCookie(readOnly.token);

    const csv = readFileSync(
      join(process.cwd(), "docs/fixtures/staging-05-undo.csv"),
      "utf8",
    );
    const form = new FormData();
    form.set("csv", new File([csv], "readonly.csv", { type: "text/csv" }));

    const result = await uploadStagingCsv(null, form);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Not permitted");
  });

  it("read-only reorder is refused", async () => {
    const { importId } = await createMultiBlockImport(1);
    const owner = await createTestOwner();
    const readOnly = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "readonly-reorder@test.local",
      role: "READ_ONLY",
    });
    const cards = await db.stagingCard.findMany({
      where: { stagingImportId: importId, suggestedBlock: 1 },
    });
    setMockSessionCookie(readOnly.token);

    const form = new FormData();
    form.set("importId", importId);
    form.set("blockIndex", "1");
    form.set("orderedCardIds", JSON.stringify(cards.map((c) => c.id)));

    const result = await reorderStagingBlockAction(null, form);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Not permitted");
  });

  it("read-only formalize is refused", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const readOnly = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "readonly-formalize@test.local",
      role: "READ_ONLY",
    });
    const { importId } = await createMultiBlockImport(1);
    setMockSessionCookie(readOnly.token);

    const form = new FormData();
    form.set("importId", importId);
    form.set("bin_1", binId);

    const result = await formalizeStagingImportAction(null, form);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Not permitted");
  });

  it("read-only seal is refused", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const readOnly = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "readonly-seal@test.local",
      role: "READ_ONLY",
    });
    const fixture = await createFormalizedImport(binId, 1);
    setMockSessionCookie(readOnly.token);

    const form = new FormData();
    form.set("blockId", fixture.blockIds[0]!);

    const result = await sealBlockAction(null, form);
    expect(result.ok).toBe(false);
    expect(result.message).toBe("Not permitted");
  });

  it("read-only pick is refused", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const readOnly = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "readonly-pick@test.local",
      role: "READ_ONLY",
    });
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId, humanPickListId } = await createPickListForOrder(
      externalOrderId,
      owner.ctx,
    );
    const item = await db.pickItem.findFirst({ where: { pickListId } });
    expect(item).not.toBeNull();

    setMockSessionCookie(readOnly.token);
    await expect(pickItemAction(item!.id, humanPickListId)).rejects.toThrow("Not permitted");
  });
});

describe("ACC-002 owner danger zone success", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("owner can complete delete all inventory", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    await createFormalizedImport(binId, 2);
    setMockSessionCookie(owner.token);

    const form = new FormData();
    form.set("confirmation", "DELETE");

    const result = await deleteAllInventoryAction(null, form);
    expect(result.ok, result.message).toBe(true);
    expect(result.message).toContain("deleted");

    expect(await db.block.count()).toBe(0);
    expect(await db.stagingImport.count()).toBe(0);
  });
});

describe("ACC-002 permission denial audit", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("records danger zone denial with recent timestamp", async () => {
    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      role: "STAFF",
    });
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
    expect(event?.payload).toMatchObject({ permission: PERMISSIONS.DANGER_ZONE });
    expect(event!.createdAt.getTime()).toBeGreaterThanOrEqual(before - 500);
    expect(event!.createdAt.getTime()).toBeLessThanOrEqual(after + 500);
  });

  it("records block remove denial with recent timestamp", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "staff-block-deny@test.local",
      role: "STAFF",
    });
    const fixture = await createFormalizedImport(binId, 1);

    const before = Date.now();
    await expect(
      removeBlockByBlockId(staff.ctx, fixture.blockIds[0]!),
    ).rejects.toBeInstanceOf(ForbiddenError);
    const after = Date.now();

    const event = await db.inventoryEvent.findFirst({
      where: {
        eventType: INVENTORY_EVENT_TYPES.PERMISSION_DENIED,
        actor: staff.session.userId,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(event).not.toBeNull();
    expect(event?.payload).toMatchObject({ permission: PERMISSIONS.BLOCK_REMOVE });
    expect(event!.createdAt.getTime()).toBeGreaterThanOrEqual(before - 500);
    expect(event!.createdAt.getTime()).toBeLessThanOrEqual(after + 500);
  });
});
