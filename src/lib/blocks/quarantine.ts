import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { holdPickListInTx } from "@/lib/pick/hold-list";
import { PickError } from "@/lib/pick/errors";

type TransactionClient = Prisma.TransactionClient;

function actorLabel(ctx: DomainContext): string | null {
  return ctx.actor?.email ?? ctx.actor?.id ?? null;
}

const QUARANTINABLE_STATUSES = ["SEALED", "ACTIVE"] as const;

export async function quarantineBlockForPicking(
  blockId: string,
  reason: string,
  ctx: DomainContext,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await quarantineBlockForPickingInTx(tx, blockId, reason, ctx);
  });
}

export async function quarantineBlockForPickingInTx(
  tx: TransactionClient,
  blockId: string,
  reason: string,
  ctx: DomainContext,
): Promise<void> {
  const block = await tx.block.findUnique({ where: { id: blockId } });
  if (!block) {
    throw new PickError("Block not found");
  }

  if (block.status === "OPEN") {
    throw new PickError("Cannot quarantine an OPEN block — seal it first");
  }

  if (block.status === "LIQUIDATED") {
    throw new PickError("Cannot quarantine a liquidated block");
  }

  if (!QUARANTINABLE_STATUSES.includes(block.status as (typeof QUARANTINABLE_STATUSES)[number])) {
    throw new PickError(`Cannot quarantine block in ${block.status} status`);
  }

  if (block.pickHoldAt) {
    throw new PickError(`Block ${block.blockId} is already quarantined`);
  }

  const trimmedReason = reason.trim() || "Quarantined for picking";

  await tx.block.update({
    where: { id: blockId },
    data: {
      pickHoldAt: new Date(),
      pickHoldReason: trimmedReason,
    },
  });

  const affectedItems = await tx.pickItem.findMany({
    where: {
      blockId,
      status: "PENDING",
      pickList: { status: { in: ["OPEN", "IN_PROGRESS"] } },
    },
    include: { pickList: true },
  });

  const heldPickListIds = new Set<string>();
  for (const item of affectedItems) {
    if (item.pickList.status === "ON_HOLD") continue;
    await holdPickListInTx(
      tx,
      item.pickListId,
      `Block ${block.blockId} quarantined: ${trimmedReason}`,
      ctx,
    );
    heldPickListIds.add(item.pickList.pickListId);
  }

  await recordInventoryEvent(tx, {
    eventType: INVENTORY_EVENT_TYPES.BLOCK_QUARANTINED,
    payload: {
      mtgBlockId: block.blockId,
      reason: trimmedReason,
      heldPickListIds: [...heldPickListIds],
    },
    blockId: block.id,
    actor: actorLabel(ctx),
  });
}

export async function clearBlockPickHold(
  blockId: string,
  ctx: DomainContext = { actor: null, source: "ui" },
): Promise<void> {
  const block = await db.block.findUnique({ where: { id: blockId } });
  if (!block) {
    throw new PickError("Block not found");
  }

  if (!block.pickHoldAt) {
    throw new PickError(`Block ${block.blockId} is not quarantined`);
  }

  await db.block.update({
    where: { id: blockId },
    data: {
      pickHoldAt: null,
      pickHoldReason: null,
    },
  });

  await db.$transaction(async (tx) => {
    await recordInventoryEvent(tx, {
      eventType: INVENTORY_EVENT_TYPES.BLOCK_QUARANTINE_CLEARED,
      payload: { mtgBlockId: block.blockId },
      blockId: block.id,
      actor: actorLabel(ctx),
    });
  });
}

export async function quarantineBlockByMtgId(
  mtgBlockId: string,
  reason: string,
  ctx: DomainContext,
): Promise<void> {
  const block = await db.block.findUnique({ where: { blockId: mtgBlockId } });
  if (!block) {
    throw new PickError(`Block ${mtgBlockId} not found`);
  }
  await quarantineBlockForPicking(block.id, reason, ctx);
}
