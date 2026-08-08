import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { holdPickList } from "@/lib/pick/hold-list";
import { completePickListIfReady } from "@/lib/pick/complete-pick";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
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

  it("refuses completion while ON_HOLD", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const { externalOrderId } = await createTestExternalOrder();
    const { pickListId } = await createPickListForOrder(externalOrderId, TEST_CONTEXT);

    await holdPickList(pickListId, "Test hold", TEST_CONTEXT);

    const completed = await completePickListIfReady(pickListId, TEST_CONTEXT);
    expect(completed).toBe(false);

    const pickList = await db.pickList.findUnique({ where: { id: pickListId } });
    expect(pickList?.status).toBe("ON_HOLD");
  });
});
