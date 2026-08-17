import type { Prisma } from "@prisma/client";
import type { DomainContext } from "@/lib/context/domain-context";
import { applyStockMovementInTx } from "@/lib/stock/apply-movement";
import { StockError } from "@/lib/stock/errors";
import type { StockIdentity } from "@/lib/stock/identity";

type TransactionClient = Prisma.TransactionClient;

export interface PromoteCardLineResult {
  stockItemId: string;
  cardLineId: string;
  onHandAfter: number;
}

/** Minimal SKU-004 bridge for oversell resolution until full promote story ships. */
export async function promoteCardLineToStockInTx(
  ctx: DomainContext,
  tx: TransactionClient,
  cardLineId: string,
): Promise<PromoteCardLineResult> {
  const cardLine = await tx.cardLine.findUnique({
    where: { id: cardLineId },
    include: { block: true },
  });
  if (!cardLine) {
    throw new StockError("Card line not found");
  }
  if (cardLine.block.status !== "OPEN") {
    throw new StockError("Can only promote from an open block");
  }
  if (cardLine.quantity <= 0) {
    throw new StockError("Card line has no quantity to promote");
  }

  const identity: StockIdentity = {
    scryfallId: cardLine.scryfallId,
    name: cardLine.name,
    setCode: cardLine.setCode,
    collectorNumber: cardLine.collectorNumber,
    finish: cardLine.finish,
    language: cardLine.language,
    condition: cardLine.condition,
  };

  const movement = await applyStockMovementInTx(tx, ctx, {
    identity,
    delta: 1,
    reason: "PROMOTE",
    referenceType: "CARD_LINE",
    referenceId: cardLine.id,
    marketPriceCents: cardLine.priceCents,
    catalogImageUri: cardLine.imageUri,
  });

  if (cardLine.quantity === 1) {
    await tx.cardLine.delete({ where: { id: cardLine.id } });
  } else {
    await tx.cardLine.update({
      where: { id: cardLine.id },
      data: { quantity: cardLine.quantity - 1 },
    });
  }

  return {
    stockItemId: movement.stockItem.id,
    cardLineId: cardLine.id,
    onHandAfter: movement.onHandAfter,
  };
}

export async function promoteCardLineToStock(
  ctx: DomainContext,
  cardLineId: string,
): Promise<PromoteCardLineResult> {
  const { db } = await import("@/lib/db");
  return db.$transaction((tx) => promoteCardLineToStockInTx(ctx, tx, cardLineId));
}
