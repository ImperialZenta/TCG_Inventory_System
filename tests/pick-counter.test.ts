import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { recordCounterPick } from "@/lib/pick/counter-pick";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createFormalizedImport, makeBlocksPickable } from "./helpers/fixtures";
import { db } from "@/lib/db";

describe("counter pick", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("consumes card and writes pick history", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);

    const result = await recordCounterPick(
      { mtgBlockId: fixture.blockIds[0]!, position: 1 },
      TEST_CONTEXT,
    );

    expect(result.cardName).toBe("Test Card B1-P1");

    const block = await db.block.findUnique({
      where: { blockId: fixture.blockIds[0]! },
      include: { cards: true },
    });
    expect(block?.cards).toHaveLength(1);
    expect(block?.lastPickAt).not.toBeNull();

    const history = await db.pickHistory.findFirst({
      where: { mtgBlockId: fixture.blockIds[0]!, isCounterPick: true },
    });
    expect(history).not.toBeNull();

    const counterEvent = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.PICK_COUNTER },
    });
    expect(counterEvent).not.toBeNull();
    expect(counterEvent?.payload).toMatchObject({
      mtgBlockId: fixture.blockIds[0],
      position: 1,
      cardName: "Test Card B1-P1",
    });
  });
});
