import { differenceInDays } from "date-fns";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import { PickError } from "@/lib/pick/errors";
import { deleteCardLineAndRenumber } from "@/lib/pick/renumber-block";

type TransactionClient = Prisma.TransactionClient;

const PICKABLE_BLOCK_STATUSES = ["SEALED", "ACTIVE"] as const;

export interface CounterPickInput {
  mtgBlockId: string;
  position: number;
}

export interface CounterPickResult {
  mtgBlockId: string;
  position: number;
  cardName: string;
  pickHistoryId: string;
}

export async function recordCounterPick(
  input: CounterPickInput,
  ctx: DomainContext,
): Promise<CounterPickResult> {
  return db.$transaction(async (tx) => {
    const block = await tx.block.findUnique({
      where: { blockId: input.mtgBlockId },
      include: {
        cards: { where: { position: input.position } },
        reservedUploadSession: { select: { sessionId: true } },
      },
    });

    if (!block) {
      throw new PickError(`Block ${input.mtgBlockId} not found`);
    }

    if (!PICKABLE_BLOCK_STATUSES.includes(block.status as (typeof PICKABLE_BLOCK_STATUSES)[number])) {
      throw new PickError(`Block ${input.mtgBlockId} is not pickable (${block.status})`);
    }

    if (block.pickHoldAt) {
      throw new PickError(`Block ${input.mtgBlockId} is quarantined`);
    }

    if (block.reservedUploadSessionId) {
      const sessionRef = block.reservedUploadSession?.sessionId ?? "an upload session";
      throw new PickError(
        `Block ${input.mtgBlockId} is reserved in upload session ${sessionRef}`,
      );
    }

    const cardLine = block.cards[0];
    if (!cardLine) {
      throw new PickError(`No card at position ${input.position} in ${input.mtgBlockId}`);
    }

    const now = new Date();
    const pickedPosition = cardLine.position;

    await deleteCardLineAndRenumber(tx, block.id, cardLine.id, pickedPosition);

    await tx.block.update({
      where: { id: block.id },
      data: { lastPickAt: now },
    });

    let pickList = await tx.pickList.findFirst({
      where: { sourceLabel: "counter-sales", status: { not: "COMPLETED" } },
      orderBy: { createdAt: "desc" },
    });

    if (!pickList) {
      const humanPickListId = await allocateNextPickListIdInTx(tx);
      pickList = await tx.pickList.create({
        data: {
          pickListId: humanPickListId,
          status: "IN_PROGRESS",
          sourceLabel: "counter-sales",
          notes: "Walk-in counter picks",
        },
      });
    }

    const dwellDays = differenceInDays(now, cardLine.addedAt);

    const history = await tx.pickHistory.create({
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
        pickListId: pickList.id,
        isCounterPick: true,
        dwellDays,
        pickedAt: now,
      },
    });

    await recordInventoryEvent(tx, ctx, {
      eventType: INVENTORY_EVENT_TYPES.PICK_COUNTER,
      payload: {
        mtgBlockId: block.blockId,
        position: pickedPosition,
        cardName: cardLine.name,
      },
      pickListId: pickList.id,
      blockId: block.id,
    });

    await recordInventoryEvent(tx, ctx, {
      eventType: INVENTORY_EVENT_TYPES.INVENTORY_DECREMENTED,
      payload: {
        cardLineId: cardLine.id,
        mtgBlockId: block.blockId,
        position: pickedPosition,
        cardName: cardLine.name,
        quantity: 1,
      },
      pickListId: pickList.id,
      blockId: block.id,
    });

    return {
      mtgBlockId: block.blockId,
      position: pickedPosition,
      cardName: cardLine.name,
      pickHistoryId: history.id,
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
