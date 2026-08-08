import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import {
  allocateCardLineForOrderLine,
  getReservedCardLineIds,
} from "@/lib/pick/allocate";
import { PickError } from "@/lib/pick/errors";
import { tryAutoReleaseHold } from "@/lib/pick/hold-list";

function actorLabel(ctx: DomainContext): string | null {
  return ctx.actor?.email ?? ctx.actor?.id ?? null;
}

export async function reallocatePendingPickItems(
  pickListId: string,
  ctx: DomainContext,
): Promise<{ reallocated: number; stillShort: number }> {
  const result = await db.$transaction(async (tx) => {
    const pickList = await tx.pickList.findUnique({
      where: { id: pickListId },
      include: {
        items: {
          where: { status: { in: ["PENDING", "SHORT"] } },
          include: { externalOrderLine: true, block: true, cardLine: true },
        },
      },
    });

    if (!pickList) {
      throw new PickError("Pick list not found");
    }

    if (pickList.status === "COMPLETED" || pickList.status === "CANCELLED") {
      throw new PickError(`Cannot reallocate on ${pickList.status.toLowerCase()} list`);
    }

    const hasReallocatable = pickList.items.some(
      (item) =>
        item.status === "SHORT" ||
        (item.status === "PENDING" && item.block?.pickHoldAt),
    );

    if (!hasReallocatable && pickList.status !== "ON_HOLD") {
      throw new PickError("No lines need re-allocation");
    }

    const reserved = await getReservedCardLineIds(tx);
    let reallocated = 0;
    let stillShort = 0;

    for (const item of pickList.items) {
      const needsRealloc =
        item.status === "SHORT" ||
        (item.status === "PENDING" && item.block?.pickHoldAt);

      if (!needsRealloc) {
        if (item.status === "PENDING" && item.cardLineId) {
          reserved.add(item.cardLineId);
        }
        continue;
      }

      const line = item.externalOrderLine;
      if (!line) continue;

      const fromMtgBlockId = item.block?.blockId;
      const fromPosition = item.cardLine?.position;

      const allocation = await allocateCardLineForOrderLine(
        {
          scryfallId: line.scryfallId,
          name: line.name,
          setCode: line.setCode,
          condition: line.condition,
          finish: line.finish,
          language: line.language,
        },
        reserved,
        "MANAPOOL",
        tx,
      );

      if (allocation) {
        if (fromMtgBlockId && fromPosition) {
          await recordInventoryEvent(tx, {
            eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_SUBSTITUTED,
            payload: {
              pickListId: pickList.pickListId,
              pickItemId: item.id,
              fromMtgBlockId,
              fromPosition,
              toMtgBlockId: allocation.mtgBlockId,
              toPosition: allocation.position,
              cardName: line.name,
            },
            pickListId: pickList.id,
            blockId: allocation.blockId,
            externalOrderId: item.externalOrderId,
            actor: actorLabel(ctx),
          });
        }

        await tx.pickItem.update({
          where: { id: item.id },
          data: {
            status: "PENDING",
            shortReason: null,
            blockedReason: null,
            cardLineId: allocation.cardLine.id,
            blockId: allocation.blockId,
          },
        });

        await recordInventoryEvent(tx, {
          eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_ALLOCATED,
          payload: {
            pickListId: pickList.pickListId,
            pickItemId: item.id,
            mtgBlockId: allocation.mtgBlockId,
            position: allocation.position,
            cardName: line.name,
          },
          pickListId: pickList.id,
          blockId: allocation.blockId,
          externalOrderId: item.externalOrderId,
          actor: actorLabel(ctx),
        });

        reallocated++;
      } else {
        await tx.pickItem.update({
          where: { id: item.id },
          data: {
            status: "SHORT",
            shortReason: "NO_STOCK",
            blockedReason: null,
            cardLineId: null,
            blockId: null,
          },
        });
        stillShort++;
      }
    }

    return { reallocated, stillShort };
  });

  await tryAutoReleaseHold(pickListId, ctx);

  return result;
}
