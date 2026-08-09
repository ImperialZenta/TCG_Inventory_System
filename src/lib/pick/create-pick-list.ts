import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { allocateCardLineForOrderLine, getReservedCardLineIds } from "@/lib/pick/allocate";
import { PickError } from "@/lib/pick/errors";
import { allocateNextPickListId } from "@/lib/pick/ids";
import { assignWavesForPickList } from "@/lib/pick/waves";

type TransactionClient = Prisma.TransactionClient;

function actorLabel(ctx: DomainContext): string | null {
  return ctx.actor?.email ?? ctx.actor?.id ?? null;
}

export interface CreatePickListResult {
  pickListId: string;
  humanPickListId: string;
  itemCount: number;
  shortCount: number;
}

export async function createPickListForOrder(
  externalOrderId: string,
  ctx: DomainContext,
): Promise<CreatePickListResult> {
  const order = await db.externalOrder.findUnique({
    where: { id: externalOrderId },
    include: { lines: true, pickList: true },
  });

  if (!order) {
    throw new PickError("Order not found");
  }

  if (order.status === "PICKED" || order.status === "CANCELLED") {
    throw new PickError(`Order is ${order.status.toLowerCase()}`);
  }

  if (order.pickListId && order.pickList) {
    throw new PickError(`Order already has pick list ${order.pickList.pickListId}`);
  }

  return db.$transaction(async (tx) => {
    const humanPickListId = await allocateNextPickListIdInTx(tx);
    const reserved = await getReservedCardLineIds(tx);

    const pickList = await tx.pickList.create({
      data: {
        pickListId: humanPickListId,
        status: "OPEN",
      },
    });

    let itemCount = 0;
    let shortCount = 0;

    for (const line of order.lines) {
      for (let unit = 0; unit < line.quantity; unit++) {
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
          const item = await tx.pickItem.create({
            data: {
              pickListId: pickList.id,
              cardLineId: allocation.cardLine.id,
              blockId: allocation.blockId,
              externalOrderId: order.id,
              externalOrderLineId: line.id,
              quantity: 1,
              status: "PENDING",
            },
          });

          await recordInventoryEvent(tx, {
            eventType: INVENTORY_EVENT_TYPES.PICK_ITEM_ALLOCATED,
            payload: {
              pickListId: humanPickListId,
              pickItemId: item.id,
              mtgBlockId: allocation.mtgBlockId,
              position: allocation.position,
              cardName: line.name,
            },
            pickListId: pickList.id,
            externalOrderId: order.id,
            blockId: allocation.blockId,
            actor: actorLabel(ctx),
          });
        } else {
          await tx.pickItem.create({
            data: {
              pickListId: pickList.id,
              externalOrderId: order.id,
              externalOrderLineId: line.id,
              quantity: 1,
              status: "SHORT",
              shortReason: "NO_STOCK",
            },
          });
          shortCount++;
        }

        itemCount++;
      }
    }

    await tx.externalOrder.update({
      where: { id: order.id },
      data: {
        status: "PICKING",
        pickListId: pickList.id,
      },
    });

    await recordInventoryEvent(tx, {
      eventType: INVENTORY_EVENT_TYPES.PICK_LIST_CREATED,
      payload: {
        pickListId: humanPickListId,
        itemCount,
        orderIds: [order.id],
      },
      pickListId: pickList.id,
      externalOrderId: order.id,
      actor: actorLabel(ctx),
    });

    await assignWavesForPickList(pickList.id, tx);

    return {
      pickListId: pickList.id,
      humanPickListId,
      itemCount,
      shortCount,
    };
  });
}

async function allocateNextPickListIdInTx(tx: TransactionClient): Promise<string> {
  const seq = await tx.pickListSequence.update({
    where: { id: "pick" },
    data: { nextNum: { increment: 1 } },
  });
  const num = seq.nextNum - 1;
  const prefix = seq.prefix ?? "PICK";
  return `${prefix}-${String(num).padStart(4, "0")}`;
}
