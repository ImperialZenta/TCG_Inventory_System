import type { StagingCard } from "@prisma/client";

export interface StagingReviewGroup {
  blockIndex: number;
  cards: StagingCard[];
  totalQuantity: number;
  lineCount: number;
}

export function buildStagingReviewGroups(cards: StagingCard[]): StagingReviewGroup[] {
  const map = new Map<number, StagingCard[]>();

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
      cards: groupCards.sort((a, b) => (a.sourceRow ?? 0) - (b.sourceRow ?? 0)),
      totalQuantity: groupCards.reduce((sum, c) => sum + c.quantity, 0),
      lineCount: groupCards.length,
    }));
}

export function countAvailableBlockSlots(
  bins: { available: number }[],
): number {
  return bins.reduce((sum, bin) => sum + bin.available, 0);
}
