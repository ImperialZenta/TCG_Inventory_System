import type { Prisma, StockItem, StockMovementReason } from "@prisma/client";
import type { DomainContext } from "@/lib/context/domain-context";
import { inventoryEventActor } from "@/lib/context/actor";
import { INVENTORY_EVENT_TYPES, recordInventoryEvent } from "@/lib/events";
import {
  normalizeStockIdentity,
  stockIdentityUniqueWhere,
  type StockIdentity,
} from "@/lib/stock/identity";
import { StockError } from "@/lib/stock/errors";

type TransactionClient = Prisma.TransactionClient;

export interface ApplyStockMovementInput {
  stockItemId?: string;
  identity?: StockIdentity;
  delta: number;
  reason: StockMovementReason;
  referenceType?: string | null;
  referenceId?: string | null;
  marketPriceCents?: number | null;
  catalogImageUri?: string | null;
  binId?: string | null;
}

export interface ApplyStockMovementResult {
  stockItem: StockItem;
  movementId: string;
  onHandAfter: number;
}

async function resolveStockItem(
  tx: TransactionClient,
  input: ApplyStockMovementInput,
): Promise<StockItem> {
  if (input.stockItemId) {
    const item = await tx.stockItem.findUnique({ where: { id: input.stockItemId } });
    if (!item) {
      throw new StockError("Stock item not found");
    }
    return item;
  }

  if (!input.identity) {
    throw new StockError("Stock item identity is required when stockItemId is omitted");
  }

  const normalized = normalizeStockIdentity(input.identity);
  const existing = await tx.stockItem.findUnique({
    where: stockIdentityUniqueWhere(normalized),
  });
  if (existing) {
    return existing;
  }

  if (input.delta <= 0) {
    throw new StockError("Cannot reduce quantity for a stock item that does not exist");
  }

  return tx.stockItem.create({
    data: {
      gameId: normalized.gameId,
      catalogCardId: normalized.catalogCardId,
      name: normalized.name,
      setCode: normalized.setCode,
      collectorNumber: normalized.collectorNumber,
      finish: normalized.finish,
      language: normalized.language,
      condition: normalized.condition,
      onHandQuantity: 0,
      reservedQuantity: 0,
      marketPriceCents: input.marketPriceCents ?? null,
      catalogImageUri: input.catalogImageUri ?? null,
      binId: input.binId ?? null,
    },
  });
}

export async function applyStockMovementInTx(
  tx: TransactionClient,
  ctx: DomainContext,
  input: ApplyStockMovementInput,
): Promise<ApplyStockMovementResult> {
  // ADR-004: append-only — this module never updates or deletes StockMovement rows.
  if (input.delta === 0) {
    throw new StockError("Movement delta must be non-zero");
  }

  const item = await resolveStockItem(tx, input);
  const onHandAfter = item.onHandQuantity + input.delta;

  if (onHandAfter < 0) {
    throw new StockError("Stock quantity cannot go negative");
  }

  const actor = inventoryEventActor(ctx);

  const movement = await tx.stockMovement.create({
    data: {
      stockItemId: item.id,
      delta: input.delta,
      reason: input.reason,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      actor,
    },
  });

  const stockItem = await tx.stockItem.update({
    where: { id: item.id },
    data: {
      onHandQuantity: onHandAfter,
      ...(input.marketPriceCents != null ? { marketPriceCents: input.marketPriceCents } : {}),
      ...(input.catalogImageUri != null ? { catalogImageUri: input.catalogImageUri } : {}),
      ...(input.binId !== undefined ? { binId: input.binId } : {}),
    },
  });

  await recordInventoryEvent(tx, ctx, {
    eventType: INVENTORY_EVENT_TYPES.STOCK_MOVEMENT,
    payload: {
      stockItemId: stockItem.id,
      name: stockItem.name,
      setCode: stockItem.setCode,
      delta: input.delta,
      reason: input.reason,
      onHandAfter,
    },
    stockItemId: stockItem.id,
  });

  return {
    stockItem,
    movementId: movement.id,
    onHandAfter,
  };
}
