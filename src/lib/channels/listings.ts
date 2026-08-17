import type { ChannelListing, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type TransactionClient = Prisma.TransactionClient;

export async function findListingsForStockItem(
  tx: TransactionClient,
  stockItemId: string,
  options?: { status?: ChannelListing["status"] },
) {
  return tx.channelListing.findMany({
    where: {
      stockItemId,
      ...(options?.status ? { status: options.status } : {}),
    },
    include: { channel: true },
  });
}

export async function findActiveListingsForStockItem(tx: TransactionClient, stockItemId: string) {
  return findListingsForStockItem(tx, stockItemId, { status: "ACTIVE" });
}

export async function getChannelListingById(listingId: string) {
  return db.channelListing.findUnique({
    where: { id: listingId },
    include: { channel: true, stockItem: true },
  });
}

export async function upsertChannelListing(
  tx: TransactionClient,
  data: {
    channelId: string;
    stockItemId: string;
    externalListingId?: string | null;
    lastSyncedQty?: number | null;
    status?: ChannelListing["status"];
  },
): Promise<ChannelListing> {
  return tx.channelListing.upsert({
    where: {
      channelId_stockItemId: {
        channelId: data.channelId,
        stockItemId: data.stockItemId,
      },
    },
    create: {
      channelId: data.channelId,
      stockItemId: data.stockItemId,
      externalListingId: data.externalListingId ?? null,
      lastSyncedQty: data.lastSyncedQty ?? null,
      lastSyncedAt: data.lastSyncedQty != null ? new Date() : null,
      status: data.status ?? "ACTIVE",
    },
    update: {
      externalListingId: data.externalListingId ?? undefined,
      lastSyncedQty: data.lastSyncedQty ?? undefined,
      lastSyncedAt: data.lastSyncedQty != null ? new Date() : undefined,
      status: data.status ?? undefined,
    },
  });
}

export async function updateListingSyncState(
  tx: TransactionClient,
  listingId: string,
  data: {
    lastSyncedQty?: number | null;
    status?: ChannelListing["status"];
    externalListingId?: string | null;
  },
): Promise<ChannelListing> {
  return tx.channelListing.update({
    where: { id: listingId },
    data: {
      ...data,
      lastSyncedAt: new Date(),
    },
  });
}

export async function hasActiveListingForStockItems(stockItemIds: string[]): Promise<boolean> {
  if (stockItemIds.length === 0) return false;
  const count = await db.channelListing.count({
    where: {
      stockItemId: { in: stockItemIds },
      status: "ACTIVE",
    },
  });
  return count > 0;
}

export async function findStockItemIdsForCatalogCards(catalogCardIds: string[]): Promise<string[]> {
  if (catalogCardIds.length === 0) return [];
  const items = await db.stockItem.findMany({
    where: { catalogCardId: { in: catalogCardIds } },
    select: { id: true },
  });
  return items.map((i) => i.id);
}
