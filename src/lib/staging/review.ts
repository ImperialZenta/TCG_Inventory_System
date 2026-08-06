import type { StagingCard } from "@prisma/client";
import { db } from "@/lib/db";
import { findExpandedQtyGroups, type QtyGroupInfo } from "@/lib/staging/breakdown";

/** Minimum fields required to group cards by suggested block. */
export type StagingReviewCard = Pick<
  StagingCard,
  "id" | "suggestedBlock" | "position" | "quantity"
>;

export interface StagingReviewGroup<T extends StagingReviewCard = StagingCard> {
  blockIndex: number;
  cards: T[];
  totalQuantity: number;
  lineCount: number;
}

export function buildStagingReviewGroups<T extends StagingReviewCard>(
  cards: T[],
): StagingReviewGroup<T>[] {
  const map = new Map<number, T[]>();

  for (const card of cards) {
    const index = card.suggestedBlock ?? 1;
    const list = map.get(index) ?? [];
    list.push(card);
    map.set(index, list);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([blockIndex, groupCards]) => ({
      blockIndex,
      cards: groupCards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      totalQuantity: groupCards.reduce((sum, c) => sum + c.quantity, 0),
      lineCount: groupCards.length,
    }));
}

export function getQtyGroupWarnings(cards: StagingCard[]): {
  adjacencyReminders: QtyGroupInfo[];
  crossBlockSplits: QtyGroupInfo[];
} {
  const groups = findExpandedQtyGroups(cards);
  return {
    adjacencyReminders: groups,
    crossBlockSplits: groups.filter((g) => g.splitAcrossBlocks),
  };
}

export async function getSuggestedBlockCountsByImport(
  importIds: string[],
): Promise<Map<string, number>> {
  if (importIds.length === 0) return new Map();

  const rows = await db.stagingCard.groupBy({
    by: ["stagingImportId"],
    where: { stagingImportId: { in: importIds } },
    _max: { suggestedBlock: true },
  });

  return new Map(
    rows.map((row) => [row.stagingImportId, row._max.suggestedBlock ?? 1]),
  );
}