import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createCorrectionImport } from "@/lib/staging/create-correction-import";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events/types";
import { disconnectTestDb, resetTestDb } from "./helpers/db";

describe("correction import", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("creates CORRECTION staging import with event link", async () => {
    const pickList = await db.pickList.create({
      data: { pickListId: "PICK-0001", status: "ON_HOLD" },
    });

    const { importId } = await createCorrectionImport(
      {
        filename: "correction-test.csv",
        cards: [{ name: "Lightning Bolt", setCode: "lea" }],
        sourcePickListId: pickList.id,
        sourceMtgBlockId: "MTG-0007",
      },
      TEST_CONTEXT,
    );

    const staging = await db.stagingImport.findUnique({ where: { id: importId } });
    expect(staging?.kind).toBe("CORRECTION");
    expect(staging?.sourceMtgBlockId).toBe("MTG-0007");

    const event = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.STAGING_CORRECTION_CREATED },
    });
    expect(event).not.toBeNull();
  });
});
