import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { sealOpenBlocksByInternalIds } from "@/lib/blocks/seal";
import {
  getImportUndoSummary,
  undoFormalizeImport,
  UndoFormalizeError,
} from "@/lib/staging/undo-formalize";
import { BLOCK_HAS_PICK_HISTORY_MESSAGE } from "@/lib/blocks/pick-guard";
import { receiveStock } from "@/lib/stock";
import { createTestChannel } from "./helpers/channels";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import {
  createFormalizedImport,
  createMultiBlockImport,
  seedPickItemForBlock,
} from "./helpers/fixtures";

describe("undo formalize (I-023)", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("removes all linked blocks and deletes the staging import", async () => {
    const fixture = await createFormalizedImport(binId, 3);

    const result = await undoFormalizeImport(TEST_CONTEXT,fixture.importId);

    expect(result.blocksRemoved).toBe(3);
    expect(result.cardsRemoved).toBe(6);
    expect(result.blockIds).toEqual(fixture.blockIds);

    const remainingImport = await db.stagingImport.findUnique({
      where: { id: fixture.importId },
    });
    expect(remainingImport).toBeNull();

    const remainingBlocks = await db.block.findMany({
      where: { blockId: { in: fixture.blockIds } },
    });
    expect(remainingBlocks).toHaveLength(0);

    const event = await db.inventoryEvent.findFirst({
      where: { eventType: "staging.undo_formalize" },
      orderBy: { createdAt: "desc" },
    });
    expect(event).not.toBeNull();
    expect(event?.summary).toContain("Undo formalize");
  });

  it("reports canUndo true before undo and nothing after import is gone", async () => {
    const fixture = await createFormalizedImport(binId, 2);

    const before = await getImportUndoSummary(fixture.importId);
    expect(before.canUndo).toBe(true);
    expect(before.blockCount).toBe(2);

    await undoFormalizeImport(TEST_CONTEXT,fixture.importId);

    const after = await getImportUndoSummary(fixture.importId);
    expect(after.canUndo).toBe(false);
    expect(after.blockReason).toBe("Import not found");
  });

  it("blocks undo when any linked block is sealed", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await sealOpenBlocksByInternalIds(TEST_CONTEXT, [fixture.internalIds[0]!]);

    const summary = await getImportUndoSummary(fixture.importId);
    expect(summary.canUndo).toBe(false);
    expect(summary.blockReason).toMatch(/sealed/i);

    await expect(undoFormalizeImport(TEST_CONTEXT,fixture.importId)).rejects.toBeInstanceOf(
      UndoFormalizeError,
    );
    await expect(undoFormalizeImport(TEST_CONTEXT,fixture.importId)).rejects.toThrow(/sealed/i);

    const stillThere = await db.stagingImport.findUnique({
      where: { id: fixture.importId },
    });
    expect(stillThere).not.toBeNull();
  });

  it("blocks undo when import is not formalized", async () => {
    const { importId } = await createMultiBlockImport(2);

    await expect(undoFormalizeImport(TEST_CONTEXT,importId)).rejects.toThrow(/not formalized/i);

    const summary = await getImportUndoSummary(importId);
    expect(summary.canUndo).toBe(false);
    expect(summary.blockReason).toMatch(/not formalized/i);
  });

  it("blocks undo when a linked block has pick history", async () => {
    const fixture = await createFormalizedImport(binId, 2);
    await seedPickItemForBlock(fixture.blockIds[0]!);

    await expect(undoFormalizeImport(TEST_CONTEXT, fixture.importId)).rejects.toBeInstanceOf(
      UndoFormalizeError,
    );
    await expect(undoFormalizeImport(TEST_CONTEXT, fixture.importId)).rejects.toThrow(
      BLOCK_HAS_PICK_HISTORY_MESSAGE,
    );

    const stillThere = await db.block.findMany({
      where: { blockId: { in: fixture.blockIds } },
    });
    expect(stillThere).toHaveLength(2);
  });

  it("blocks undo when linked cards have active channel listings", async () => {
    const fixture = await createFormalizedImport(binId, 1);
    const card = await db.cardLine.findFirst({ where: { block: { blockId: fixture.blockIds[0] } } });
    expect(card).not.toBeNull();

    const catalogCardId = "undo-guard-bolt";
    await db.cardLine.update({
      where: { id: card!.id },
      data: { scryfallId: catalogCardId },
    });

    const received = await receiveStock(
      TEST_CONTEXT,
      {
        scryfallId: catalogCardId,
        name: card!.name,
        setCode: card!.setCode,
        collectorNumber: card!.collectorNumber,
        finish: card!.finish,
        language: card!.language,
        condition: card!.condition,
      },
      1,
    );

    const channel = await createTestChannel({ name: "Test", type: "MANAPOOL" });
    await db.channelListing.create({
      data: {
        channelId: channel.id,
        stockItemId: received.stockItem.id,
        status: "ACTIVE",
        externalListingId: "live-1",
      },
    });

    const summary = await getImportUndoSummary(fixture.importId);
    expect(summary.canUndo).toBe(false);
    expect(summary.blockReason).toMatch(/active channel listings/i);

    await expect(undoFormalizeImport(TEST_CONTEXT, fixture.importId)).rejects.toThrow(
      /active channel listings/i,
    );
  });
});
