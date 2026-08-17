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

interface JumpPanelState {
  cardId: string;
  x: number;
  y: number;
  value: string;
  error: string | null;
}

const AUTO_SCROLL_EDGE_PX = 80;
const AUTO_SCROLL_SPEED_PX = 20;
const JUMP_PANEL_WIDTH_PX = 240;
const JUMP_PANEL_HEIGHT_PX = 160;

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

export function moveCard(cards: PackOrderCard[], fromIndex: number, toIndex: number): PackOrderCard[] {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return cards;
  if (fromIndex >= cards.length || toIndex >= cards.length) return cards;

  const next = [...cards];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

/** Fail-closed: digits only, integer in 1…cardCount. */
export function parseJumpPosition(raw: string, cardCount: number): number | null {
  if (cardCount < 1 || !/^\d+$/.test(raw)) return null;
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 1 || value > cardCount) return null;
  return value;
}

function clampJumpPanelPosition(clientX: number, clientY: number): { x: number; y: number } {
  const maxX = Math.max(8, window.innerWidth - JUMP_PANEL_WIDTH_PX - 8);
  const maxY = Math.max(8, window.innerHeight - JUMP_PANEL_HEIGHT_PX - 8);
  return {
    x: Math.min(Math.max(8, clientX), maxX),
    y: Math.min(Math.max(8, clientY), maxY),
  };
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
  const [jumpPanel, setJumpPanel] = useState<JumpPanelState | null>(null);
  const [result, formAction] = useActionState(reorderStagingBlockAction, null);
  const liveRef = useRef<HTMLDivElement>(null);
  const lastPointerY = useRef(0);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const jumpPanelRef = useRef<HTMLDivElement>(null);
  const jumpOpen = jumpPanel != null;
  const jumpCardId = jumpPanel?.cardId ?? null;

  useEffect(() => {
    setDraftOrder(savedOrder);
  }, [savedOrder]);

  const isDirty = !sameOrder(draftOrder, savedOrder);
  const copyLabels = useMemo(() => buildCopyLabels(draftOrder), [draftOrder]);
  const cardCount = draftOrder.length;
  const maxJumpDigits = String(Math.max(cardCount, 1)).length;

  useEffect(() => {
    if (result?.ok) {
      liveRef.current?.focus();
      router.refresh();
    }
  }, [result, router]);

  useEffect(() => {
    if (!draggingId) return;

    const onWindowDragOver = (event: Event) => {
      const dragEvent = event as globalThis.DragEvent;
      dragEvent.preventDefault();
      lastPointerY.current = dragEvent.clientY;
    };

    const tick = () => {
      const y = lastPointerY.current;
      if (y > 0 && y < AUTO_SCROLL_EDGE_PX) {
        window.scrollBy(0, -AUTO_SCROLL_SPEED_PX);
      } else if (y > window.innerHeight - AUTO_SCROLL_EDGE_PX) {
        window.scrollBy(0, AUTO_SCROLL_SPEED_PX);
      }
      scrollRaf = requestAnimationFrame(tick);
    };

    let scrollRaf = requestAnimationFrame(tick);
    window.addEventListener("dragover", onWindowDragOver);

    return () => {
      window.removeEventListener("dragover", onWindowDragOver);
      cancelAnimationFrame(scrollRaf);
    };
  }, [draggingId]);

  useEffect(() => {
    if (!jumpOpen) return;

    jumpInputRef.current?.focus();
    jumpInputRef.current?.select();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setJumpPanel(null);
      }
    };

    const onPointerDown = (event: MouseEvent) => {
      if (jumpPanelRef.current && !jumpPanelRef.current.contains(event.target as Node)) {
        setJumpPanel(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    const timeoutId = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [jumpOpen, jumpCardId]);

  const openJumpPanel = useCallback((cardId: string, fromIndex: number, clientX: number, clientY: number) => {
    const { x, y } = clampJumpPanelPosition(clientX, clientY);
    setJumpPanel({
      cardId,
      x,
      y,
      value: String(fromIndex + 1),
      error: null,
    });
  }, []);

  const handleDragStart = useCallback((event: DragEvent<HTMLButtonElement>, cardId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", cardId);
    lastPointerY.current = event.clientY;
    setJumpPanel(null);
    setDraggingId(cardId);
  }, []);

  const handleDragOver = useCallback((event: DragEvent<HTMLLIElement>, cardId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    lastPointerY.current = event.clientY;
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

  const handleJumpValueChange = useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, maxJumpDigits);
    setJumpPanel((current) => (current ? { ...current, value: digits, error: null } : null));
  }, [maxJumpDigits]);

  const confirmJump = useCallback(() => {
    if (!jumpPanel) return;

    const parsed = parseJumpPosition(jumpPanel.value, cardCount);
    if (parsed == null) {
      setJumpPanel({
        ...jumpPanel,
        error: `Enter a position from 1 to ${cardCount}`,
      });
      return;
    }

    const fromIndex = draftOrder.findIndex((card) => card.id === jumpPanel.cardId);
    if (fromIndex < 0 || fromIndex === parsed - 1) {
      setJumpPanel(null);
      return;
    }

    setDraftOrder((order) => moveCard(order, fromIndex, parsed - 1));
    setJumpPanel(null);
  }, [jumpPanel, cardCount, draftOrder]);

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
              onContextMenu={(event) => {
                event.preventDefault();
                openJumpPanel(card.id, index, event.clientX, event.clientY);
              }}
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
              <button
                type="button"
                aria-label={`Move ${card.name} to a position`}
                onClick={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  openJumpPanel(card.id, index, rect.left, rect.bottom + 4);
                }}
                className="w-8 shrink-0 rounded font-mono text-xs text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              >
                {index + 1}
              </button>
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
            </li>
          );
        })}
      </ul>

      {jumpPanel && (
        <div
          ref={jumpPanelRef}
          role="dialog"
          aria-label="Move to position"
          style={{ left: jumpPanel.x, top: jumpPanel.y }}
          className="fixed z-50 w-60 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              confirmJump();
            }}
          >
            <label htmlFor="jump-position-input" className="block text-xs font-medium text-zinc-300">
              Move to position
            </label>
            <input
              id="jump-position-input"
              ref={jumpInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              pattern="[0-9]*"
              maxLength={maxJumpDigits}
              value={jumpPanel.value}
              aria-invalid={jumpPanel.error != null}
              aria-describedby={jumpPanel.error ? "jump-position-error" : undefined}
              onBeforeInput={(event) => {
                const native = event.nativeEvent;
                if (native.inputType === "insertText" && native.data && /\D/.test(native.data)) {
                  event.preventDefault();
                }
              }}
              onChange={(event) => handleJumpValueChange(event.target.value)}
              className="mt-2 w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-sm text-zinc-100 outline-none focus:border-amber-500/60"
            />
            {jumpPanel.error && (
              <p id="jump-position-error" className="mt-1 text-xs text-red-400">
                {jumpPanel.error}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800"
              >
                Move
              </button>
              <button
                type="button"
                onClick={() => setJumpPanel(null)}
                className="rounded px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

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
