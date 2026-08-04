export interface BreakdownCard {
  id: string;
  quantity: number;
  sourceRow: number | null;
}

export interface BreakdownGroup {
  blockIndex: number;
  cards: BreakdownCard[];
  totalQuantity: number;
  lineCount: number;
}

/** Greedy split: accumulate card quantity until target reached, then start next block. */
export function computeBreakdownGroups(
  cards: BreakdownCard[],
  targetCount: number,
): BreakdownGroup[] {
  if (cards.length === 0 || targetCount < 1) return [];

  const sorted = [...cards].sort((a, b) => (a.sourceRow ?? 0) - (b.sourceRow ?? 0));
  const groups: BreakdownGroup[] = [];
  let current: BreakdownGroup = { blockIndex: 1, cards: [], totalQuantity: 0, lineCount: 0 };

  for (const card of sorted) {
    current.cards.push(card);
    current.totalQuantity += card.quantity;
    current.lineCount += 1;

    if (current.totalQuantity >= targetCount) {
      groups.push(current);
      current = {
        blockIndex: groups.length + 1,
        cards: [],
        totalQuantity: 0,
        lineCount: 0,
      };
    }
  }

  if (current.cards.length > 0) {
    groups.push(current);
  }

  return groups;
}

export function assignSuggestedBlockIndices(
  cards: BreakdownCard[],
  targetCount: number,
): Map<string, number> {
  const groups = computeBreakdownGroups(cards, targetCount);
  const assignments = new Map<string, number>();

  for (const group of groups) {
    for (const card of group.cards) {
      assignments.set(card.id, group.blockIndex);
    }
  }

  return assignments;
}
