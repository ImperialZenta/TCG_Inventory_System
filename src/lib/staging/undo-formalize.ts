import { db } from "@/lib/db";
import { BLOCK_STATUS_LABELS } from "@/lib/constants";
import { BLOCK_HAS_PICK_HISTORY_MESSAGE } from "@/lib/blocks/pick-guard";
import { getLinkedBlocks } from "@/lib/staging/linked-blocks";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";

export class UndoFormalizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UndoFormalizeError";
  }
}

export interface ImportUndoSummary {
  blockCount: number;
  totalCards: number;
  blockIds: string[];
  canUndo: boolean;
  blockReason?: string;
}

export interface UndoFormalizeResult {
  filename: string;
  blocksRemoved: number;
  cardsRemoved: number;
  blockIds: string[];
}

function validateBlocksForUndo(
  blocks: Awaited<ReturnType<typeof getLinkedBlocks>>,
): string | null {
  for (const block of blocks) {
    if (block.status !== "OPEN") {
      const label = BLOCK_STATUS_LABELS[block.status] ?? block.status;
      return `Cannot undo — ${block.blockId} is ${label.toLowerCase()}. Undo is only for unsealed blocks.`;
    }
  }

  for (const block of blocks) {
    if (block.pickItemCount > 0) {
      return `Cannot undo — ${block.blockId}. ${BLOCK_HAS_PICK_HISTORY_MESSAGE}`;
    }
  }

  return null;
}

export async function getImportUndoSummary(importId: string): Promise<ImportUndoSummary> {
  const stagingImport = await db.stagingImport.findUnique({ where: { id: importId } });

  if (!stagingImport) {
    return {
      blockCount: 0,
      totalCards: 0,
      blockIds: [],
      canUndo: false,
      blockReason: "Import not found",
    };
  }

  if (stagingImport.status !== "ASSIGNED") {
    return {
      blockCount: 0,
      totalCards: 0,
      blockIds: [],
      canUndo: false,
      blockReason: "Import is not formalized",
    };
  }

  const blocks = await getLinkedBlocks(importId);
  const blockIds = blocks.map((b) => b.blockId).sort();
  const totalCards = blocks.reduce((sum, b) => sum + b.cardCount, 0);
  const blockReason = validateBlocksForUndo(blocks);

  return {
    blockCount: blocks.length,
    totalCards,
    blockIds,
    canUndo: blocks.length > 0 && blockReason === null,
    blockReason: blocks.length === 0 ? "Nothing to undo — no blocks linked to this import" : blockReason ?? undefined,
  };
}

export async function undoFormalizeImport(importId: string): Promise<UndoFormalizeResult> {
  const stagingImport = await db.stagingImport.findUnique({ where: { id: importId } });

  if (!stagingImport) {
    throw new UndoFormalizeError("Import not found");
  }

  if (stagingImport.status !== "ASSIGNED") {
    throw new UndoFormalizeError("Import is not formalized");
  }

  const blocks = await getLinkedBlocks(importId);

  if (blocks.length === 0) {
    throw new UndoFormalizeError("Nothing to undo — no blocks linked to this import");
  }

  const blockReason = validateBlocksForUndo(blocks);
  if (blockReason) {
    throw new UndoFormalizeError(blockReason);
  }

  const cardsRemoved = blocks.reduce((sum, b) => sum + b.cardCount, 0);
  const humanBlockIds = blocks.map((b) => b.blockId).sort();

  await db.$transaction(async (tx) => {
    const freshBlocks = await tx.block.findMany({
      where: { id: { in: blocks.map((b) => b.id) } },
      include: { _count: { select: { pickItems: true } } },
    });

    if (freshBlocks.length !== blocks.length) {
      throw new UndoFormalizeError("Blocks changed — refresh and try again");
    }

    for (const block of freshBlocks) {
      if (block.status !== "OPEN") {
        const label = BLOCK_STATUS_LABELS[block.status] ?? block.status;
        throw new UndoFormalizeError(
          `Cannot undo — ${block.blockId} is ${label.toLowerCase()}. Undo is only for unsealed blocks.`,
        );
      }
      if (block._count.pickItems > 0) {
        throw new UndoFormalizeError(
          `Cannot undo — ${block.blockId}. ${BLOCK_HAS_PICK_HISTORY_MESSAGE}`,
        );
      }
    }

    for (const block of freshBlocks) {
      await tx.block.delete({ where: { id: block.id } });
    }

    await recordInventoryEvent(tx, {
      eventType: INVENTORY_EVENT_TYPES.STAGING_UNDO_FORMALIZE,
      payload: {
        importId,
        filename: stagingImport.filename,
        mtgBlockIds: humanBlockIds,
        cardCount: cardsRemoved,
        mode: "discard",
      },
      correlationId: importId,
      stagingImportId: importId,
    });

    await tx.stagingImport.delete({ where: { id: importId } });
  });

  return {
    filename: stagingImport.filename,
    blocksRemoved: blocks.length,
    cardsRemoved,
    blockIds: humanBlockIds,
  };
}
