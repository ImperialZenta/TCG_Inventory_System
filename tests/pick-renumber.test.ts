import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
import { markPickItemPicked } from "@/lib/pick/mark-item";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import * as events from "@/lib/events";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createFormalizedImport,
  createTestExternalOrder,
  makeBlocksPickable,
} from "./helpers/fixtures";

describe("pick renumber and completion", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("renumbers block positions after pick", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

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
      include: { cardLine: true },
    });

    expect(item?.cardLine?.position).toBe(1);

    await markPickItemPicked(item!.id, TEST_CONTEXT);

    const remaining = await db.cardLine.findMany({
      where: { blockId: fixture.internalIds[0] },
      orderBy: { position: "asc" },
    });

    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.position).toBe(1);
    expect(remaining[0]?.name).toBe("Test Card B1-P2");

    const block = await db.block.findUnique({ where: { id: fixture.internalIds[0]! } });
    expect(block?.lastPickAt).not.toBeNull();
  });

  it("writes pick history and inventory events", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);
    const item = await db.pickItem.findFirst({ where: { pickListId, status: "PENDING" } });

    await markPickItemPicked(item!.id, TEST_CONTEXT);

    const history = await db.pickHistory.findFirst({ where: { pickItemId: item!.id } });
    expect(history?.positionAtPick).toBe(1);
    expect(history?.mtgBlockId).toBe(fixture.blockIds[0]);

    const pickedEvent = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_PICKED },
    });
    expect(pickedEvent).not.toBeNull();

    const pickList = await db.pickList.findUnique({ where: { id: pickListId } });
    expect(pickList?.status).toBe("COMPLETED");

    const order = await db.externalOrder.findUnique({ where: { id: externalOrderId } });
    expect(order?.status).toBe("PICKED");
  });

  it("updates pending items on other lists when positions renumber", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const first = await createTestExternalOrder({
      manapoolOrderId: "renumber-order-1",
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
    const second = await createTestExternalOrder({
      manapoolOrderId: "renumber-order-2",
      lines: [
        {
          name: "Test Card B1-P2",
          setCode: "tst",
          condition: "NM",
          finish: "NONFOIL",
          language: "en",
          quantity: 1,
        },
      ],
    });

    const listA = await createPickListForOrder(first.externalOrderId, TEST_CONTEXT);
    const listB = await createPickListForOrder(second.externalOrderId, TEST_CONTEXT);

    const itemA = await db.pickItem.findFirst({
      where: { pickListId: listA.pickListId, status: "PENDING" },
      include: { cardLine: true },
    });
    const itemBBefore = await db.pickItem.findFirst({
      where: { pickListId: listB.pickListId, status: "PENDING" },
      include: { cardLine: true },
    });

    expect(itemA?.cardLine?.position).toBe(1);
    expect(itemBBefore?.cardLine?.position).toBe(2);
    const cardLineIdB = itemBBefore!.cardLineId!;

    await markPickItemPicked(itemA!.id, TEST_CONTEXT);

    const itemBAfter = await db.pickItem.findUnique({
      where: { id: itemBBefore!.id },
      include: { cardLine: true },
    });

    expect(itemBAfter?.status).toBe("PENDING");
    expect(itemBAfter?.cardLineId).toBe(cardLineIdB);
    expect(itemBAfter?.cardLine?.position).toBe(1);
    expect(itemBAfter?.cardLine?.name).toBe("Test Card B1-P2");
  });

  it("rolls back pick and positions when renumber transaction fails", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

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
      include: { cardLine: true },
    });

    const before = await db.cardLine.findMany({
      where: { blockId: fixture.internalIds[0]! },
      orderBy: { position: "asc" },
    });
    expect(before).toHaveLength(2);

    const spy = vi.spyOn(events, "recordInventoryEvent").mockRejectedValueOnce(
      new Error("forced event failure"),
    );

    await expect(markPickItemPicked(item!.id, TEST_CONTEXT)).rejects.toThrow(
      /forced event failure/,
    );
    spy.mockRestore();

    const afterItem = await db.pickItem.findUnique({ where: { id: item!.id } });
    expect(afterItem?.status).toBe("PENDING");

    const after = await db.cardLine.findMany({
      where: { blockId: fixture.internalIds[0]! },
      orderBy: { position: "asc" },
    });
    expect(after).toHaveLength(2);
    expect(after.map((c) => c.position)).toEqual([1, 2]);
    expect(after.map((c) => c.name)).toEqual(["Test Card B1-P1", "Test Card B1-P2"]);
  });
});
