import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import {
  completePickListIfReady,
  executePickItem,
  executePickItemInTx,
} from "@/lib/pick/complete-pick";
import { PickError } from "@/lib/pick/errors";
import { getReservedCardLineIds } from "@/lib/pick/allocate";
import type { ShortReason } from "@/lib/pick/types";

function actorLabel(ctx: DomainContext): string | null {
  return ctx.actor?.email ?? ctx.actor?.id ?? null;
}

export async function markPickItemSubstituted(
  pickItemId: string,
  alternateCardLineId: string,
  ctx: DomainContext,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const item = await tx.pickItem.findUnique({
      where: { id: pickItemId },
      include: {
        pickList: true,
        block: true,
        cardLine: true,
        externalOrderLine: true,
      },
    });

    if (!item) {
      throw new PickError("Pick item not found");
    }

    if (item.pickList.status === "ON_HOLD") {
      throw new PickError("Pick list is on hold");
    }

    if (item.status !== "PENDING") {
      throw new PickError(`Pick item is already ${item.status.toLowerCase()}`);
    }

    const alternate = await tx.cardLine.findUnique({
      where: { id: alternateCardLineId },
      include: { block: true },
    });

    if (!alternate || !alternate.block) {
      throw new PickError("Alternate card line not found");
    }

    if (alternate.block.pickHoldAt) {
      throw new PickError(`Block ${alternate.block.blockId} is quarantined`);
    }

    const reserved = await getReservedCardLineIds(tx);
    if (reserved.has(alternate.id) && alternate.id !== item.cardLineId) {
      throw new PickError("Alternate card is reserved on another pick list");
    }

    const line = item.externalOrderLine;
    const fromMtgBlockId = item.block?.blockId ?? "—";
    const fromPosition = item.cardLine?.position ?? 0;

    if (fromMtgBlockId !== alternate.block.blockId || fromPosition !== alternate.position) {
      await recordInventoryEvent(tx, {
        eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_SUBSTITUTED,
        payload: {
          pickListId: item.pickList.pickListId,
          pickItemId: item.id,
          fromMtgBlockId,
          fromPosition: fromPosition || alternate.position,
          toMtgBlockId: alternate.block.blockId,
          toPosition: alternate.position,
          cardName: line?.name ?? alternate.name,
        },
        pickListId: item.pickListId,
        blockId: alternate.block.id,
        externalOrderId: item.externalOrderId,
        actor: actorLabel(ctx),
      });
    }

    await tx.pickItem.update({
      where: { id: pickItemId },
      data: {
        cardLineId: alternate.id,
        blockId: alternate.block.id,
      },
    });

    await executePickItemInTx(tx, pickItemId, ctx);
  });

  const item = await db.pickItem.findUnique({
    where: { id: pickItemId },
    select: { pickListId: true },
  });
  if (item) {
    await completePickListIfReady(item.pickListId, ctx);
  }
}

export async function markPickItemPicked(
  pickItemId: string,
  ctx: DomainContext,
): Promise<void> {
  await executePickItem(pickItemId, ctx);
  const item = await db.pickItem.findUnique({
    where: { id: pickItemId },
    select: { pickListId: true },
  });
  if (item) {
    await completePickListIfReady(item.pickListId, ctx);
  }
}

export async function markPickItemShort(
  pickItemId: string,
  reason: ShortReason,
  ctx: DomainContext,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const item = await tx.pickItem.findUnique({
      where: { id: pickItemId },
      include: { pickList: true, block: true, externalOrderLine: true, cardLine: true },
    });

    if (!item) {
      throw new PickError("Pick item not found");
    }

    if (item.pickList.status === "ON_HOLD") {
      throw new PickError("Pick list is on hold");
    }

    if (item.status !== "PENDING") {
      throw new PickError(`Pick item is already ${item.status.toLowerCase()}`);
    }

    const cardName =
      item.externalOrderLine?.name ?? item.cardLine?.name ?? "Unknown card";

    await tx.pickItem.update({
      where: { id: pickItemId },
      data: {
        status: "SHORT",
        shortReason: reason,
        cardLineId: null,
        blockId: null,
      },
    });

    if (item.pickList.status === "OPEN") {
      await tx.pickList.update({
        where: { id: item.pickListId },
        data: { status: "IN_PROGRESS" },
      });
    }

    await recordInventoryEvent(tx, {
      eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_SHORT,
      payload: {
        pickListId: item.pickList.pickListId,
        pickItemId: item.id,
        mtgBlockId: item.block?.blockId,
        cardName,
        reason,
      },
      pickListId: item.pickListId,
      blockId: item.blockId,
      externalOrderId: item.externalOrderId,
      actor: actorLabel(ctx),
    });
  });

  const item = await db.pickItem.findUnique({
    where: { id: pickItemId },
    select: { pickListId: true },
  });
  if (item) {
    await completePickListIfReady(item.pickListId, ctx);
  }
}
