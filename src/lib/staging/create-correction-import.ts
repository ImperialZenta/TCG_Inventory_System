import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import type { Condition, Finish } from "@prisma/client";

export interface CorrectionCardInput {
  name: string;
  setCode: string;
  condition?: Condition;
  finish?: Finish;
  language?: string;
  quantity?: number;
  position?: number;
}

export interface CreateCorrectionImportInput {
  filename: string;
  cards: CorrectionCardInput[];
  sourcePickListId?: string;
  sourceMtgBlockId?: string;
  sourceNotes?: string;
}

export async function createCorrectionImport(
  input: CreateCorrectionImportInput,
  ctx: DomainContext,
): Promise<{ importId: string }> {
  const pickListHumanId = input.sourcePickListId
    ? (
        await db.pickList.findUnique({
          where: { id: input.sourcePickListId },
          select: { pickListId: true },
        })
      )?.pickListId
    : undefined;

  return db.$transaction(async (tx) => {
    const stagingImport = await tx.stagingImport.create({
      data: {
        filename: input.filename,
        rowCount: input.cards.length,
        status: "PARSED",
        kind: "CORRECTION",
        sourcePickListId: input.sourcePickListId,
        sourceMtgBlockId: input.sourceMtgBlockId,
        sourceNotes: input.sourceNotes,
        cards: {
          create: input.cards.map((card, index) => ({
            name: card.name,
            setCode: card.setCode,
            condition: card.condition ?? "NM",
            finish: card.finish ?? "NONFOIL",
            language: card.language ?? "en",
            quantity: card.quantity ?? 1,
            position: card.position ?? index + 1,
            sourceRow: index + 1,
          })),
        },
      },
    });

    await recordInventoryEvent(tx, ctx, {
      eventType: INVENTORY_EVENT_TYPES.STAGING_CORRECTION_CREATED,
      payload: {
        importId: stagingImport.id,
        filename: input.filename,
        sourcePickListId: pickListHumanId,
        sourceMtgBlockId: input.sourceMtgBlockId,
        cardCount: input.cards.length,
      },
      stagingImportId: stagingImport.id,
      pickListId: input.sourcePickListId,
    });

    return { importId: stagingImport.id };
  });
}
