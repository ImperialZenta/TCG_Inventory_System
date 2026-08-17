import type { Condition, Prisma, StockMovement } from "@prisma/client";
import { db } from "@/lib/db";
import {
  normalizeStockIdentity,
  stockIdentityUniqueWhere,
  type StockIdentity,
} from "@/lib/stock/identity";
import { StockError } from "@/lib/stock/errors";

type StockItemWithBin = Prisma.StockItemGetPayload<{
  include: { bin: { include: { shelf: true } } };
}>;

export interface StockListFilters {
  search?: string;
  gameId?: string;
  setCode?: string;
  condition?: Condition;
  binId?: string;
  includeZeroQty?: boolean;
  limit?: number;
  offset?: number;
}

export interface StockListRow {
  id: string;
  gameId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  finish: string;
  language: string;
  condition: string;
  locationLabel: string;
  onHand: number;
  reserved: number;
  available: number;
  costBasisCents: number | null;
  marketPriceCents: number | null;
}

export interface StockMovementRow {
  id: string;
  delta: number;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  actor: string | null;
  createdAt: Date;
}

export interface StockItemDetail {
  id: string;
  gameId: string;
  name: string;
  setCode: string;
  collectorNumber: string;
  finish: string;
  language: string;
  condition: string;
  locationLabel: string;
  binId: string | null;
  onHand: number;
  reserved: number;
  available: number;
  costBasisCents: number | null;
  marketPriceCents: number | null;
  catalogImageUri: string | null;
  movements: StockMovementRow[];
}

function formatLocationLabel(
  bin: StockItemWithBin["bin"],
): string {
  if (!bin) {
    return "—";
  }
  const shelfPart = bin.shelf?.code ?? bin.shelf?.label;
  const binPart = bin.binId ?? bin.label;
  if (shelfPart && binPart) {
    return `${shelfPart} · ${binPart}`;
  }
  return binPart ?? shelfPart ?? "—";
}

function toListRow(item: StockItemWithBin): StockListRow {
  const onHand = item.onHandQuantity;
  const reserved = item.reservedQuantity;
  return {
    id: item.id,
    gameId: item.gameId,
    name: item.name,
    setCode: item.setCode,
    collectorNumber: item.collectorNumber,
    finish: item.finish,
    language: item.language,
    condition: item.condition,
    locationLabel: formatLocationLabel(item.bin),
    onHand,
    reserved,
    available: onHand - reserved,
    costBasisCents: item.costBasisCents,
    marketPriceCents: item.marketPriceCents,
  };
}

function buildWhere(filters: StockListFilters): Prisma.StockItemWhereInput {
  const where: Prisma.StockItemWhereInput = {};

  if (filters.search?.trim()) {
    where.name = { contains: filters.search.trim(), mode: "insensitive" };
  }
  if (filters.gameId?.trim()) {
    where.gameId = filters.gameId.trim();
  }
  if (filters.setCode?.trim()) {
    where.setCode = filters.setCode.trim();
  }
  if (filters.condition) {
    where.condition = filters.condition;
  }
  if (filters.binId?.trim()) {
    where.binId = filters.binId.trim();
  }
  if (!filters.includeZeroQty) {
    where.onHandQuantity = { gt: 0 };
  }

  return where;
}

function toMovementRow(movement: StockMovement): StockMovementRow {
  return {
    id: movement.id,
    delta: movement.delta,
    reason: movement.reason,
    referenceType: movement.referenceType,
    referenceId: movement.referenceId,
    actor: movement.actor,
    createdAt: movement.createdAt,
  };
}

export async function listStockItems(filters: StockListFilters = {}): Promise<StockListRow[]> {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  const items = await db.stockItem.findMany({
    where: buildWhere(filters),
    include: { bin: { include: { shelf: true } } },
    orderBy: [{ name: "asc" }, { setCode: "asc" }],
    take: limit,
    skip: offset,
  });

  return items.map(toListRow);
}

export async function countStockItems(filters: StockListFilters = {}): Promise<number> {
  return db.stockItem.count({ where: buildWhere(filters) });
}

export async function getStockItemDetail(stockItemId: string): Promise<StockItemDetail | null> {
  const item = await db.stockItem.findUnique({
    where: { id: stockItemId },
    include: {
      bin: { include: { shelf: true } },
      movements: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!item) {
    return null;
  }

  const onHand = item.onHandQuantity;
  const reserved = item.reservedQuantity;

  return {
    id: item.id,
    gameId: item.gameId,
    name: item.name,
    setCode: item.setCode,
    collectorNumber: item.collectorNumber,
    finish: item.finish,
    language: item.language,
    condition: item.condition,
    locationLabel: formatLocationLabel(item.bin),
    binId: item.binId,
    onHand,
    reserved,
    available: onHand - reserved,
    costBasisCents: item.costBasisCents,
    marketPriceCents: item.marketPriceCents,
    catalogImageUri: item.catalogImageUri,
    movements: item.movements.map(toMovementRow),
  };
}

export async function getStockItemById(stockItemId: string) {
  return getStockItemDetail(stockItemId);
}

export async function findStockItemByIdentity(identity: StockIdentity) {
  const normalized = normalizeStockIdentity(identity);
  return db.stockItem.findUnique({
    where: stockIdentityUniqueWhere(normalized),
  });
}

export async function findStockItemByIdentityInTx(
  tx: Prisma.TransactionClient,
  identity: StockIdentity,
) {
  const normalized = normalizeStockIdentity(identity);
  return tx.stockItem.findUnique({
    where: stockIdentityUniqueWhere(normalized),
  });
}

export async function sumMovements(stockItemId: string): Promise<number> {
  const result = await db.stockMovement.aggregate({
    where: { stockItemId },
    _sum: { delta: true },
  });
  return result._sum.delta ?? 0;
}

export async function verifyOnHandIntegrity(stockItemId: string): Promise<boolean> {
  const item = await db.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item) {
    throw new StockError("Stock item not found");
  }
  const movementSum = await sumMovements(stockItemId);
  return item.onHandQuantity === movementSum;
}
