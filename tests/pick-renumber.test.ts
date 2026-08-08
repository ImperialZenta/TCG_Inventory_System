import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
import { markPickItemPicked } from "@/lib/pick/mark-item";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
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
});
