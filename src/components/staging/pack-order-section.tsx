"use client";

import { useCallback, useMemo, useState } from "react";
import type { StagingReviewGroup } from "@/lib/staging/review";
import { SortableBlockCardList } from "@/components/staging/sortable-block-card-list";

export interface PackOrderCard {
  id: string;
  name: string;
  setCode: string;
  condition: string;
  finish: string;
  position: number | null;
  sourceRow: number | null;
  expansionIndex: number | null;
}

export interface PackOrderGroup {
  blockIndex: number;
  totalQuantity: number;
  cards: PackOrderCard[];
}

interface PackOrderSectionProps {
  importId: string;
  groups: StagingReviewGroup[];
  totalBlocks: number;
}

function toPackOrderGroups(groups: StagingReviewGroup[]): PackOrderGroup[] {
  return groups.map((group) => ({
    blockIndex: group.blockIndex,
    totalQuantity: group.totalQuantity,
    cards: group.cards.map((card) => ({
      id: card.id,
      name: card.name,
      setCode: card.setCode,
      condition: card.condition,
      finish: card.finish,
      position: card.position,
      sourceRow: card.sourceRow,
      expansionIndex: card.expansionIndex,
    })),
  }));
}

export function PackOrderSection({ importId, groups, totalBlocks }: PackOrderSectionProps) {
  const packGroups = useMemo(() => toPackOrderGroups(groups), [groups]);
  const [expandedBlock, setExpandedBlock] = useState<number | null>(null);

  const toggleBlock = useCallback((blockIndex: number) => {
    setExpandedBlock((current) => (current === blockIndex ? null : blockIndex));
  }, []);

  if (packGroups.length === 0) {
    return null;
  }

  return (
    <section className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="text-lg font-medium text-zinc-100">Pack order</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Position 1 is the front card facing you. Drag rows to match how you will physically stack
        each block, or right-click / click the number to jump to a position, then save.
      </p>

      <div className="mt-4 space-y-2">
        {packGroups.map((group) => {
          const isExpanded = expandedBlock === group.blockIndex;

          return (
            <div
              key={group.blockIndex}
              className="overflow-visible rounded-lg border border-zinc-800 bg-zinc-950/30"
            >
              <button
                type="button"
                onClick={() => toggleBlock(group.blockIndex)}
                aria-expanded={isExpanded}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-zinc-900/60"
              >
                <span className="font-mono text-zinc-200">
                  Block {group.blockIndex} / {totalBlocks}
                </span>
                <span className="text-zinc-500">
                  {group.totalQuantity} card{group.totalQuantity === 1 ? "" : "s"}
                </span>
                <span className="text-xs text-amber-400/90">{isExpanded ? "Hide" : "Edit order"}</span>
              </button>

              {isExpanded && (
                <div className="border-t border-zinc-800 px-4 py-4">
                  <SortableBlockCardList
                    importId={importId}
                    blockIndex={group.blockIndex}
                    cards={group.cards}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
