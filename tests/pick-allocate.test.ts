import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createFormalizedImport,
  createTestExternalOrder,
  makeBlocksPickable,
  seedPickItemForBlock,
} from "./helpers/fixtures";

describe("pick allocation", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("allocates lowest position from smallest block", async () => {
    const fixture = await createFormalizedImport(binId, 2);
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

    const result = await createPickListForOrder(externalOrderId, TEST_CONTEXT);
    expect(result.itemCount).toBe(1);
    expect(result.shortCount).toBe(0);
    expect(result.humanPickListId).toBe("PICK-0001");

    const items = await db.pickItem.findMany({
      where: { pickListId: result.pickListId },
      include: { cardLine: true, block: true },
    });

    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe("PENDING");
    expect(items[0]?.cardLine?.position).toBe(1);
    expect(items[0]?.block?.blockId).toBe(fixture.blockIds[0]);
  });

  it("assigns sequential pick list IDs across orders", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await makeBlocksPickable(fixture.internalIds);

    const first = await createTestExternalOrder({
      manapoolOrderId: "seq-order-1",
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
      manapoolOrderId: "seq-order-2",
      lines: [
        {
          name: "Test Card B2-P1",
          setCode: "tst",
          condition: "NM",
          finish: "NONFOIL",
          language: "en",
          quantity: 1,
        },
      ],
    });

    const a = await createPickListForOrder(first.externalOrderId, TEST_CONTEXT);
    const b = await createPickListForOrder(second.externalOrderId, TEST_CONTEXT);

    expect(a.humanPickListId).toBe("PICK-0001");
    expect(b.humanPickListId).toBe("PICK-0002");
  });

  it("records pick list created and item allocated events", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const result = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    const created = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.PICK_LIST_CREATED },
    });
    expect(created).not.toBeNull();
    expect(created?.payload).toMatchObject({
      pickListId: result.humanPickListId,
      itemCount: 1,
    });

    const allocated = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_ALLOCATED },
    });
    expect(allocated).not.toBeNull();
    expect(allocated?.payload).toMatchObject({
      pickListId: result.humanPickListId,
      mtgBlockId: fixture.blockIds[0],
      position: 1,
      cardName: "Test Card B1-P1",
    });
    expect(allocated?.blockId).toBe(fixture.internalIds[0]);
  });

  it("does not allocate from OPEN blocks", async () => {
    await createFormalizedImport(binId, 1);
    // Leave blocks OPEN — unsealed inventory must not be allocated.

    const { externalOrderId } = await createTestExternalOrder();
    const result = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    expect(result.shortCount).toBe(1);

    const items = await db.pickItem.findMany({ where: { pickListId: result.pickListId } });
    expect(items[0]?.status).toBe("SHORT");
    expect(items[0]?.blockId).toBeNull();
    expect(items[0]?.cardLineId).toBeNull();
  });

  it("excludes card lines reserved by other open pick lists", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    await seedPickItemForBlock(fixture.blockIds[0]!);

    const { externalOrderId } = await createTestExternalOrder();
    const result = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    const items = await db.pickItem.findMany({ where: { pickListId: result.pickListId } });
    expect(items[0]?.status).toBe("SHORT");
  });

  it("marks lines short when no stock", async () => {
    const { externalOrderId } = await createTestExternalOrder();
    const result = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    expect(result.shortCount).toBe(1);
  });

  it("generates remaining lines when one line is short", async () => {
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
        {
          name: "Missing Card That Does Not Exist",
          setCode: "tst",
          condition: "NM",
          finish: "NONFOIL",
          language: "en",
          quantity: 1,
        },
      ],
    });

    const result = await createPickListForOrder(externalOrderId, TEST_CONTEXT);
    expect(result.itemCount).toBe(2);
    expect(result.shortCount).toBe(1);

    const items = await db.pickItem.findMany({
      where: { pickListId: result.pickListId },
      include: { cardLine: true, block: true, externalOrderLine: true },
    });

    const allocated = items.find((i) => i.status === "PENDING");
    const short = items.find((i) => i.status === "SHORT");

    expect(allocated?.block?.blockId).toBe(fixture.blockIds[0]);
    expect(allocated?.cardLine?.position).toBe(1);
    expect(short?.blockId).toBeNull();
    expect(short?.externalOrderLine?.name).toBe("Missing Card That Does Not Exist");
  });

  it("allocates the lowest position among duplicate printings in one block", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const blockId = fixture.internalIds[0]!;
    await db.cardLine.updateMany({
      where: { blockId },
      data: {
        name: "Lightning Bolt",
        setCode: "lea",
        condition: "NM",
        finish: "NONFOIL",
        language: "en",
      },
    });

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

    const result = await createPickListForOrder(externalOrderId, TEST_CONTEXT);
    expect(result.shortCount).toBe(0);

    const item = await db.pickItem.findFirst({
      where: { pickListId: result.pickListId },
      include: { cardLine: true },
    });
    expect(item?.cardLine?.position).toBe(1);
    expect(item?.cardLine?.name).toBe("Lightning Bolt");
  });
});
