import { Prisma } from "@prisma/client";
import type { DomainContext } from "@/lib/context/domain-context";
import { db } from "@/lib/db";

const UPDATE_CHUNK = 500;

export class ReorderBlockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReorderBlockError";
  }
}

/** Map ordered card IDs to position 1..N within a block. */
export function assignPositionsFromOrder(orderedCardIds: string[]): Map<string, number> {
  const positions = new Map<string, number>();
  orderedCardIds.forEach((id, index) => {
    positions.set(id, index + 1);
  });
  return positions;
}

async function batchApplyPositions(assignments: Map<string, number>): Promise<void> {
  const entries = [...assignments.entries()];
  if (entries.length === 0) return;

  await db.$transaction(
    async (tx) => {
      for (let i = 0; i < entries.length; i += UPDATE_CHUNK) {
        const chunk = entries.slice(i, i + UPDATE_CHUNK);
        const tuples = chunk.map(([id, position]) => Prisma.sql`(${id}, ${position})`);

        await tx.$executeRaw`
          UPDATE "StagingCard" AS sc
          SET "position" = v.pos
          FROM (VALUES ${Prisma.join(tuples)}) AS v(id, pos)
          WHERE sc.id = v.id
        `;
      }
    },
    { timeout: 120_000 },
  );
}

export async function reorderStagingBlockCards(
  _ctx: DomainContext,
  importId: string,
  blockIndex: number,
  orderedCardIds: string[],
): Promise<void> {
  if (!Number.isFinite(blockIndex) || blockIndex < 1) {
    throw new ReorderBlockError("Invalid block index");
  }

  if (orderedCardIds.length === 0) {
    throw new ReorderBlockError("No cards to reorder");
  }

  const uniqueIds = new Set(orderedCardIds);
  if (uniqueIds.size !== orderedCardIds.length) {
    throw new ReorderBlockError("Duplicate card IDs in order");
  }

  const stagingImport = await db.stagingImport.findUnique({
    where: { id: importId },
    select: { status: true },
  });

  if (!stagingImport) {
    throw new ReorderBlockError("Staging import not found");
  }

  if (stagingImport.status !== "PARSED") {
    throw new ReorderBlockError("Import already formalized");
  }

  const blockCards = await db.stagingCard.findMany({
    where: { stagingImportId: importId, suggestedBlock: blockIndex },
    select: { id: true },
    orderBy: { position: "asc" },
  });

  if (blockCards.length === 0) {
    throw new ReorderBlockError(`Block ${blockIndex} not found`);
  }

  const expectedIds = new Set(blockCards.map((c) => c.id));
  if (orderedCardIds.length !== expectedIds.size) {
    throw new ReorderBlockError("Card list does not match this block");
  }

  for (const id of orderedCardIds) {
    if (!expectedIds.has(id)) {
      throw new ReorderBlockError("Card list does not match this block");
    }
  }

  await batchApplyPositions(assignPositionsFromOrder(orderedCardIds));
}
