import type { BlockChannel, Condition, Finish, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { allocateCardLineForOrderLine, getReservedCardLineIds } from "@/lib/pick/allocate";
import { PickError } from "@/lib/pick/errors";

type TransactionClient = Prisma.TransactionClient;

function actorLabel(ctx: DomainContext): string | null {
  return ctx.actor?.email ?? ctx.actor?.id ?? null;
}

export interface AdHocPickLine {
  scryfallId?: string | null;
  name: string;
  setCode?: string | null;
  condition: Condition;
  finish: Finish;
  language: string;
  quantity?: number;
}

export interface CreatePickListFromLinesResult {
  pickListId: string;
  humanPickListId: string;
  itemCount: number;
  shortCount: number;
  unmatched: AdHocPickLine[];
}

export async function createPickListFromLines(
  lines: AdHocPickLine[],
  options: {
    sourceLabel: string;
    channel?: BlockChannel;
    notes?: string;
  },
  ctx: DomainContext,
): Promise<CreatePickListFromLinesResult> {
  return db.$transaction(async (tx) => {
    const humanPickListId = await allocateNextPickListIdInTx(tx);
    const channel = options.channel ?? "MANAPOOL";
    const reserved = await getReservedCardLineIds(tx);

    const pickList = await tx.pickList.create({
      data: {
        pickListId: humanPickListId,
        status: "OPEN",
        sourceLabel: options.sourceLabel,
        notes: options.notes,
      },
    });

    let itemCount = 0;
    let shortCount = 0;
    const unmatched: AdHocPickLine[] = [];

    for (const line of lines) {
      const qty = line.quantity ?? 1;
      for (let unit = 0; unit < qty; unit++) {
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
          channel,
          tx,
        );

        if (allocation) {
          const item = await tx.pickItem.create({
            data: {
              pickListId: pickList.id,
              cardLineId: allocation.cardLine.id,
              blockId: allocation.blockId,
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
            blockId: allocation.blockId,
            actor: actorLabel(ctx),
          });
        } else {
          await tx.pickItem.create({
            data: {
              pickListId: pickList.id,
              quantity: 1,
              status: "SHORT",
              shortReason: "NO_STOCK",
              notes: line.name,
            },
          });
          shortCount++;
          if (unit === 0) {
            unmatched.push(line);
          }
        }

        itemCount++;
      }
    }

    await recordInventoryEvent(tx, {
      eventType: INVENTORY_EVENT_TYPES.PICK_LIST_CREATED,
      payload: {
        pickListId: humanPickListId,
        itemCount,
        orderIds: [],
      },
      pickListId: pickList.id,
      actor: actorLabel(ctx),
    });

    return {
      pickListId: pickList.id,
      humanPickListId,
      itemCount,
      shortCount,
      unmatched,
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
