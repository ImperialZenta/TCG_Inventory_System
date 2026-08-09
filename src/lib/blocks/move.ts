import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";

type TransactionClient = Prisma.TransactionClient;

export function formatBinLocation(shelfCode: string | null | undefined, binId: string): string {
  if (!shelfCode) return binId;
  return `${shelfCode} / ${binId}`;
}

export class BlockMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockMoveError";
  }
}

export interface MoveBlockResult {
  blockId: string;
  mtgBlockId: string;
  fromLabel: string;
  toLabel: string;
  skipped: boolean;
}

async function moveOneBlockInTx(
  tx: TransactionClient,
  mtgBlockId: string,
  targetBinId: string,
  ctx: DomainContext,
): Promise<MoveBlockResult> {
  const block = await tx.block.findUnique({
    where: { blockId: mtgBlockId },
    include: { bin: { include: { shelf: true } } },
  });

  if (!block) {
    throw new BlockMoveError(`Block not found: ${mtgBlockId}`);
  }

  const targetBin = await tx.bin.findUnique({
    where: { id: targetBinId },
    include: { shelf: true },
  });

  if (!targetBin) {
    throw new BlockMoveError("Bin not found");
  }

  const fromLabel = block.bin
    ? formatBinLocation(block.bin.shelf?.code, block.bin.binId)
    : "Unassigned";
  const toLabel = formatBinLocation(targetBin.shelf?.code, targetBin.binId);

  if (block.binId === targetBin.id) {
    return {
      blockId: block.id,
      mtgBlockId: block.blockId,
      fromLabel,
      toLabel,
      skipped: true,
    };
  }

  await tx.block.update({
    where: { id: block.id },
    data: { binId: targetBin.id },
  });

  await recordInventoryEvent(tx, ctx, {
    eventType: INVENTORY_EVENT_TYPES.BLOCK_MOVED,
    payload: {
      mtgBlockId: block.blockId,
      fromBin: fromLabel,
      toBin: toLabel,
    },
    blockId: block.id,
  });

  return {
    blockId: block.id,
    mtgBlockId: block.blockId,
    fromLabel,
    toLabel,
    skipped: false,
  };
}

export async function moveBlockToBin(
  ctx: DomainContext,
  mtgBlockId: string,
  targetBinId: string,
): Promise<MoveBlockResult> {
  return db.$transaction((tx) => moveOneBlockInTx(tx, mtgBlockId, targetBinId, ctx));
}

export interface BulkMoveResult {
  moved: number;
  skipped: number;
  blockIds: string[];
}

export async function bulkMoveBlocksToBin(
  ctx: DomainContext,
  mtgBlockIds: string[],
  targetBinId: string,
): Promise<BulkMoveResult> {
  const uniqueIds = [...new Set(mtgBlockIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    throw new BlockMoveError("Select at least one block");
  }

  return db.$transaction(async (tx) => {
    let moved = 0;
    let skipped = 0;
    const blockIds: string[] = [];

    for (const mtgBlockId of uniqueIds) {
      const result = await moveOneBlockInTx(tx, mtgBlockId, targetBinId, ctx);
      blockIds.push(result.mtgBlockId);
      if (result.skipped) skipped += 1;
      else moved += 1;
    }

    return { moved, skipped, blockIds };
  });
}

export async function bulkMoveBlocksInBin(
  ctx: DomainContext,
  sourceBinId: string,
  targetBinId: string,
): Promise<BulkMoveResult> {
  const blocks = await db.block.findMany({
    where: { binId: sourceBinId },
    select: { blockId: true },
    orderBy: { blockId: "asc" },
  });

  if (blocks.length === 0) {
    throw new BlockMoveError("No blocks in the selected source bin");
  }

  return bulkMoveBlocksToBin(
    ctx,
    blocks.map((b) => b.blockId),
    targetBinId,
  );
}
