import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";

export interface SealBlockCandidate {
  id: string;
  blockId: string;
  status: string;
  cardCount: number;
}

export interface SealSummary {
  total: number;
  eligible: number;
  alreadySealed: number;
  notOpen: number;
  empty: number;
}

export interface BulkSealOutcome {
  sealed: number;
  skipped: number;
  message: string;
}

function summarizeCandidates(blocks: SealBlockCandidate[]): SealSummary {
  let eligible = 0;
  let alreadySealed = 0;
  let notOpen = 0;
  let empty = 0;

  for (const block of blocks) {
    if (block.status === "SEALED" || block.status === "ACTIVE") {
      alreadySealed++;
      continue;
    }
    if (block.status !== "OPEN") {
      notOpen++;
      continue;
    }
    if (block.cardCount === 0) {
      empty++;
      continue;
    }
    eligible++;
  }

  return {
    total: blocks.length,
    eligible,
    alreadySealed,
    notOpen,
    empty,
  };
}

function toCandidate(block: {
  id: string;
  blockId: string;
  status: string;
  cards: { quantity: number }[];
}): SealBlockCandidate {
  return {
    id: block.id,
    blockId: block.blockId,
    status: block.status,
    cardCount: block.cards.reduce((sum, card) => sum + card.quantity, 0),
  };
}

export async function getImportSealSummary(importId: string): Promise<SealSummary> {
  const assignedIds = await db.stagingCard.findMany({
    where: { stagingImportId: importId, assignedBlockId: { not: null } },
    select: { assignedBlockId: true },
    distinct: ["assignedBlockId"],
  });

  const blockIds = assignedIds
    .map((row) => row.assignedBlockId)
    .filter((id): id is string => Boolean(id));

  if (blockIds.length === 0) {
    return { total: 0, eligible: 0, alreadySealed: 0, notOpen: 0, empty: 0 };
  }

  const blocks = await db.block.findMany({
    where: { id: { in: blockIds } },
    include: { cards: { select: { quantity: true } } },
  });

  return summarizeCandidates(blocks.map(toCandidate));
}

export async function getBinSealSummary(binId: string): Promise<SealSummary> {
  const blocks = await db.block.findMany({
    where: { binId },
    include: { cards: { select: { quantity: true } } },
  });

  return summarizeCandidates(blocks.map(toCandidate));
}

export async function sealOpenBlocksByInternalIds(
  ctx: DomainContext,
  blockInternalIds: string[],
): Promise<BulkSealOutcome> {
  if (blockInternalIds.length === 0) {
    return { sealed: 0, skipped: 0, message: "No blocks to seal" };
  }

  const blocks = await db.block.findMany({
    where: { id: { in: blockInternalIds } },
    include: { cards: { select: { quantity: true } } },
  });

  const eligible = blocks.filter((block) => {
    if (block.status !== "OPEN") return false;
    const cardCount = block.cards.reduce((sum, card) => sum + card.quantity, 0);
    return cardCount > 0;
  });

  if (eligible.length === 0) {
    return {
      sealed: 0,
      skipped: blocks.length,
      message: "No unsealed blocks with cards to seal",
    };
  }

  const sealedAt = new Date();

  await db.$transaction(
    async (tx) => {
      for (const block of eligible) {
        const cardCount = block.cards.reduce((sum, card) => sum + card.quantity, 0);
        await tx.block.update({
          where: { id: block.id },
          data: { status: "SEALED", sealedAt },
        });
        await recordInventoryEvent(tx, ctx, {
          eventType: INVENTORY_EVENT_TYPES.BLOCK_SEALED,
          payload: {
            mtgBlockId: block.blockId,
            cardCount,
          },
          blockId: block.id,
        });
      }
    },
    { timeout: 120_000 },
  );

  const sealed = eligible.length;
  const skipped = blocks.length - sealed;

  return {
    sealed,
    skipped,
    message:
      skipped > 0
        ? `Sealed ${sealed} block${sealed === 1 ? "" : "s"} (${skipped} skipped)`
        : `Sealed ${sealed} block${sealed === 1 ? "" : "s"}`,
  };
}

export async function sealBlocksFromStagingImport(
  ctx: DomainContext,
  importId: string,
): Promise<BulkSealOutcome> {
  const stagingImport = await db.stagingImport.findUnique({ where: { id: importId } });
  if (!stagingImport) {
    return { sealed: 0, skipped: 0, message: "Import not found" };
  }
  if (stagingImport.status !== "ASSIGNED") {
    return { sealed: 0, skipped: 0, message: "Import has not been formalized yet" };
  }

  const assignedIds = await db.stagingCard.findMany({
    where: { stagingImportId: importId, assignedBlockId: { not: null } },
    select: { assignedBlockId: true },
    distinct: ["assignedBlockId"],
  });

  const blockIds = assignedIds
    .map((row) => row.assignedBlockId)
    .filter((id): id is string => Boolean(id));

  return sealOpenBlocksByInternalIds(ctx, blockIds);
}

export async function sealOpenBlocksInBin(
  ctx: DomainContext,
  binId: string,
): Promise<BulkSealOutcome> {
  const bin = await db.bin.findUnique({ where: { id: binId } });
  if (!bin) {
    return { sealed: 0, skipped: 0, message: "Bin not found" };
  }

  const blocks = await db.block.findMany({
    where: { binId },
    select: { id: true },
  });

  return sealOpenBlocksByInternalIds(ctx, blocks.map((block) => block.id));
}
