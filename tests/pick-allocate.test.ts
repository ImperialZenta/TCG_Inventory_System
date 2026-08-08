import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createPickListForOrder } from "@/lib/pick/create-pick-list";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
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

    const items = await db.pickItem.findMany({
      where: { pickListId: result.pickListId },
      include: { cardLine: true, block: true },
    });

    expect(items[0]?.cardLine?.position).toBe(1);
    expect(items[0]?.block?.blockId).toBe(fixture.blockIds[0]);
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
});
