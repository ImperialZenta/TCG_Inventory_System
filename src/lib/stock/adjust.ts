import type { StockMovementReason } from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { applyStockMovementInTx, type ApplyStockMovementResult } from "@/lib/stock/apply-movement";
import { StockError } from "@/lib/stock/errors";

export const MANUAL_ADJUSTMENT_REASONS = [
  "COUNT_ADJUST",
  "DAMAGE",
  "RETURN",
] as const satisfies readonly StockMovementReason[];

export type ManualAdjustmentReason = (typeof MANUAL_ADJUSTMENT_REASONS)[number];

export interface AdjustStockQuantityInput {
  stockItemId: string;
  targetOnHand: number;
  reason: StockMovementReason | string | null | undefined;
}

function isManualAdjustmentReason(reason: string): reason is ManualAdjustmentReason {
  return (MANUAL_ADJUSTMENT_REASONS as readonly string[]).includes(reason);
}

export async function adjustStockQuantity(
  ctx: DomainContext,
  input: AdjustStockQuantityInput,
): Promise<ApplyStockMovementResult> {
  const reasonRaw = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!reasonRaw) {
    throw new StockError("Adjustment reason is required");
  }
  if (!isManualAdjustmentReason(reasonRaw)) {
    throw new StockError("Invalid adjustment reason");
  }

  if (!Number.isInteger(input.targetOnHand) || input.targetOnHand < 0) {
    throw new StockError("Target quantity must be a non-negative whole number");
  }

  const item = await db.stockItem.findUnique({ where: { id: input.stockItemId } });
  if (!item) {
    throw new StockError("Stock item not found");
  }

  const delta = input.targetOnHand - item.onHandQuantity;
  if (delta === 0) {
    throw new StockError("No change");
  }

  if (input.targetOnHand < item.reservedQuantity) {
    throw new StockError(
      `Cannot adjust below reserved quantity (${item.reservedQuantity} reserved)`,
    );
  }

  return db.$transaction((tx) =>
    applyStockMovementInTx(tx, ctx, {
      stockItemId: input.stockItemId,
      delta,
      reason: reasonRaw,
    }),
  );
}
