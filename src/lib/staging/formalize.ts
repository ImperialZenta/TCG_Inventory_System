import { db } from "@/lib/db";
import { allocateNextBlockId } from "@/lib/blocks";
import { getBinUtilization } from "@/lib/location";

export class FormalizeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FormalizeError";
  }
}

export async function validateBinAssignments(
  blockCount: number,
  binAssignments: Record<number, string>,
): Promise<void> {
  if (blockCount === 0) {
    throw new FormalizeError("No blocks to create");
  }

  for (let i = 1; i <= blockCount; i++) {
    if (!binAssignments[i]) {
      throw new FormalizeError(`Select a bin for block ${i}`);
    }
  }

  const bins = await getBinUtilization();
  const binMap = new Map(bins.map((b) => [b.id, b]));
  const usage = new Map<string, number>();

  for (let i = 1; i <= blockCount; i++) {
    const binId = binAssignments[i];
    const bin = binMap.get(binId);
    if (!bin) {
      throw new FormalizeError(`Bin not found for block ${i}`);
    }

    const count = (usage.get(binId) ?? 0) + 1;
    usage.set(binId, count);

    if (bin.used + count > bin.capacity) {
      throw new FormalizeError(
        `Bin ${bin.binId} does not have enough capacity (${bin.used}/${bin.capacity} used, need ${count} more slot(s))`,
      );
    }
  }
}

function groupCardsBySuggestedBlock<T extends { suggestedBlock: number | null }>(
  cards: T[],
): Map<number, T[]> {
  const groups = new Map<number, T[]>();

  for (const card of cards) {
    const index = card.suggestedBlock ?? 1;
    const list = groups.get(index) ?? [];
    list.push(card);
    groups.set(index, list);
  }

  return new Map([...groups.entries()].sort(([a], [b]) => a - b));
}

export async function formalizeStagingImport(
  importId: string,
  binAssignments: Record<number, string>,
): Promise<string[]> {
  const stagingImport = await db.stagingImport.findUnique({
    where: { id: importId },
    include: { cards: true },
  });

  if (!stagingImport) {
    throw new FormalizeError("Staging import not found");
  }

  if (stagingImport.status === "ASSIGNED") {
    throw new FormalizeError("This import has already been formalized");
  }

  const groups = groupCardsBySuggestedBlock(stagingImport.cards);
  const blockCount = groups.size;

  await validateBinAssignments(blockCount, binAssignments);

  const createdBlockIds: string[] = [];

  await db.$transaction(async (tx) => {
    for (const [blockIndex, stagingCards] of groups) {
      const humanBlockId = await allocateNextBlockId(tx);
      const binId = binAssignments[blockIndex];

      const block = await tx.block.create({
        data: {
          blockId: humanBlockId,
          status: "OPEN",
          tier: "GENERAL",
          channel: "MANAPOOL",
          binId,
          targetCount: stagingImport.targetCount,
          packedAt: new Date(),
          cards: {
            create: stagingCards.map((card) => ({
              scryfallId: card.scryfallId,
              name: card.name,
              setCode: card.setCode,
              collectorNumber: card.collectorNumber,
              finish: card.finish,
              language: card.language,
              condition: card.condition,
              quantity: card.quantity,
              priceUsd: null,
              imageUri: null,
            })),
          },
        },
      });

      createdBlockIds.push(block.blockId);

      await tx.stagingCard.updateMany({
        where: { id: { in: stagingCards.map((c) => c.id) } },
        data: { assignedBlockId: block.id },
      });
    }

    await tx.stagingImport.update({
      where: { id: importId },
      data: { status: "ASSIGNED" },
    });
  });

  return createdBlockIds;
}
