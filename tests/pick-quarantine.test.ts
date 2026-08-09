import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { quarantineBlockByMtgId } from "@/lib/blocks/quarantine";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import { transitionBlockStatus } from "@/lib/blocks/lifecycle";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
import { PickError } from "@/lib/pick/errors";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createFormalizedImport,
  createTestExternalOrder,
  makeBlocksPickable,
} from "./helpers/fixtures";

describe("block quarantine (P-011 / P-012)", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("quarantines a pickable block with reason and inventory event", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    await quarantineBlockByMtgId(fixture.blockIds[0]!, "POSITION_MISMATCH", TEST_CONTEXT);

    const block = await db.block.findUnique({ where: { id: fixture.internalIds[0]! } });
    expect(block?.pickHoldAt).not.toBeNull();
    expect(block?.pickHoldReason).toBe("POSITION_MISMATCH");

    const event = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.BLOCK_QUARANTINED },
    });
    expect(event).not.toBeNull();
    expect(event?.payload).toMatchObject({
      mtgBlockId: fixture.blockIds[0],
      reason: "POSITION_MISMATCH",
    });
    expect(event?.blockId).toBe(fixture.internalIds[0]);
  });

  it("excludes quarantined blocks from new allocation", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    await quarantineBlockByMtgId(fixture.blockIds[0]!, "Suspect inventory", TEST_CONTEXT);

    const { externalOrderId } = await createTestExternalOrder();
    const result = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    expect(result.shortCount).toBe(1);
    const items = await db.pickItem.findMany({ where: { pickListId: result.pickListId } });
    expect(items[0]?.status).toBe("SHORT");
    expect(items[0]?.blockId).toBeNull();
  });

  it("holds open pick lists that have pending items on the quarantined block", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const first = await createTestExternalOrder({ manapoolOrderId: "hold-order-1" });
    const { pickListId: listA } = await createPickListForOrder(first.externalOrderId, TEST_CONTEXT);

    // Second list targets the other card in the same block.
    const second = await createTestExternalOrder({
      manapoolOrderId: "hold-order-2",
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
    const { pickListId: listB } = await createPickListForOrder(
      second.externalOrderId,
      TEST_CONTEXT,
    );

    await quarantineBlockByMtgId(fixture.blockIds[0]!, "POSITION_MISMATCH", TEST_CONTEXT);

    const [a, b] = await Promise.all([
      db.pickList.findUnique({ where: { id: listA } }),
      db.pickList.findUnique({ where: { id: listB } }),
    ]);

    expect(a?.status).toBe("ON_HOLD");
    expect(b?.status).toBe("ON_HOLD");
    expect(a?.holdReason).toContain(fixture.blockIds[0]!);
    expect(a?.holdReason).toContain("POSITION_MISMATCH");
    expect(a?.holdReason).toMatch(/line:/i);
    expect(b?.holdReason).toContain(fixture.blockIds[0]!);

    const pending = await db.pickItem.findMany({
      where: { blockId: fixture.internalIds[0]!, status: "PENDING" },
    });
    expect(pending).toHaveLength(2);
    expect(pending.every((i) => i.blockedReason === "POSITION_MISMATCH")).toBe(true);

    const event = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.BLOCK_QUARANTINED },
    });
    const payload = event?.payload as { heldPickListIds?: string[] };
    expect(payload.heldPickListIds).toEqual(
      expect.arrayContaining([a!.pickListId, b!.pickListId]),
    );
  });

  it("refuses to quarantine an OPEN block", async () => {
    const fixture = await createFormalizedImport(binId, 1);

    await expect(
      quarantineBlockByMtgId(fixture.blockIds[0]!, "too soon", TEST_CONTEXT),
    ).rejects.toBeInstanceOf(PickError);

    const block = await db.block.findUnique({ where: { id: fixture.internalIds[0]! } });
    expect(block?.pickHoldAt).toBeNull();
  });

  it("refuses to quarantine a LIQUIDATED block", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT,fixture.internalIds);
    await transitionBlockStatus(TEST_CONTEXT, fixture.blockIds[0]!, "ACTIVATE");
    await transitionBlockStatus(TEST_CONTEXT, fixture.blockIds[0]!, "ARCHIVE");
    await transitionBlockStatus(TEST_CONTEXT, fixture.blockIds[0]!, "LIQUIDATE");

    await expect(
      quarantineBlockByMtgId(fixture.blockIds[0]!, "already gone", TEST_CONTEXT),
    ).rejects.toBeInstanceOf(PickError);

    const block = await db.block.findUnique({ where: { id: fixture.internalIds[0]! } });
    expect(block?.status).toBe("LIQUIDATED");
    expect(block?.pickHoldAt).toBeNull();
  });
});
