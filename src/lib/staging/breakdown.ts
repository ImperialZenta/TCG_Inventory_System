export interface BreakdownCard {
  id: string;
  sourceRow: number | null;
  expansionIndex: number | null;
}

export interface BreakdownAssignment {
  suggestedBlock: number;
  position: number;
}

export interface BreakdownGroup {
  blockIndex: number;
  cardIds: string[];
  totalQuantity: number;
}

export interface QtyGroupInfo {
  sourceRow: number;
  name: string;
  count: number;
  /** Positions within each suggested block, e.g. "Block 1 pos 5–7" */
  placements: string[];
  /** True when units from this CSV row landed in more than one block */
  splitAcrossBlocks: boolean;
}

/** Hard-cap chunk: fill blocks to targetCount, never overshoot. Remainder allowed. */
export function computeBreakdownGroups(
  cards: BreakdownCard[],
  targetCount: number,
): BreakdownGroup[] {
  if (cards.length === 0 || targetCount < 1) return [];

  const sorted = [...cards].sort((a, b) => {
    const rowA = a.sourceRow ?? 0;
    const rowB = b.sourceRow ?? 0;
    if (rowA !== rowB) return rowA - rowB;
    return (a.expansionIndex ?? 0) - (b.expansionIndex ?? 0);
  });

  const groups: BreakdownGroup[] = [];
  for (let i = 0; i < sorted.length; i += targetCount) {
    const slice = sorted.slice(i, i + targetCount);
    groups.push({
      blockIndex: groups.length + 1,
      cardIds: slice.map((c) => c.id),
      totalQuantity: slice.length,
    });
  }

  return groups;
}

export function assignSuggestedBlockIndices(
  cards: BreakdownCard[],
  targetCount: number,
): Map<string, BreakdownAssignment> {
  const groups = computeBreakdownGroups(cards, targetCount);
  const assignments = new Map<string, BreakdownAssignment>();

  for (const group of groups) {
    group.cardIds.forEach((cardId, index) => {
      assignments.set(cardId, {
        suggestedBlock: group.blockIndex,
        position: index + 1,
      });
    });
  }

  return assignments;
}

export interface QtyGroupCard {
  sourceRow: number | null;
  expansionIndex: number | null;
  name: string;
  suggestedBlock: number | null;
  position: number | null;
}

/** Groups that came from CSV quantity > 1 (multiple units share sourceRow). */
export function findExpandedQtyGroups(cards: QtyGroupCard[]): QtyGroupInfo[] {
  const bySource = new Map<number, QtyGroupCard[]>();

  for (const card of cards) {
    if (card.sourceRow == null) continue;
    const list = bySource.get(card.sourceRow) ?? [];
    list.push(card);
    bySource.set(card.sourceRow, list);
  }

  const groups: QtyGroupInfo[] = [];

  for (const [sourceRow, units] of bySource) {
    if (units.length < 2) continue;

    const sorted = [...units].sort((a, b) => {
      const blockA = a.suggestedBlock ?? 0;
      const blockB = b.suggestedBlock ?? 0;
      if (blockA !== blockB) return blockA - blockB;
      return (a.position ?? 0) - (b.position ?? 0);
    });

    const blocks = new Set(
      sorted.map((u) => u.suggestedBlock).filter((b): b is number => b != null),
    );

    const byBlock = new Map<number, number[]>();
    for (const unit of sorted) {
      if (unit.suggestedBlock == null || unit.position == null) continue;
      const positions = byBlock.get(unit.suggestedBlock) ?? [];
      positions.push(unit.position);
      byBlock.set(unit.suggestedBlock, positions);
    }

    const placements = [...byBlock.entries()]
      .sort(([a], [b]) => a - b)
      .map(([block, positions]) => {
        const min = Math.min(...positions);
        const max = Math.max(...positions);
        const range = min === max ? `pos ${min}` : `pos ${min}–${max}`;
        return `Block ${block} ${range}`;
      });

    groups.push({
      sourceRow,
      name: sorted[0]?.name ?? "Unknown",
      count: units.length,
      placements,
      splitAcrossBlocks: blocks.size > 1,
    });
  }

  return groups.sort((a, b) => a.sourceRow - b.sourceRow);
}
