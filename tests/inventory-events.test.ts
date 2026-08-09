import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { removeBlockByBlockId } from "@/lib/blocks/remove";
import { TEST_OWNER_CONTEXT, TEST_CONTEXT } from "@/lib/context/domain-context";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import { transitionBlockStatus } from "@/lib/blocks/lifecycle";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { listInventoryEvents, listEventsForBlock } from "@/lib/events/queries";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createFormalizedImport } from "./helpers/fixtures";

describe("inventory events (B-013)", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("records formalize and seal events", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await sealOpenBlocksByInternalIds(TEST_OWNER_CONTEXT, [fixture.internalIds[0]!]);

    const sealEvent = await db.inventoryEvent.findFirst({
      where: {
        eventType: INVENTORY_EVENT_TYPES.BLOCK_SEALED,
        blockId: fixture.internalIds[0]!,
      },
    });
    expect(sealEvent?.actor).toBe(TEST_OWNER_CONTEXT.actor!.id);

    const events = await listInventoryEvents({ category: "staging" });
    expect(events.some((e) => e.eventType === INVENTORY_EVENT_TYPES.STAGING_FORMALIZED)).toBe(
      true,
    );

    const blockEvents = await listEventsForBlock(
      fixture.internalIds[0]!,
      fixture.blockIds[0]!,
    );
    expect(blockEvents.some((e) => e.eventType === INVENTORY_EVENT_TYPES.BLOCK_SEALED)).toBe(
      true,
    );
  });

  it("retains mtgBlockId in payload after block removed", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;

    await removeBlockByBlockId(TEST_OWNER_CONTEXT, blockId);

    const removed = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.BLOCK_REMOVED },
      orderBy: { createdAt: "desc" },
    });
    expect(removed).not.toBeNull();
    expect(removed?.payload).toMatchObject({
      mtgBlockId: blockId,
      priorStatus: "OPEN",
    });
    expect(removed?.summary).toContain(blockId);
    expect(removed?.actor).toBe(TEST_OWNER_CONTEXT.actor!.id);

    const bySearch = await listInventoryEvents({ mtgBlockId: blockId });
    expect(bySearch.length).toBeGreaterThan(0);
  });

  it("records lifecycle transitions in global feed", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);
    await transitionBlockStatus(TEST_CONTEXT, blockId, "ACTIVATE");
    await transitionBlockStatus(TEST_CONTEXT, blockId, "ARCHIVE");

    const events = await listInventoryEvents({ category: "blocks", limit: 20 });
    const lifecycle = events.filter((e) => e.eventType === INVENTORY_EVENT_TYPES.BLOCK_LIFECYCLE);
    expect(lifecycle.length).toBeGreaterThanOrEqual(2);
    expect(lifecycle.some((e) => e.summary.includes("ACTIVE"))).toBe(true);
    expect(lifecycle.some((e) => e.summary.includes("ARCHIVED"))).toBe(true);
  });

  it("records events across multiple blocks in global feed", async () => {
    const fixture = await createFormalizedImport(binId, 3);
    expect(fixture.blockIds).toHaveLength(3);

    const all = await listInventoryEvents({ limit: 50 });
    const formalized = all.find((e) => e.eventType === INVENTORY_EVENT_TYPES.STAGING_FORMALIZED);
    expect(formalized).toBeDefined();
    expect(formalized?.payload).toMatchObject({
      mtgBlockIds: expect.arrayContaining(fixture.blockIds),
    });
  });
});
