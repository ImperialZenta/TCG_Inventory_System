import type { Prisma } from "@prisma/client";
import { getAvailable } from "@/lib/stock/availability";
import { StockError } from "@/lib/stock/errors";

type TransactionClient = Prisma.TransactionClient;

export interface PromotableCardIdentity {
  catalogCardId: string;
  name: string;
  setCode: string;
  quantityInBlocks: number;
}

export interface PromotableCardLineOption {
  cardLineId: string;
  catalogCardId: string;
  name: string;
  setCode: string;
  mtgBlockId: string;
  quantity: number;
}

export interface AlternateStockOption {
  stockItemId: string;
  label: string;
  available: number;
}

export async function getChannelOfferedQty(
  tx: TransactionClient,
  channelId: string,
  stockItemId: string,
): Promise<number> {
  const channel = await tx.channel.findUnique({ where: { id: channelId } });
  if (!channel) {
    throw new StockError("Channel not found");
  }

  const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item || item.onHandQuantity <= 0) {
    return 0;
  }

  const available = await getAvailable(tx, stockItemId);
  const offered = available - channel.reserveBufferQty;
  return Math.max(0, offered);
}

export async function isStockItemOfferable(
  tx: TransactionClient,
  stockItemId: string,
): Promise<boolean> {
  const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item || item.onHandQuantity <= 0) {
    return false;
  }
  const available = await getAvailable(tx, stockItemId);
  return available > 0;
}

/** Cards that exist only in chaos blocks — never channel-synced as sellable stock. */
export async function isCatalogCardChaosOnly(
  tx: TransactionClient,
  catalogCardId: string,
): Promise<boolean> {
  const onHandStock = await tx.stockItem.findFirst({
    where: { catalogCardId, onHandQuantity: { gt: 0 } },
  });
  if (onHandStock) {
    return false;
  }
  const inBlock = await tx.cardLine.findFirst({
    where: { scryfallId: catalogCardId },
  });
  return inBlock != null;
}

/** Block-held cards with no on-hand stock row — promotable, not auto-listed. */
export async function listPromotableInventory(
  tx: TransactionClient,
): Promise<PromotableCardIdentity[]> {
  const lines = await tx.cardLine.findMany({
    where: { scryfallId: { not: null } },
    select: {
      scryfallId: true,
      name: true,
      setCode: true,
      quantity: true,
    },
  });

  const byCatalog = new Map<string, PromotableCardIdentity>();
  for (const line of lines) {
    if (!line.scryfallId) continue;
    const onHand = await tx.stockItem.findFirst({
      where: { catalogCardId: line.scryfallId, onHandQuantity: { gt: 0 } },
    });
    if (onHand) continue;

    const existing = byCatalog.get(line.scryfallId);
    if (existing) {
      existing.quantityInBlocks += line.quantity;
    } else {
      byCatalog.set(line.scryfallId, {
        catalogCardId: line.scryfallId,
        name: line.name,
        setCode: line.setCode,
        quantityInBlocks: line.quantity,
      });
    }
  }
  return [...byCatalog.values()];
}

/** Staff-selectable chaos card lines for oversell resolution (and inventory UI). */
export async function listPromotableCardLines(
  tx: TransactionClient,
  catalogCardId?: string,
  options?: { forOversellResolution?: boolean },
): Promise<PromotableCardLineOption[]> {
  const lines = await tx.cardLine.findMany({
    where: {
      scryfallId: catalogCardId ? catalogCardId : { not: null },
      block: { status: "OPEN" },
    },
    include: { block: { select: { blockId: true } } },
    orderBy: [{ name: "asc" }, { block: { blockId: "asc" } }],
  });

  const optionsList: PromotableCardLineOption[] = [];
  for (const line of lines) {
    if (!line.scryfallId) continue;
    if (!options?.forOversellResolution) {
      const onHand = await tx.stockItem.findFirst({
        where: { catalogCardId: line.scryfallId, onHandQuantity: { gt: 0 } },
      });
      if (onHand) continue;
    }
    optionsList.push({
      cardLineId: line.id,
      catalogCardId: line.scryfallId,
      name: line.name,
      setCode: line.setCode,
      mtgBlockId: line.block.blockId,
      quantity: line.quantity,
    });
  }
  return optionsList;
}

export async function listAlternateStockItems(
  tx: TransactionClient,
  stockItemId: string,
): Promise<AlternateStockOption[]> {
  const item = await tx.stockItem.findUnique({ where: { id: stockItemId } });
  if (!item) return [];

  const candidates = await tx.stockItem.findMany({
    where: {
      catalogCardId: item.catalogCardId,
      id: { not: stockItemId },
      onHandQuantity: { gt: 0 },
    },
    orderBy: { condition: "asc" },
  });

  const options: AlternateStockOption[] = [];
  for (const candidate of candidates) {
    const available = await getAvailable(tx, candidate.id);
    if (available <= 0) continue;
    options.push({
      stockItemId: candidate.id,
      label: `${candidate.name} · ${candidate.condition} · avail ${available}`,
      available,
    });
  }
  return options;
}

export async function getPromotableInventoryForStaff(): Promise<PromotableCardLineOption[]> {
  const { db } = await import("@/lib/db");
  return db.$transaction((tx) => listPromotableCardLines(tx));
}
