import type { BlockStatus, StagingCard } from "@prisma/client";
import type { LinkedBlock } from "@/lib/staging/linked-blocks";
import {
  buildStagingReviewGroups,
  type StagingReviewCard,
} from "@/lib/staging/review";

export type AssignmentStagingCard = StagingReviewCard &
  Pick<StagingCard, "assignedBlockId" | "name" | "setCode" | "condition" | "finish">;

export interface BlockAssignmentRow {
  blockId: string;
  internalId: string;
  status: BlockStatus;
  stagingCount: number;
  cardLineCount: number;
  suggestedBlock: number | null;
}

export interface UnassignedGroup {
  suggestedBlock: number;
  cards: AssignmentStagingCard[];
  unitCount: number;
}

export interface ImportAssignmentSummary {
  totalUnits: number;
  inBlockUnits: number;
  unassignedUnits: number;
  cardLineTotal: number;
  blocks: BlockAssignmentRow[];
  unassignedGroups: UnassignedGroup[];
  isBalanced: boolean;
  cardLinesMatchStaging: boolean;
}

function sumUnits(cards: AssignmentStagingCard[]): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}

export function buildImportAssignmentSummary(
  cards: AssignmentStagingCard[],
  linkedBlocks: LinkedBlock[],
): ImportAssignmentSummary {
  const totalUnits = sumUnits(cards);
  const assignedCards = cards.filter((card) => card.assignedBlockId != null);
  const unassignedCards = cards.filter((card) => card.assignedBlockId == null);
  const inBlockUnits = sumUnits(assignedCards);
  const unassignedUnits = sumUnits(unassignedCards);

  const blocks: BlockAssignmentRow[] = linkedBlocks
    .map((block) => {
      const blockCards = assignedCards.filter((card) => card.assignedBlockId === block.id);
      const suggestedValues = blockCards
        .map((card) => card.suggestedBlock)
        .filter((value): value is number => value != null);

      return {
        blockId: block.blockId,
        internalId: block.id,
        status: block.status,
        stagingCount: sumUnits(blockCards),
        cardLineCount: block.cardCount,
        suggestedBlock:
          suggestedValues.length > 0 ? Math.min(...suggestedValues) : null,
      };
    })
    .sort(
      (a, b) =>
        (a.suggestedBlock ?? Number.MAX_SAFE_INTEGER) -
          (b.suggestedBlock ?? Number.MAX_SAFE_INTEGER) ||
        a.blockId.localeCompare(b.blockId),
    );

  const unassignedGroups = buildStagingReviewGroups(unassignedCards).map((group) => ({
    suggestedBlock: group.blockIndex,
    cards: group.cards,
    unitCount: group.totalQuantity,
  }));

  const cardLineTotal = linkedBlocks.reduce((sum, block) => sum + block.cardCount, 0);

  return {
    totalUnits,
    inBlockUnits,
    unassignedUnits,
    cardLineTotal,
    blocks,
    unassignedGroups,
    isBalanced: inBlockUnits + unassignedUnits === totalUnits,
    cardLinesMatchStaging: cardLineTotal === inBlockUnits,
  };
}
