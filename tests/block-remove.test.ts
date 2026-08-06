import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { removeBlockByBlockId, RemoveBlockError } from "@/lib/blocks/remove";
import { formalizeStagingImport } from "@/lib/staging/formalize";
import { BLOCK_HAS_PICK_HISTORY_MESSAGE } from "@/lib/blocks/pick-guard";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createFormalizedImport,
  seedPickItemForBlock,
} from "./helpers/fixtures";

describe("block remove (I-015 / I-021 current behavior)", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("partial remove leaves other blocks and orphaned staging cards", async () => {
    const fixture = await createFormalizedImport(binId, 3);
    const removedId = fixture.blockIds[0]!;
    const keptIds = fixture.blockIds.slice(1);
    const removedInternal = fixture.internalIds[0]!;

    const stagingBefore = await db.stagingCard.count({
      where: { stagingImportId: fixture.importId },
    });

    const result = await removeBlockByBlockId(removedId);

    expect(result.importUnlocked).toBe(false);
    expect(result.remainingBlocksOnImport).toBe(2);
    expect(result.stagingImportId).toBe(fixture.importId);

    const gone = await db.block.findUnique({ where: { blockId: removedId } });
    expect(gone).toBeNull();

    const kept = await db.block.findMany({
      where: { blockId: { in: keptIds } },
    });
    expect(kept).toHaveLength(2);

    const orphans = await db.stagingCard.findMany({
      where: { stagingImportId: fixture.importId, assignedBlockId: null },
    });
    expect(orphans.length).toBeGreaterThan(0);
    expect(orphans.every((c) => c.assignedBlockId === null)).toBe(true);

    // No silent card loss — staging row count unchanged
    const stagingAfter = await db.stagingCard.count({
      where: { stagingImportId: fixture.importId },
    });
    expect(stagingAfter).toBe(stagingBefore);

    const linkedToRemoved = await db.stagingCard.count({
      where: { assignedBlockId: removedInternal },
    });
    expect(linkedToRemoved).toBe(0);

    const importRow = await db.stagingImport.findUnique({
      where: { id: fixture.importId },
    });
    expect(importRow?.status).toBe("ASSIGNED");
  });

  it("removing all blocks unlocks the import to PARSED", async () => {
    const fixture = await createFormalizedImport(binId, 3);

    await removeBlockByBlockId(fixture.blockIds[0]!);
    await removeBlockByBlockId(fixture.blockIds[1]!);
    const last = await removeBlockByBlockId(fixture.blockIds[2]!);

    expect(last.importUnlocked).toBe(true);
    expect(last.remainingBlocksOnImport).toBe(0);

    const importRow = await db.stagingImport.findUnique({
      where: { id: fixture.importId },
    });
    expect(importRow?.status).toBe("PARSED");

    const stillAssigned = await db.stagingCard.count({
      where: { stagingImportId: fixture.importId, assignedBlockId: { not: null } },
    });
    expect(stillAssigned).toBe(0);
  });

  it("remove all then delete staging succeeds", async () => {
    const fixture = await createFormalizedImport(binId, 2);

    for (const blockId of fixture.blockIds) {
      await removeBlockByBlockId(blockId);
    }

    const stillLinked = await db.stagingCard.count({
      where: { stagingImportId: fixture.importId, assignedBlockId: { not: null } },
    });
    expect(stillLinked).toBe(0);

    await db.stagingImport.delete({ where: { id: fixture.importId } });

    const gone = await db.stagingImport.findUnique({
      where: { id: fixture.importId },
    });
    expect(gone).toBeNull();
  });

  it("remove all then re-formalize allocates new MTG IDs", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    const originalIds = [...fixture.blockIds];

    for (const blockId of fixture.blockIds) {
      await removeBlockByBlockId(blockId);
    }

    const importRow = await db.stagingImport.findUnique({
      where: { id: fixture.importId },
    });
    expect(importRow?.status).toBe("PARSED");

    const binAssignments: Record<number, string> = {
      1: binId,
      2: binId,
    };
    const newBlockIds = await formalizeStagingImport(fixture.importId, binAssignments);

    expect(newBlockIds).toHaveLength(2);
    for (const id of newBlockIds) {
      expect(originalIds).not.toContain(id);
    }

    const reassigned = await db.stagingImport.findUnique({
      where: { id: fixture.importId },
    });
    expect(reassigned?.status).toBe("ASSIGNED");

    const cardLines = await db.cardLine.count({
      where: { block: { blockId: { in: newBlockIds } } },
    });
    expect(cardLines).toBe(4);
  });

  it("refuses remove when pick history exists (B-010)", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    const blockId = fixture.blockIds[0]!;
    await seedPickItemForBlock(blockId);

    await expect(removeBlockByBlockId(blockId)).rejects.toBeInstanceOf(RemoveBlockError);
    await expect(removeBlockByBlockId(blockId)).rejects.toThrow(
      BLOCK_HAS_PICK_HISTORY_MESSAGE,
    );

    const stillThere = await db.block.findUnique({ where: { blockId } });
    expect(stillThere).not.toBeNull();
  });
});
