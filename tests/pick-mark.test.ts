import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
import { markPickItemShort, markPickItemSubstituted } from "@/lib/pick/mark-item";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createFormalizedImport,
  createTestExternalOrder,
  makeBlocksPickable,
} from "./helpers/fixtures";

describe("pick mark short and substitute (P-003 / P-004)", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("marks SHORT with reason, event, and no inventory decrement", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const blockBefore = await db.block.findUnique({
      where: { id: fixture.internalIds[0]! },
      include: { cards: true },
    });
    expect(blockBefore?.lastPickAt).toBeNull();
    const cardCountBefore = blockBefore?.cards.length ?? 0;

    const { externalOrderId } = await createTestExternalOrder({
      lines: [
        {
          name: "Test Card B1-P1",
          setCode: "tst",
          condition: "NM",
          finish: "NONFOIL",
          language: "en",
          quantity: 1,
        },
      ],
    });
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);
    const item = await db.pickItem.findFirst({
      where: { pickListId, status: "PENDING" },
    });
    expect(item).not.toBeNull();

    await markPickItemShort(item!.id, "POSITION_MISMATCH", TEST_CONTEXT);

    const shorted = await db.pickItem.findUnique({ where: { id: item!.id } });
    expect(shorted?.status).toBe("SHORT");
    expect(shorted?.shortReason).toBe("POSITION_MISMATCH");
    expect(shorted?.cardLineId).toBeNull();
    expect(shorted?.blockId).toBeNull();

    const shortEvent = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_SHORT },
    });
    expect(shortEvent).not.toBeNull();
    expect(shortEvent?.payload).toMatchObject({
      pickItemId: item!.id,
      reason: "POSITION_MISMATCH",
      cardName: "Test Card B1-P1",
    });

    const blockAfter = await db.block.findUnique({
      where: { id: fixture.internalIds[0]! },
      include: { cards: true },
    });
    expect(blockAfter?.cards).toHaveLength(cardCountBefore);
    expect(blockAfter?.lastPickAt).toBeNull();
  });

  it("same-block substitute records pick.item_substituted then ends PICKED", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    await db.cardLine.updateMany({
      where: { blockId: fixture.internalIds[0]! },
      data: {
        name: "Lightning Bolt",
        setCode: "lea",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
      },
    });

    const cards = await db.cardLine.findMany({
      where: { blockId: fixture.internalIds[0]! },
      orderBy: { position: "asc" },
    });
    expect(cards).toHaveLength(2);

    const { externalOrderId } = await createTestExternalOrder({
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
    });
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);
    const item = await db.pickItem.findFirst({
      where: { pickListId, status: "PENDING" },
      include: { cardLine: true },
    });
    expect(item?.cardLine?.position).toBe(1);

    const alternate = cards.find((c) => c.id !== item!.cardLineId);
    expect(alternate).toBeDefined();

    await markPickItemSubstituted(item!.id, alternate!.id, TEST_CONTEXT);

    const after = await db.pickItem.findUnique({ where: { id: item!.id } });
    expect(after?.status).toBe("PICKED");

    const subEvent = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_SUBSTITUTED },
    });
    expect(subEvent).not.toBeNull();
    expect(subEvent?.payload).toMatchObject({
      pickItemId: item!.id,
      fromMtgBlockId: fixture.blockIds[0],
      fromPosition: 1,
      toMtgBlockId: fixture.blockIds[0],
      toPosition: alternate!.position,
      cardName: "Lightning Bolt",
    });

    const remaining = await db.cardLine.findMany({
      where: { blockId: fixture.internalIds[0]! },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.id).not.toBe(alternate!.id);
  });
});
