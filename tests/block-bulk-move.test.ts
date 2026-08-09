import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { bulkMoveBlocksInBin, bulkMoveBlocksToBin, moveBlockToBin } from "@/lib/blocks/move";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createFormalizedImport, makeBlocksPickable } from "./helpers/fixtures";

describe("block bulk move", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("moves multiple selected blocks atomically", async () => {
    const fixture = await createFormalizedImport(binId, 3);

    const shelfB = await db.shelf.create({
      data: { code: "B", label: "Shelf B", sortOrder: 2 },
    });
    const targetBin = await db.bin.create({
      data: { binId: "B-B01", shelfId: shelfB.id, label: "Bin B01", sortOrder: 1 },
    });

    const result = await bulkMoveBlocksToBin(
      TEST_CONTEXT,
      [fixture.blockIds[0]!, fixture.blockIds[1]!],
      targetBin.id,
    );

    expect(result.moved).toBe(2);

    const moved = await db.block.findMany({
      where: { blockId: { in: [fixture.blockIds[0]!, fixture.blockIds[1]!] } },
    });
    expect(moved.every((b) => b.binId === targetBin.id)).toBe(true);

    const left = await db.block.findUnique({ where: { blockId: fixture.blockIds[2]! } });
    expect(left?.binId).toBe(binId);
  });

  it("moves every block in a source bin", async () => {
    const fixture = await createFormalizedImport(binId, 2);

    const shelfB = await db.shelf.create({
      data: { code: "B", label: "Shelf B", sortOrder: 2 },
    });
    const targetBin = await db.bin.create({
      data: { binId: "B-B02", shelfId: shelfB.id, label: "Bin B02", sortOrder: 1 },
    });

    const result = await bulkMoveBlocksInBin(TEST_CONTEXT, binId, targetBin.id);
    expect(result.moved).toBe(2);

    const blocks = await db.block.findMany({ where: { binId: targetBin.id } });
    expect(blocks).toHaveLength(2);
  });

  it("records a move event per block", async () => {
    const fixture = await createFormalizedImport(binId, 1);

    const shelfB = await db.shelf.create({
      data: { code: "B", label: "Shelf B", sortOrder: 2 },
    });
    const targetBin = await db.bin.create({
      data: { binId: "B-B03", shelfId: shelfB.id, label: "Bin B03", sortOrder: 1 },
    });

    await moveBlockToBin(TEST_CONTEXT, fixture.blockIds[0]!, targetBin.id);

    const events = await db.inventoryEvent.findMany({
      where: { eventType: INVENTORY_EVENT_TYPES.BLOCK_MOVED },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.summary).toContain(fixture.blockIds[0]!);
  });

  it("refuses unknown destination bin", async () => {
    const fixture = await createFormalizedImport(binId, 1);

    await expect(
      bulkMoveBlocksToBin(TEST_CONTEXT, [fixture.blockIds[0]!], "nonexistent-bin-id"),
    ).rejects.toThrow(/Bin not found/);
  });
});
