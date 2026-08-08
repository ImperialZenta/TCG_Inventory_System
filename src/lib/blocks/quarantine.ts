import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { holdPickListInTx, tryAutoReleaseHold } from "@/lib/pick/hold-list";
import { PickError } from "@/lib/pick/errors";

type TransactionClient = Prisma.TransactionClient;

function actorLabel(ctx: DomainContext): string | null {
  return ctx.actor?.email ?? ctx.actor?.id ?? null;
}

const QUARANTINABLE_STATUSES = ["SEALED", "ACTIVE"] as const;

function lineHint(item: {
  cardLine: { position: number; name: string } | null;
  externalOrderLine: { name: string } | null;
}): string {
  const name = item.externalOrderLine?.name ?? item.cardLine?.name ?? "unknown card";
  const pos = item.cardLine?.position;
  return pos != null ? `pos ${pos} ${name}` : name;
}

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
      pickList: { status: { in: ["OPEN", "IN_PROGRESS", "ON_HOLD"] } },
    },
    include: {
      pickList: true,
      cardLine: { select: { position: true, name: true } },
      externalOrderLine: { select: { name: true } },
    },
  });

  if (affectedItems.length > 0) {
    await tx.pickItem.updateMany({
      where: { id: { in: affectedItems.map((i) => i.id) } },
      data: { blockedReason: trimmedReason },
    });
  }

  const byList = new Map<string, (typeof affectedItems)[number][]>();
  for (const item of affectedItems) {
    const list = byList.get(item.pickListId) ?? [];
    list.push(item);
    byList.set(item.pickListId, list);
  }

  const heldPickListIds = new Set<string>();
  for (const [pickListId, items] of byList) {
    const pickList = items[0]!.pickList;
    const hint = lineHint(items[0]!);
    const holdReason =
      trimmedReason === "Quarantined for picking" || trimmedReason === "Needs repair"
        ? `Block ${block.blockId} quarantined (line: ${hint})`
        : `Block ${block.blockId} quarantined: ${trimmedReason} (line: ${hint})`;

    if (pickList.status !== "ON_HOLD") {
      await holdPickListInTx(tx, pickListId, holdReason, ctx);
      heldPickListIds.add(pickList.pickListId);
    } else if (!pickList.holdReason?.includes(block.blockId)) {
      await tx.pickList.update({
        where: { id: pickListId },
        data: { holdReason },
      });
      heldPickListIds.add(pickList.pickListId);
    }
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

  const affectedListIds = await db.$transaction(async (tx) => {
    await tx.block.update({
      where: { id: blockId },
      data: {
        pickHoldAt: null,
        pickHoldReason: null,
      },
    });

    const pendingOnBlock = await tx.pickItem.findMany({
      where: {
        blockId,
        status: "PENDING",
        blockedReason: { not: null },
      },
      select: { id: true, pickListId: true },
    });

    if (pendingOnBlock.length > 0) {
      await tx.pickItem.updateMany({
        where: { id: { in: pendingOnBlock.map((i) => i.id) } },
        data: { blockedReason: null },
      });
    }

    await recordInventoryEvent(tx, {
      eventType: INVENTORY_EVENT_TYPES.BLOCK_QUARANTINE_CLEARED,
      payload: { mtgBlockId: block.blockId },
      blockId: block.id,
      actor: actorLabel(ctx),
    });

    return [...new Set(pendingOnBlock.map((i) => i.pickListId))];
  });

  for (const pickListId of affectedListIds) {
    await tryAutoReleaseHold(pickListId, ctx);
  }
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
