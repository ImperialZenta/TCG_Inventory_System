import type {
  Prisma,
  StockItem,
  StockReservation,
  StockReservationReleaseReason,
  StockReservationStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import type { DomainContext } from "@/lib/context/domain-context";
import { inventoryEventActor } from "@/lib/context/actor";
import { applyStockMovementInTx, type ApplyStockMovementResult } from "@/lib/stock/apply-movement";
import { InsufficientStockError, StockError } from "@/lib/stock/errors";

type TransactionClient = Prisma.TransactionClient;

export const DEFAULT_HOLD_WINDOW_MS = 72 * 60 * 60 * 1000;

export interface StockReference {
  referenceType: string;
  referenceId: string;
}

export interface ReserveStockInput {
  stockItemId: string;
  quantity: number;
  reference: StockReference;
  expiresAt?: Date;
}

export interface ReleaseStockInput {
  stockItemId: string;
  quantity: number;
  reference: StockReference;
  releaseReason: StockReservationReleaseReason;
}

export interface CommitSaleInput {
  stockItemId: string;
  quantity: number;
  reference: StockReference;
}

export interface StockAvailability {
  onHand: number;
  reserved: number;
  available: number;
}

export interface ReserveStockResult {
  stockItem: StockItem;
  reservation: StockReservation;
}

export interface ReleaseStockResult {
  stockItem: StockItem;
  reservation: StockReservation;
}

export interface CommitSaleResult extends ApplyStockMovementResult {
  reservation: StockReservation;
}

async function lockStockItem(tx: TransactionClient, stockItemId: string): Promise<StockItem> {
  await tx.$executeRaw`SELECT id FROM "StockItem" WHERE id = ${stockItemId} FOR UPDATE`;
  const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item) {
    throw new StockError("Stock item not found");
  }
  return item;
}

function assertPositiveInteger(quantity: number, label: string): void {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new StockError(`${label} must be a positive integer`);
  }
}

function availableQuantity(item: Pick<StockItem, "onHandQuantity" | "reservedQuantity">): number {
  return item.onHandQuantity - item.reservedQuantity;
}

async function notifyAvailabilityChange(
  ctx: DomainContext,
  tx: TransactionClient,
  stockItemId: string,
): Promise<void> {
  const { propagateAvailabilityChange } = await import("@/lib/channels/oversell-guard");
  await propagateAvailabilityChange(ctx, tx, stockItemId);
}

async function findActiveReservation(
  tx: TransactionClient,
  stockItemId: string,
  reference: StockReference,
): Promise<StockReservation | null> {
  return tx.stockReservation.findFirst({
    where: {
      stockItemId,
      referenceType: reference.referenceType,
      referenceId: reference.referenceId,
      status: "ACTIVE",
    },
  });
}

export async function getAvailable(tx: TransactionClient, stockItemId: string): Promise<number> {
  const availability = await getStockAvailability(tx, stockItemId);
  return availability.available;
}

export async function getStockAvailability(
  tx: TransactionClient,
  stockItemId: string,
): Promise<StockAvailability> {
  const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item) {
    throw new StockError("Stock item not found");
  }
  return {
    onHand: item.onHandQuantity,
    reserved: item.reservedQuantity,
    available: availableQuantity(item),
  };
}

export async function reserveStockInTx(
  ctx: DomainContext,
  tx: TransactionClient,
  input: ReserveStockInput,
): Promise<ReserveStockResult> {
  assertPositiveInteger(input.quantity, "Reserve quantity");

  const item = await lockStockItem(tx, input.stockItemId);
  const existing = await findActiveReservation(tx, input.stockItemId, input.reference);
  if (existing) {
    if (existing.quantity !== input.quantity) {
      throw new StockError("Active reservation already exists for this reference with a different quantity");
    }
    return { stockItem: item, reservation: existing };
  }

  if (availableQuantity(item) < input.quantity) {
    throw new InsufficientStockError();
  }

  const expiresAt = input.expiresAt ?? new Date(Date.now() + DEFAULT_HOLD_WINDOW_MS);
  const actor = inventoryEventActor(ctx);

  const reservation = await tx.stockReservation.create({
    data: {
      stockItemId: input.stockItemId,
      quantity: input.quantity,
      referenceType: input.reference.referenceType,
      referenceId: input.reference.referenceId,
      status: "ACTIVE",
      expiresAt,
      actor,
    },
  });

  const stockItem = await tx.stockItem.update({
    where: { id: input.stockItemId },
    data: { reservedQuantity: item.reservedQuantity + input.quantity },
  });

  return { stockItem, reservation };
}

function terminalStatusForRelease(
  releaseReason: StockReservationReleaseReason,
): StockReservationStatus {
  switch (releaseReason) {
    case "COMMITTED":
      return "COMMITTED";
    case "EXPIRED":
      return "EXPIRED";
    case "CANCEL":
      return "RELEASED";
  }
}

export async function releaseStockInTx(
  ctx: DomainContext,
  tx: TransactionClient,
  input: ReleaseStockInput,
): Promise<ReleaseStockResult> {
  assertPositiveInteger(input.quantity, "Release quantity");

  const item = await lockStockItem(tx, input.stockItemId);
  const reservation = await findActiveReservation(tx, input.stockItemId, input.reference);
  if (!reservation) {
    throw new StockError("Active reservation not found for reference");
  }
  if (reservation.quantity !== input.quantity) {
    throw new StockError("Release quantity does not match active reservation");
  }

  const actor = inventoryEventActor(ctx);
  const updatedReservation = await tx.stockReservation.update({
    where: { id: reservation.id },
    data: {
      status: terminalStatusForRelease(input.releaseReason),
      releaseReason: input.releaseReason,
      actor: actor ?? reservation.actor,
    },
  });

  const stockItem = await tx.stockItem.update({
    where: { id: input.stockItemId },
    data: { reservedQuantity: Math.max(0, item.reservedQuantity - input.quantity) },
  });

  await notifyAvailabilityChange(ctx, tx, input.stockItemId);

  return { stockItem, reservation: updatedReservation };
}

export async function commitSaleInTx(
  ctx: DomainContext,
  tx: TransactionClient,
  input: CommitSaleInput,
): Promise<CommitSaleResult> {
  assertPositiveInteger(input.quantity, "Commit quantity");

  const item = await lockStockItem(tx, input.stockItemId);
  const reservation = await findActiveReservation(tx, input.stockItemId, input.reference);
  if (!reservation) {
    throw new StockError("Active reservation not found for reference");
  }
  if (reservation.quantity !== input.quantity) {
    throw new StockError("Commit quantity does not match active reservation");
  }
  if (item.reservedQuantity < input.quantity) {
    throw new InsufficientStockError();
  }

  const movement = await applyStockMovementInTx(tx, ctx, {
    stockItemId: input.stockItemId,
    delta: -input.quantity,
    reason: "SALE",
    referenceType: input.reference.referenceType,
    referenceId: input.reference.referenceId,
  });

  const actor = inventoryEventActor(ctx);
  const updatedReservation = await tx.stockReservation.update({
    where: { id: reservation.id },
    data: {
      status: "COMMITTED",
      releaseReason: "COMMITTED",
      actor: actor ?? reservation.actor,
    },
  });

  const stockItem = await tx.stockItem.update({
    where: { id: input.stockItemId },
    data: { reservedQuantity: item.reservedQuantity - input.quantity },
  });

  await notifyAvailabilityChange(ctx, tx, input.stockItemId);

  return {
    stockItem,
    movementId: movement.movementId,
    onHandAfter: movement.onHandAfter,
    reservation: updatedReservation,
  };
}

export async function reserveStock(
  ctx: DomainContext,
  input: ReserveStockInput,
): Promise<ReserveStockResult> {
  return db.$transaction(async (tx) => reserveStockInTx(ctx, tx, input));
}

export async function releaseStock(
  ctx: DomainContext,
  input: ReleaseStockInput,
): Promise<ReleaseStockResult> {
  return db.$transaction(async (tx) => releaseStockInTx(ctx, tx, input));
}

export async function commitSale(
  ctx: DomainContext,
  input: CommitSaleInput,
): Promise<CommitSaleResult> {
  return db.$transaction(async (tx) => commitSaleInTx(ctx, tx, input));
}

export async function sweepExpiredReservations(ctx: DomainContext): Promise<number> {
  const now = new Date();
  const expired = await db.stockReservation.findMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    orderBy: { expiresAt: "asc" },
  });

  let released = 0;
  for (const reservation of expired) {
    await db.$transaction(async (tx) => {
      await releaseStockInTx(ctx, tx, {
        stockItemId: reservation.stockItemId,
        quantity: reservation.quantity,
        reference: {
          referenceType: reservation.referenceType,
          referenceId: reservation.referenceId,
        },
        releaseReason: "EXPIRED",
      });
    });
    released += 1;
  }

  return released;
}
