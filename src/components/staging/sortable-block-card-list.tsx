"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import { reorderStagingBlockAction } from "@/app/staging/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  CONDITION_LABELS,
  FINISH_LABELS,
} from "@/lib/constants";
import type { PackOrderCard } from "@/components/staging/pack-order-section";

interface SortableBlockCardListProps {
  importId: string;
  blockIndex: number;
  cards: PackOrderCard[];
}

function sortCardsByPosition(cards: PackOrderCard[]): PackOrderCard[] {
  return [...cards].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

function sameOrder(a: PackOrderCard[], b: PackOrderCard[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((card, index) => card.id === b[index]?.id);
}

function buildCopyLabels(cards: PackOrderCard[]): Map<string, string | null> {
  const bySource = new Map<number, PackOrderCard[]>();
  for (const card of cards) {
    if (card.sourceRow == null) continue;
    const list = bySource.get(card.sourceRow) ?? [];
    list.push(card);
    bySource.set(card.sourceRow, list);
  }

  const labels = new Map<string, string | null>();
  for (const group of bySource.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (a, b) => (a.expansionIndex ?? 0) - (b.expansionIndex ?? 0),
    );
    sorted.forEach((card, index) => {
      labels.set(card.id, `copy ${index + 1} of ${sorted.length}`);
    });
  }
  return labels;
}

function moveCard(cards: PackOrderCard[], fromIndex: number, toIndex: number): PackOrderCard[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return cards;
  if (fromIndex >= cards.length || toIndex >= cards.length) return cards;

  const next = [...cards];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function SortableBlockCardList({
  importId,
  blockIndex,
  cards,
}: SortableBlockCardListProps) {
  const router = useRouter();
  const savedOrder = useMemo(() => sortCardsByPosition(cards), [cards]);
  const [draftOrder, setDraftOrder] = useState(savedOrder);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [result, formAction] = useActionState(reorderStagingBlockAction, null);
  const liveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraftOrder(savedOrder);
  }, [savedOrder]);

  const isDirty = !sameOrder(draftOrder, savedOrder);
  const copyLabels = useMemo(() => buildCopyLabels(draftOrder), [draftOrder]);

  useEffect(() => {
    if (result?.ok) {
      liveRef.current?.focus();
      router.refresh();
    }
  }, [result, router]);

  const moveUp = useCallback((index: number) => {
    setDraftOrder((current) => moveCard(current, index, index - 1));
  }, []);

  const moveDown = useCallback((index: number) => {
    setDraftOrder((current) => moveCard(current, index, index + 1));
  }, []);

  const handleDragStart = useCallback((event: DragEvent<HTMLButtonElement>, cardId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", cardId);
    setDraggingId(cardId);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLLIElement>, cardId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetId(cardId);
  }, []);

  const handleDrop = useCallback((event: DragEvent<HTMLLIElement>, targetId: string) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData("text/plain");
    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      setDropTargetId(null);
      return;
    }

    setDraftOrder((current) => {
      const fromIndex = current.findIndex((card) => card.id === sourceId);
      const toIndex = current.findIndex((card) => card.id === targetId);
      return moveCard(current, fromIndex, toIndex);
    });
    setDraggingId(null);
    setDropTargetId(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDropTargetId(null);
  }, []);

  const resetDraft = useCallback(() => {
    setDraftOrder(savedOrder);
  }, [savedOrder]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {isDirty && (
          <span className="text-xs text-amber-400/90">Unsaved changes</span>
        )}
        {isDirty && (
          <button
            type="button"
            onClick={resetDraft}
            className="text-xs text-zinc-400 underline hover:text-zinc-300"
          >
            Reset
          </button>
        )}
      </div>

      <ul className="space-y-1" role="list">
        {draftOrder.map((card, index) => {
          const copyLabel = copyLabels.get(card.id);
          const isDragging = draggingId === card.id;
          const isDropTarget = dropTargetId === card.id && draggingId !== card.id;

          return (
            <li
              key={card.id}
              onDragOver={(event) => handleDragOver(event, card.id)}
              onDrop={(event) => handleDrop(event, card.id)}
              className={`flex items-center gap-2 rounded-lg border px-2 py-2 text-sm transition ${
                isDragging
                  ? "border-amber-500/40 bg-amber-500/10 opacity-60"
                  : isDropTarget
                    ? "border-sky-500/40 bg-sky-500/10"
                    : "border-zinc-800 bg-zinc-900/40"
              }`}
            >
              <button
                type="button"
                draggable
                aria-label={`Reorder ${card.name}`}
                onDragStart={(event) => handleDragStart(event, card.id)}
                onDragEnd={handleDragEnd}
                className="cursor-grab rounded px-1 py-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 active:cursor-grabbing"
              >
                ⋮⋮
              </button>
              <span className="w-8 shrink-0 font-mono text-xs text-zinc-500">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-zinc-100">{card.name}</p>
                <p className="truncate text-xs text-zinc-500">
                  <span className="uppercase">{card.setCode}</span>
                  {" · "}
                  {CONDITION_LABELS[card.condition as keyof typeof CONDITION_LABELS] ?? card.condition}
                  {" · "}
                  {FINISH_LABELS[card.finish as keyof typeof FINISH_LABELS] ?? card.finish}
                  {copyLabel && (
                    <>
                      {" · "}
                      <span className="text-amber-400/80">{copyLabel}</span>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  aria-label={`Move ${card.name} up`}
                  disabled={index === 0}
                  onClick={() => moveUp(index)}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`Move ${card.name} down`}
                  disabled={index === draftOrder.length - 1}
                  onClick={() => moveDown(index)}
                  className="rounded border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:border-zinc-600 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ↓
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <form action={formAction} className="mt-4">
        <input type="hidden" name="importId" value={importId} />
        <input type="hidden" name="blockIndex" value={blockIndex} />
        <input
          type="hidden"
          name="orderedCardIds"
          value={JSON.stringify(draftOrder.map((card) => card.id))}
        />
        <SubmitButton
          idleLabel="Save order"
          pendingLabel="Saving…"
          successLabel="Saved ✓"
          result={result}
          variant="secondary"
          disabled={!isDirty}
        />
      </form>

      <div
        ref={liveRef}
        tabIndex={-1}
        aria-live="polite"
        className="sr-only"
      >
        {result?.ok ? `Pack order saved for block ${blockIndex}` : null}
      </div>
    </div>
  );
}
