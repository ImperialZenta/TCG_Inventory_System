import type { BlockStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { BLOCK_STATUS_LABELS } from "@/lib/constants";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";

export type LifecycleTransition = "ACTIVATE" | "ARCHIVE" | "LIQUIDATE";

export class LifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecycleError";
  }
}

const TRANSITION_TARGETS: Record<
  LifecycleTransition,
  Partial<Record<BlockStatus, BlockStatus>>
> = {
  ACTIVATE: { SEALED: "ACTIVE" },
  ARCHIVE: { SEALED: "ARCHIVED", ACTIVE: "ARCHIVED" },
  LIQUIDATE: { ARCHIVED: "LIQUIDATED" },
};

export function getAvailableTransitions(status: BlockStatus): LifecycleTransition[] {
  const transitions: LifecycleTransition[] = [];
  for (const key of Object.keys(TRANSITION_TARGETS) as LifecycleTransition[]) {
    if (TRANSITION_TARGETS[key][status]) {
      transitions.push(key);
    }
  }
  return transitions;
}

export function getTransitionTarget(
  status: BlockStatus,
  transition: LifecycleTransition,
): BlockStatus | null {
  return TRANSITION_TARGETS[transition][status] ?? null;
}

function formatStatusLabel(status: BlockStatus): string {
  return BLOCK_STATUS_LABELS[status] ?? status;
}

export async function transitionBlockStatus(
  blockId: string,
  transition: LifecycleTransition,
): Promise<{ message: string }> {
  const block = await db.block.findUnique({
    where: { blockId },
    include: { cards: { select: { quantity: true } } },
  });

  if (!block) {
    throw new LifecycleError("Block not found");
  }

  const targetStatus = getTransitionTarget(block.status, transition);
  if (!targetStatus) {
    const label = formatStatusLabel(block.status);
    throw new LifecycleError(
      `Cannot ${transition.toLowerCase()} — block is ${label.toLowerCase()}`,
    );
  }

  const cardCount = block.cards.reduce((sum, card) => sum + card.quantity, 0);
  if (transition !== "LIQUIDATE" && cardCount === 0) {
    throw new LifecycleError("Cannot transition an empty block");
  }

  const fromStatus = block.status;

  await db.$transaction(async (tx) => {
    const current = await tx.block.findUnique({
      where: { id: block.id },
      select: { status: true, activatedAt: true },
    });

    if (!current) {
      throw new LifecycleError("Block not found");
    }

    const currentTarget = getTransitionTarget(current.status, transition);
    if (!currentTarget) {
      const label = formatStatusLabel(current.status);
      throw new LifecycleError(
        `Cannot ${transition.toLowerCase()} — block is ${label.toLowerCase()}`,
      );
    }

    const data: { status: BlockStatus; activatedAt?: Date } = {
      status: currentTarget,
    };

    if (transition === "ACTIVATE" && !current.activatedAt) {
      data.activatedAt = new Date();
    }

    await tx.block.update({
      where: { id: block.id },
      data,
    });

    await recordInventoryEvent(tx, {
      eventType: INVENTORY_EVENT_TYPES.BLOCK_LIFECYCLE,
      payload: {
        mtgBlockId: block.blockId,
        fromStatus,
        toStatus: targetStatus,
        transition,
      },
      blockId: block.id,
    });
  });

  const targetLabel = formatStatusLabel(targetStatus);
  return { message: `Block is now ${targetLabel.toLowerCase()}` };
}
