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
import {
  getCardQuantitySummary,
  searchCardLocations,
} from "@/lib/inventory";

describe("inventory search and quantity", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("finds card locations across blocks and printings", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await db.cardLine.updateMany({
      where: { block: { blockId: fixture.blockIds[0] } },
      data: { name: "Lightning Bolt", setCode: "lea", collectorNumber: "161" },
    });
    await db.cardLine.updateMany({
      where: { block: { blockId: fixture.blockIds[1] } },
      data: { name: "Lightning Bolt", setCode: "m11", collectorNumber: "146" },
    });

    const result = await searchCardLocations({ name: "Lightning Bolt" });
    expect(result.printings).toHaveLength(2);
    expect(result.printings.flatMap((p) => p.locations)).toHaveLength(4);
  });

  it("excludes OPEN block copies from sellable available total", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await makeBlocksPickable([fixture.internalIds[1]!]);

    await db.cardLine.updateMany({
      where: { block: { blockId: fixture.blockIds[0] } },
      data: { name: "Shared Bolt", setCode: "lea" },
    });
    await db.cardLine.updateMany({
      where: { block: { blockId: fixture.blockIds[1] } },
      data: { name: "Shared Bolt", setCode: "lea" },
    });

    const summary = await getCardQuantitySummary({ name: "Shared Bolt", setCode: "lea" });
    expect(summary).not.toBeNull();
    expect(summary!.onHand).toBe(4);
    expect(summary!.inPacking).toBe(2);
    expect(summary!.sellableOnHand).toBe(2);
    expect(summary!.available).toBe(2);
  });

  it("subtracts allocated copies from available", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    await makeBlocksPickable(fixture.internalIds);
    await db.cardLine.updateMany({
      data: { name: "Reserved Bolt", setCode: "lea" },
    });

    await seedPickItemForBlock(fixture.blockIds[0]!);

    const summary = await getCardQuantitySummary({ name: "Reserved Bolt", setCode: "lea" });
    expect(summary!.onHand).toBe(2);
    expect(summary!.allocated).toBe(1);
    expect(summary!.available).toBe(1);
  });

  it("returns null when no copies exist", async () => {
    const summary = await getCardQuantitySummary({ name: "Nonexistent Card" });
    expect(summary).toBeNull();
  });
});

describe("pick waves", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("creates one wave per shelf at pick list generation", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await makeBlocksPickable(fixture.internalIds);

    const shelfB = await db.shelf.create({
      data: { code: "B", label: "Shelf B", sortOrder: 2 },
    });
    const binB = await db.bin.create({
      data: { binId: "B-B01", shelfId: shelfB.id, label: "Bin B", sortOrder: 1 },
    });
    await db.block.update({
      where: { blockId: fixture.blockIds[1]! },
      data: { binId: binB.id },
    });

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
          name: "Test Card B2-P1",
          setCode: "tst",
          condition: "NM",
          finish: "NONFOIL",
          language: "en",
          quantity: 1,
        },
      ],
    });

    const result = await createPickListForOrder(externalOrderId, TEST_CONTEXT);
    const waves = await db.pickWave.findMany({
      where: { pickListId: result.pickListId },
      orderBy: { waveNumber: "asc" },
      include: { items: true },
    });

    expect(waves).toHaveLength(2);
    expect(waves[0]?.label).toContain("TEST-A");
    expect(waves[1]?.label).toContain("B");
    expect(waves[0]?.items).toHaveLength(1);
    expect(waves[1]?.items).toHaveLength(1);
  });
});
