import type { BlockStatus } from "@prisma/client";
import { db } from "@/lib/db";

export interface LinkedBlock {
  id: string;
  blockId: string;
  status: BlockStatus;
  cardCount: number;
  pickItemCount: number;
}

/** Blocks linked to a staging import via StagingCard.assignedBlockId. */
export async function getLinkedBlocks(importId: string): Promise<LinkedBlock[]> {
  const assignedIds = await db.stagingCard.findMany({
    where: { stagingImportId: importId, assignedBlockId: { not: null } },
    select: { assignedBlockId: true },
    distinct: ["assignedBlockId"],
  });

  const blockInternalIds = assignedIds
    .map((row) => row.assignedBlockId)
    .filter((id): id is string => Boolean(id));

  if (blockInternalIds.length === 0) {
    return [];
  }

  const blocks = await db.block.findMany({
    where: { id: { in: blockInternalIds } },
    include: {
      cards: { select: { quantity: true } },
      _count: { select: { pickItems: true } },
    },
  });

  return blocks.map((block) => ({
    id: block.id,
    blockId: block.blockId,
    status: block.status,
    cardCount: block.cards.reduce((sum, card) => sum + card.quantity, 0),
    pickItemCount: block._count.pickItems,
  }));
}
