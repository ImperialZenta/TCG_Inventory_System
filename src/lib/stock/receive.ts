import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { applyStockMovementInTx, type ApplyStockMovementResult } from "@/lib/stock/apply-movement";
import type { StockIdentity } from "@/lib/stock/identity";
import { StockError } from "@/lib/stock/errors";

export interface ReceiveStockOptions {
  referenceType?: string | null;
  referenceId?: string | null;
  marketPriceCents?: number | null;
  catalogImageUri?: string | null;
  binId?: string | null;
}

export async function receiveStockInTx(
  tx: Parameters<typeof applyStockMovementInTx>[0],
  ctx: DomainContext,
  identity: StockIdentity,
  quantity: number,
  options: ReceiveStockOptions = {},
): Promise<ApplyStockMovementResult> {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new StockError("Receive quantity must be a positive integer");
  }

  return applyStockMovementInTx(tx, ctx, {
    identity,
    delta: quantity,
    reason: "RECEIVE",
    referenceType: options.referenceType,
    referenceId: options.referenceId,
    marketPriceCents: options.marketPriceCents,
    catalogImageUri: options.catalogImageUri,
    binId: options.binId,
  });
}

export async function receiveStock(
  ctx: DomainContext,
  identity: StockIdentity,
  quantity: number,
  options: ReceiveStockOptions = {},
): Promise<ApplyStockMovementResult> {
  return db.$transaction(async (tx) => receiveStockInTx(tx, ctx, identity, quantity, options));
}
