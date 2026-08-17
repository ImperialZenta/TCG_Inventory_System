import type { Prisma } from "@prisma/client";
import type { DomainContext } from "@/lib/context/domain-context";
import { getChannelConfig } from "@/lib/channels/config";
import { getChannelOfferedQty, isStockItemOfferable } from "@/lib/channels/availability";
import { findActiveListingsForStockItem, updateListingSyncState } from "@/lib/channels/listings";
import {
  buildOutboxIdempotencyKey,
  enqueueOutboxInTx,
} from "@/lib/channels/outbox";
import { operationForQty } from "@/lib/channels/types";
import { getStockAvailability } from "@/lib/stock/availability";

type TransactionClient = Prisma.TransactionClient;

export async function propagateAvailabilityChange(
  ctx: DomainContext,
  tx: TransactionClient,
  stockItemId: string,
  excludeChannelId?: string,
): Promise<void> {
  void ctx;
  const offerable = await isStockItemOfferable(tx, stockItemId);
  if (!offerable && excludeChannelId) {
    // still propagate zero to other channels when stock depleted
  }

  const availability = await getStockAvailability(tx, stockItemId);
  const listings = await findActiveListingsForStockItem(tx, stockItemId);

  for (const listing of listings) {
    if (listing.channelId === excludeChannelId) continue;
    if (listing.channel.syncMode === "MANUAL_CSV") continue;
    if (listing.channel.paused || !listing.channel.enabled) continue;

    const offeredQty = offerable
      ? await getChannelOfferedQty(tx, listing.channelId, stockItemId)
      : 0;
    const operation = operationForQty(offeredQty);

    const idempotencyKey = buildOutboxIdempotencyKey(
      stockItemId,
      listing.channelId,
      availability.onHand,
      availability.reserved,
      operation,
    );

    await enqueueOutboxInTx(tx, {
      channelId: listing.channelId,
      operation,
      payload: {
        stockItemId,
        quantity: offeredQty,
        externalListingId: listing.externalListingId,
        idempotencyKey,
      },
      idempotencyKey,
    });
  }
}

export async function enqueueListingForStockItem(
  ctx: DomainContext,
  tx: TransactionClient,
  channelId: string,
  stockItemId: string,
): Promise<void> {
  const config = await getChannelConfig(ctx, channelId);
  if (!config || config.channel.syncMode === "MANUAL_CSV") return;

  const offeredQty = await getChannelOfferedQty(tx, channelId, stockItemId);
  if (offeredQty <= 0) return;

  const availability = await getStockAvailability(tx, stockItemId);
  const operation = "UPSERT_LISTING" as const;
  const idempotencyKey = buildOutboxIdempotencyKey(
    stockItemId,
    channelId,
    availability.onHand,
    availability.reserved,
    operation,
  );

  await enqueueOutboxInTx(tx, {
    channelId,
    operation,
    payload: {
      stockItemId,
      quantity: offeredQty,
      idempotencyKey,
    },
    idempotencyKey,
  });
}

export async function markListingSyncedAfterOutbox(
  tx: TransactionClient,
  listingId: string,
  qty: number,
  externalListingId?: string | null,
): Promise<void> {
  await updateListingSyncState(tx, listingId, {
    lastSyncedQty: qty,
    status: qty <= 0 ? "DELISTED" : "ACTIVE",
    externalListingId: externalListingId ?? undefined,
  });
}
