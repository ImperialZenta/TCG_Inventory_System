import type { ChannelOutbox, Prisma } from "@prisma/client";
import type { DomainContext } from "@/lib/context/domain-context";
import { getChannelConfig } from "@/lib/channels/config";
import { getChannelOfferedQty } from "@/lib/channels/availability";
import { getChannelListingById, upsertChannelListing, updateListingSyncState } from "@/lib/channels/listings";
import { markListingSyncedAfterOutbox } from "@/lib/channels/oversell-guard";
import { getChannelAdapter } from "@/lib/channels/registry";
import type { ListingPayload, OutboxPayload } from "@/lib/channels/types";
import { db } from "@/lib/db";

export async function applyOutboxListingStateInTx(
  tx: Prisma.TransactionClient,
  input: {
    channelId: string;
    stockItemId: string;
    quantity: number;
    externalListingId?: string | null;
  },
): Promise<void> {
  const listing = await tx.channelListing.findUnique({
    where: {
      channelId_stockItemId: {
        channelId: input.channelId,
        stockItemId: input.stockItemId,
      },
    },
  });
  if (!listing) return;

  await updateListingSyncState(tx, listing.id, {
    lastSyncedQty: input.quantity,
    status: input.quantity <= 0 ? "DELISTED" : "ACTIVE",
    externalListingId: input.externalListingId ?? listing.externalListingId,
  });
}

export async function applyOutboxRowListingState(rowId: string): Promise<void> {
  const row = await db.channelOutbox.findUniqueOrThrow({ where: { id: rowId } });
  const payload = row.payload as unknown as OutboxPayload;
  await db.$transaction(async (tx) => {
    await applyOutboxListingStateInTx(tx, {
      channelId: row.channelId,
      stockItemId: payload.stockItemId,
      quantity: payload.quantity ?? 0,
      externalListingId: payload.externalListingId,
    });
    await tx.channelOutbox.update({
      where: { id: rowId },
      data: { status: "DONE", processedAt: new Date() },
    });
  });
}

function payloadFromOutbox(row: ChannelOutbox): OutboxPayload {
  return row.payload as unknown as OutboxPayload;
}

async function listingPayloadForStock(
  tx: Prisma.TransactionClient,
  channelId: string,
  stockItemId: string,
  externalListingId?: string | null,
  quantityOverride?: number,
): Promise<ListingPayload> {
  const item = await tx.stockItem.findUniqueOrThrow({ where: { id: stockItemId } });
  const quantity =
    quantityOverride ?? (await getChannelOfferedQty(tx, channelId, stockItemId));
  return {
    stockItemId,
    externalListingId,
    quantity,
    priceCents: item.marketPriceCents,
    name: item.name,
    setCode: item.setCode,
    collectorNumber: item.collectorNumber,
    condition: item.condition,
    finish: item.finish,
    language: item.language,
    imageUri: item.catalogImageUri,
  };
}

export async function processOutboxRow(
  ctx: DomainContext,
  rowId: string,
): Promise<void> {
  const fullRow = await db.channelOutbox.findUniqueOrThrow({
    where: { id: rowId },
    include: { channel: true },
  });

  const config = await getChannelConfig(ctx, fullRow.channelId);
  if (!config || config.channel.paused || !config.channel.enabled) {
    throw new Error("Channel is not active");
  }

  const adapter = getChannelAdapter(fullRow.channel.type);
  const payload = payloadFromOutbox(fullRow);
  const listing = await db.channelListing.findUnique({
    where: {
      channelId_stockItemId: {
        channelId: fullRow.channelId,
        stockItemId: payload.stockItemId,
      },
    },
  });

  const listingPayload = await db.$transaction((tx) =>
    listingPayloadForStock(
      tx,
      fullRow.channelId,
      payload.stockItemId,
      payload.externalListingId ?? listing?.externalListingId,
      payload.quantity,
    ),
  );

  switch (fullRow.operation) {
    case "UPSERT_LISTING": {
      const result = await adapter.pushListing(config.credentials, listingPayload);
      await db.$transaction(async (tx) => {
        const upserted = await upsertChannelListing(tx, {
          channelId: fullRow.channelId,
          stockItemId: payload.stockItemId,
          externalListingId: result.externalListingId,
          lastSyncedQty: listingPayload.quantity,
          status: listingPayload.quantity > 0 ? "ACTIVE" : "DELISTED",
        });
        await markListingSyncedAfterOutbox(tx, upserted.id, listingPayload.quantity, result.externalListingId);
      });
      break;
    }
    case "UPDATE_QTY": {
      await adapter.updateQty(config.credentials, listingPayload);
      if (listing) {
        await db.$transaction(async (tx) => {
          await markListingSyncedAfterOutbox(
            tx,
            listing.id,
            listingPayload.quantity,
            listing.externalListingId,
          );
        });
      }
      break;
    }
    case "UPDATE_PRICE": {
      await adapter.updatePrice(config.credentials, listingPayload);
      break;
    }
    case "DELIST": {
      await adapter.delist(config.credentials, listingPayload);
      if (listing) {
        await db.$transaction(async (tx) => {
          await updateListingSyncState(tx, listing.id, {
            lastSyncedQty: 0,
            status: "DELISTED",
          });
        });
      }
      break;
    }
  }
}

export async function syncListingQty(
  ctx: DomainContext,
  listingId: string,
): Promise<void> {
  const listing = await getChannelListingById(listingId);
  if (!listing) return;

  const config = await getChannelConfig(ctx, listing.channelId);
  if (!config || config.channel.syncMode === "MANUAL_CSV") return;

  const offeredQty = await db.$transaction((tx) =>
    getChannelOfferedQty(tx, listing.channelId, listing.stockItemId),
  );

  const adapter = getChannelAdapter(listing.channel.type);
  const listingPayload = await db.$transaction((tx) =>
    listingPayloadForStock(
      tx,
      listing.channelId,
      listing.stockItemId,
      listing.externalListingId,
      offeredQty,
    ),
  );

  if (offeredQty <= 0) {
    await adapter.delist(config.credentials, listingPayload);
    await db.$transaction(async (tx) => {
      await updateListingSyncState(tx, listing.id, { lastSyncedQty: 0, status: "DELISTED" });
    });
    return;
  }

  if (!listing.externalListingId) {
    const result = await adapter.pushListing(config.credentials, listingPayload);
    await db.$transaction(async (tx) => {
      await updateListingSyncState(tx, listing.id, {
        externalListingId: result.externalListingId,
        lastSyncedQty: offeredQty,
        status: "ACTIVE",
      });
    });
    return;
  }

  await adapter.updateQty(config.credentials, listingPayload);
  await db.$transaction(async (tx) => {
    await updateListingSyncState(tx, listing.id, { lastSyncedQty: offeredQty, status: "ACTIVE" });
  });
}
