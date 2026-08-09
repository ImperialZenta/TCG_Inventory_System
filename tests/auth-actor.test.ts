import "./helpers/next-headers-mock";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMockCookies, setMockSessionCookie } from "./helpers/next-headers-mock";
import {
  createTestOwner,
  createTestUserWithSession,
  truncateAuthTables,
} from "./helpers/auth";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { db } from "@/lib/db";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { listInventoryEvents } from "@/lib/events/queries";
import { SYSTEM_ACTOR, formatActorDisplay } from "@/lib/context/actor";
import type { DomainContext } from "@/lib/context/domain-context";
import { sealBlockAction } from "@/app/blocks/actions";
import { formalizeStagingImportAction } from "@/app/staging/actions";
import { importExternalOrder } from "@/lib/orders/import-order";
import { pickItemAction } from "@/app/pick/actions";
import { createMultiBlockImport, createFormalizedImport, createTestExternalOrder, makeBlocksPickable } from "./helpers/fixtures";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const WEBHOOK_CONTEXT: DomainContext = {
  actor: { id: "webhook:manapool" },
  organizationId: null,
  role: null,
  source: "webhook",
};

const CRON_CONTEXT: DomainContext = {
  actor: { id: "cron:sync-orders" },
  organizationId: null,
  role: null,
  source: "api",
};

describe("ACC-003 actor on inventory events", () => {
  beforeEach(async () => {
    clearMockCookies();
    await truncateAuthTables();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("seal event records the signed-in user as actor", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-seal@test.local",
      role: "MANAGER",
    });
    const fixture = await createFormalizedImport(binId, 1);
    setMockSessionCookie(manager.token);

    const form = new FormData();
    form.set("blockId", fixture.blockIds[0]!);

    const result = await sealBlockAction(null, form);
    expect(result.ok).toBe(true);

    const event = await db.inventoryEvent.findFirst({
      where: {
        eventType: INVENTORY_EVENT_TYPES.BLOCK_SEALED,
        blockId: fixture.internalIds[0]!,
      },
    });

    expect(event?.actor).toBe(manager.session.userId);
  });

  it("formalize ignores client-supplied actor field", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      role: "STAFF",
    });
    const { importId } = await createMultiBlockImport(1);
    setMockSessionCookie(staff.token);

    const form = new FormData();
    form.set("importId", importId);
    form.set("bin_1", binId);
    form.set("actor", "evil-spoof@attacker.local");

    const result = await formalizeStagingImportAction(null, form);
    expect(result.ok).toBe(true);

    const event = await db.inventoryEvent.findFirst({
      where: {
        eventType: INVENTORY_EVENT_TYPES.STAGING_FORMALIZED,
        stagingImportId: importId,
      },
    });

    expect(event?.actor).toBe(staff.session.userId);
    expect(event?.actor).not.toBe("evil-spoof@attacker.local");
  });

  it("webhook order import attributes actor as system", async () => {
    await resetTestDb();

    await importExternalOrder(
      {
        manapoolOrderId: "WH-ACTOR-001",
        lines: [
          {
            name: "Lightning Bolt",
            setCode: "lea",
            condition: "NM",
            finish: "NONFOIL",
            language: "en",
            quantity: 1,
          },
        ],
      },
      WEBHOOK_CONTEXT,
      { importSource: "webhook" },
    );

    const event = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.ORDER_IMPORTED },
    });

    expect(event?.actor).toBe(SYSTEM_ACTOR);
  });

  it("cron context order import attributes actor as system", async () => {
    await resetTestDb();

    await importExternalOrder(
      {
        manapoolOrderId: "CRON-ACTOR-001",
        lines: [
          {
            name: "Counterspell",
            setCode: "lea",
            condition: "NM",
            finish: "NONFOIL",
            language: "en",
            quantity: 1,
          },
        ],
      },
      CRON_CONTEXT,
      { importSource: "api" },
    );

    const event = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.ORDER_IMPORTED },
    });

    expect(event?.actor).toBe(SYSTEM_ACTOR);
  });

  it("pick item picked records staff session as actor", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "staff-pick-actor@test.local",
      role: "STAFF",
    });
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId, humanPickListId } = await createPickListForOrder(
      externalOrderId,
      staff.ctx,
    );
    const item = await db.pickItem.findFirst({ where: { pickListId } });
    expect(item).not.toBeNull();

    setMockSessionCookie(staff.token);
    await pickItemAction(item!.id, humanPickListId);

    const event = await db.inventoryEvent.findFirst({
      where: {
        eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_PICKED,
        pickListId,
      },
    });

    expect(event?.actor).toBe(staff.session.userId);

    const decrement = await db.inventoryEvent.findFirst({
      where: {
        eventType: INVENTORY_EVENT_TYPES.INVENTORY_DECREMENTED,
        pickListId,
      },
    });
    expect(decrement?.actor).toBe(staff.session.userId);
    expect(decrement?.payload).toMatchObject({
      cardName: expect.any(String),
      position: expect.any(Number),
    });
    expect(decrement?.summary).toMatch(/· −1 · .+/);
  });

  it("listInventoryEvents filters by actor user id", async () => {
    const { binId } = await resetTestDb();
    const owner = await createTestOwner();
    const staff = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "staff-filter@test.local",
      role: "STAFF",
    });

    setMockSessionCookie(staff.token);
    const staffFixture = await createFormalizedImport(binId, 1);
    const staffForm = new FormData();
    staffForm.set("blockId", staffFixture.blockIds[0]!);
    await sealBlockAction(null, staffForm);

    const manager = await createTestUserWithSession({
      ownerCtx: owner.ctx,
      email: "manager-filter@test.local",
      role: "MANAGER",
    });
    const managerFixture = await createFormalizedImport(binId, 1);
    setMockSessionCookie(manager.token);
    const managerForm = new FormData();
    managerForm.set("blockId", managerFixture.blockIds[0]!);
    await sealBlockAction(null, managerForm);

    const staffEvents = await listInventoryEvents({ actor: staff.session.userId });
    const managerEvents = await listInventoryEvents({ actor: manager.session.userId });

    expect(staffEvents.some((e) => e.eventType === INVENTORY_EVENT_TYPES.BLOCK_SEALED)).toBe(
      true,
    );
    expect(managerEvents.some((e) => e.eventType === INVENTORY_EVENT_TYPES.BLOCK_SEALED)).toBe(
      true,
    );
    expect(staffEvents.every((e) => e.actor === staff.session.userId)).toBe(true);
    expect(staffEvents.every((e) => e.actor !== manager.session.userId)).toBe(true);
  });

  it("formatActorDisplay shows Unattributed for null actor", () => {
    expect(formatActorDisplay(null, new Map())).toBe("Unattributed");
    expect(formatActorDisplay(undefined, new Map())).toBe("Unattributed");
  });

  it("formatActorDisplay shows System for system actor", () => {
    expect(formatActorDisplay(SYSTEM_ACTOR, new Map())).toBe("System");
  });
});
