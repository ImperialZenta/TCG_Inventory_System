import { differenceInDays } from "date-fns";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { PickError } from "@/lib/pick/errors";
import { deleteCardLineAndRenumber } from "@/lib/pick/renumber-block";

type TransactionClient = Prisma.TransactionClient;

export async function executePickItem(
  pickItemId: string,
  ctx: DomainContext,
): Promise<void> {
  await db.$transaction(async (tx) => {
    await executePickItemInTx(tx, pickItemId, ctx);
  });
}

export async function executePickItemInTx(
  tx: TransactionClient,
  pickItemId: string,
  ctx: DomainContext,
): Promise<void> {
  const item = await tx.pickItem.findUnique({
    where: { id: pickItemId },
    include: {
      pickList: true,
      cardLine: true,
      block: true,
      externalOrderLine: true,
    },
  });

  if (!item) {
    throw new PickError("Pick item not found");
  }

  if (item.status !== "PENDING") {
    throw new PickError(`Pick item is already ${item.status.toLowerCase()}`);
  }

  if (item.pickList.status === "ON_HOLD") {
    throw new PickError("Pick list is on hold");
  }

  if (!item.cardLine || !item.block) {
    throw new PickError("Pick item has no allocated card line");
  }

  if (item.block.pickHoldAt) {
    throw new PickError(`Block ${item.block.blockId} is on pick hold`);
  }

  const cardLine = item.cardLine;
  const block = item.block;
  const humanPickListId = item.pickList.pickListId;
  const pickedPosition = cardLine.position;
  const now = new Date();

  await deleteCardLineAndRenumber(tx, block.id, cardLine.id, pickedPosition);

  await tx.block.update({
    where: { id: block.id },
    data: { lastPickAt: now },
  });

  await tx.pickItem.update({
    where: { id: pickItemId },
    data: { status: "PICKED", blockedReason: null },
  });

  const dwellDays = differenceInDays(now, cardLine.addedAt);

  await tx.pickHistory.create({
    data: {
      blockId: block.id,
      mtgBlockId: block.blockId,
      blockTierAtPick: block.tier,
      positionAtPick: pickedPosition,
      scryfallId: cardLine.scryfallId,
      name: cardLine.name,
      setCode: cardLine.setCode,
      collectorNumber: cardLine.collectorNumber,
      condition: cardLine.condition,
      finish: cardLine.finish,
      language: cardLine.language,
      pickListId: item.pickListId,
      pickItemId: item.id,
      externalOrderId: item.externalOrderId,
      dwellDays,
      pickedAt: now,
    },
  });

  if (item.pickList.status === "OPEN") {
    await tx.pickList.update({
      where: { id: item.pickListId },
      data: { status: "IN_PROGRESS" },
    });
  }

  await recordInventoryEvent(tx, ctx, {
    eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_PICKED,
    payload: {
      pickListId: humanPickListId,
      pickItemId: item.id,
      mtgBlockId: block.blockId,
      position: pickedPosition,
      cardName: cardLine.name,
    },
    pickListId: item.pickListId,
    blockId: block.id,
    externalOrderId: item.externalOrderId,
  });

  await recordInventoryEvent(tx, ctx, {
    eventType: INVENTORY_EVENT_TYPES.INVENTORY_DECREMENTED,
    payload: {
      cardLineId: cardLine.id,
      mtgBlockId: block.blockId,
      position: pickedPosition,
      cardName: cardLine.name,
      quantity: 1,
      pickItemId: item.id,
    },
    pickListId: item.pickListId,
    blockId: block.id,
    externalOrderId: item.externalOrderId,
  });
}

export async function completePickListIfReady(
  pickListId: string,
  _ctx: DomainContext,
): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const existing = await tx.pickList.findUnique({
      where: { id: pickListId },
      include: {
        items: {
          where: { status: "PENDING" },
          include: {
            block: true,
            cardLine: { select: { position: true, name: true } },
            externalOrderLine: { select: { name: true } },
          },
        },
      },
    });
    if (!existing) return false;

    if (existing.status === "ON_HOLD") {
      const blocked = existing.items
        .filter((item) => item.block?.pickHoldAt || item.blockedReason)
        .map((item) => {
          const name = item.externalOrderLine?.name ?? item.cardLine?.name ?? "unknown";
          const pos = item.cardLine?.position;
          const blockId = item.block?.blockId ?? "?";
          const reason = item.blockedReason ?? "on hold";
          return `${blockId}${pos != null ? ` pos ${pos}` : ""} ${name} (${reason})`;
        });
      const detail =
        blocked.length > 0
          ? `Blocked lines:\n${blocked.join("\n")}`
          : existing.holdReason
            ? `Hold reason: ${existing.holdReason}`
            : "Pick list is on hold";
      throw new PickError(`Cannot complete pick list while ON_HOLD. ${detail}`);
    }

    const pending = existing.items.length;
    if (pending > 0) return false;

    const pickList = await tx.pickList.update({
      where: { id: pickListId },
      data: { status: "COMPLETED", completedAt: new Date() },
      include: { orders: true },
    });

    for (const order of pickList.orders) {
      await tx.externalOrder.update({
        where: { id: order.id },
        data: { status: "PICKED", pickedAt: new Date() },
      });
    }

    return true;
  });
}
