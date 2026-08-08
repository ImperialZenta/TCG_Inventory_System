import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { clearBlockPickHold, quarantineBlockByMtgId } from "@/lib/blocks/quarantine";
import { holdPickList, resumePickList } from "@/lib/pick/hold-list";
import { completePickListIfReady } from "@/lib/pick/complete-pick";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
import { markPickItemPicked } from "@/lib/pick/mark-item";
import { reallocatePendingPickItems } from "@/lib/pick/reallocate";
import { PickError } from "@/lib/pick/errors";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createFormalizedImport,
  createTestExternalOrder,
  makeBlocksPickable,
} from "./helpers/fixtures";

describe("pick hold guard", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("refuses completion while ON_HOLD and surfaces hold reason", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    await holdPickList(pickListId, "Test hold", TEST_CONTEXT);

    await expect(completePickListIfReady(pickListId, TEST_CONTEXT)).rejects.toThrow(
      /Cannot complete pick list while ON_HOLD.*Hold reason: Test hold/is,
    );

    const pickList = await db.pickList.findUnique({ where: { id: pickListId } });
    expect(pickList?.status).toBe("ON_HOLD");
  });

  it("quarantine auto-holds the list and lists blocked lines with reasons on complete", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);
    const item = await db.pickItem.findFirst({
      where: { pickListId, status: "PENDING" },
      include: { cardLine: true, externalOrderLine: true },
    });

    await quarantineBlockByMtgId(fixture.blockIds[0]!, "POSITION_MISMATCH", TEST_CONTEXT);

    const pickList = await db.pickList.findUnique({ where: { id: pickListId } });
    expect(pickList?.status).toBe("ON_HOLD");
    expect(pickList?.holdReason).toContain("quarantined");
    expect(pickList?.holdReason).toContain(fixture.blockIds[0]!);
    expect(pickList?.holdReason).toMatch(/line:/i);

    await expect(markPickItemPicked(item!.id, TEST_CONTEXT)).rejects.toBeInstanceOf(PickError);

    const cardName = item!.externalOrderLine?.name ?? item!.cardLine?.name ?? "Test Card B1-P1";
    const position = item!.cardLine?.position ?? 1;
    await expect(completePickListIfReady(pickListId, TEST_CONTEXT)).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(PickError);
        const message = (error as Error).message;
        expect(message).toMatch(/Cannot complete pick list while ON_HOLD/i);
        expect(message).toContain("Blocked lines");
        expect(message).toContain(fixture.blockIds[0]!);
        expect(message).toContain(`pos ${position}`);
        expect(message).toContain(cardName);
        expect(message).toContain("POSITION_MISMATCH");
        return true;
      },
    );
  });

  it("refuses resume while quarantine flags remain, then allows after clear", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    await quarantineBlockByMtgId(fixture.blockIds[0]!, "POSITION_MISMATCH", TEST_CONTEXT);

    await expect(resumePickList(pickListId, TEST_CONTEXT)).rejects.toThrow(
      /Cannot resume|blocked by quarantine/i,
    );

    await clearBlockPickHold(fixture.internalIds[0]!, TEST_CONTEXT);

    const pickList = await db.pickList.findUnique({ where: { id: pickListId } });
    expect(pickList?.status).toBe("IN_PROGRESS");
    expect(pickList?.holdReason).toBeNull();

    const item = await db.pickItem.findFirst({ where: { pickListId } });
    expect(item?.blockedReason).toBeNull();
  });

  it("releases ON_HOLD when pending lines are re-allocated off a quarantined block", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await makeBlocksPickable(fixture.internalIds);

    await db.cardLine.updateMany({
      where: { blockId: { in: fixture.internalIds } },
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
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    const itemBefore = await db.pickItem.findFirst({
      where: { pickListId, status: "PENDING" },
      include: { block: true },
    });
    expect(itemBefore?.block?.blockId).toBe(fixture.blockIds[0]);

    await quarantineBlockByMtgId(fixture.blockIds[0]!, "POSITION_MISMATCH", TEST_CONTEXT);

    const held = await db.pickList.findUnique({ where: { id: pickListId } });
    expect(held?.status).toBe("ON_HOLD");

    const result = await reallocatePendingPickItems(pickListId, TEST_CONTEXT);
    expect(result.reallocated).toBe(1);
    expect(result.stillShort).toBe(0);

    const released = await db.pickList.findUnique({ where: { id: pickListId } });
    expect(released?.status).toBe("IN_PROGRESS");
    expect(released?.holdReason).toBeNull();

    const itemAfter = await db.pickItem.findFirst({
      where: { pickListId },
      include: { block: true },
    });
    expect(itemAfter?.status).toBe("PENDING");
    expect(itemAfter?.blockedReason).toBeNull();
    expect(itemAfter?.block?.blockId).toBe(fixture.blockIds[1]);
  });
});
