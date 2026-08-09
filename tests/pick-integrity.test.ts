import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { quarantineBlockByMtgId } from "@/lib/blocks/quarantine";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
import { holdPickList, resumePickList } from "@/lib/pick/hold-list";
import { markPickItemPicked } from "@/lib/pick/mark-item";
import { reallocatePendingPickItems } from "@/lib/pick/reallocate";
import { PickError } from "@/lib/pick/errors";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { completePickListIfReady } from "@/lib/pick/complete-pick";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createFormalizedImport,
  createTestExternalOrder,
  makeBlocksPickable,
} from "./helpers/fixtures";

describe("pick integrity", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("blocks pick on quarantined block", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);
    const item = await db.pickItem.findFirst({ where: { pickListId, status: "PENDING" } });

    await quarantineBlockByMtgId(fixture.blockIds[0]!, "Suspect inventory", TEST_CONTEXT);

    await expect(markPickItemPicked(item!.id, TEST_CONTEXT)).rejects.toBeInstanceOf(PickError);
  });

  it("holds and resumes pick list", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    await holdPickList(pickListId, "Break time", TEST_CONTEXT);
    let pickList = await db.pickList.findUnique({ where: { id: pickListId } });
    expect(pickList?.status).toBe("ON_HOLD");

    await resumePickList(pickListId, TEST_CONTEXT);
    pickList = await db.pickList.findUnique({ where: { id: pickListId } });
    expect(pickList?.status).toBe("IN_PROGRESS");
  });

  it("reallocates short items when stock appears", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    let items = await db.pickItem.findMany({ where: { pickListId } });
    expect(items[0]?.status).toBe("SHORT");

    await makeBlocksPickable(fixture.internalIds);
    const result = await reallocatePendingPickItems(pickListId, TEST_CONTEXT);
    expect(result.reallocated).toBe(1);

    items = await db.pickItem.findMany({ where: { pickListId } });
    expect(items[0]?.status).toBe("PENDING");
    expect(items[0]?.cardLineId).not.toBeNull();
  });

  it("leaves line SHORT with NO_STOCK when reallocate finds no alternate", async () => {
    const { externalOrderId } = await createTestExternalOrder({
      lines: [
        {
          name: "Missing Card",
          setCode: "zzz",
          condition: "NM",
          finish: "NONFOIL",
          language: "en",
          quantity: 1,
        },
      ],
    });
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    let items = await db.pickItem.findMany({ where: { pickListId } });
    expect(items).toHaveLength(1);
    expect(items[0]?.status).toBe("SHORT");

    const result = await reallocatePendingPickItems(pickListId, TEST_CONTEXT);
    expect(result.reallocated).toBe(0);
    expect(result.stillShort).toBe(1);

    items = await db.pickItem.findMany({ where: { pickListId } });
    expect(items[0]?.status).toBe("SHORT");
    expect(items[0]?.shortReason).toBe("NO_STOCK");
    expect(items[0]?.cardLineId).toBeNull();

    await completePickListIfReady(pickListId, TEST_CONTEXT);
    const pickList = await db.pickList.findUnique({ where: { id: pickListId } });
    expect(pickList?.status).toBe("COMPLETED");
  });
});
