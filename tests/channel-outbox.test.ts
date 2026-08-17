import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { getChannelOfferedQty } from "@/lib/channels/availability";
import { processOutboxRow } from "@/lib/channels/sync";
import { propagateAvailabilityChange } from "@/lib/channels/oversell-guard";
import { importExternalOrder } from "@/lib/orders/import-order";
import { receiveStock, reserveStock, type StockIdentity } from "@/lib/stock";
import type { OutboxPayload } from "@/lib/channels/types";
import { createTestChannel, createTestListing } from "./helpers/channels";
import { disconnectTestDb, resetTestDb } from "./helpers/db";

const NEO_BOLT: StockIdentity = {
  scryfallId: "neo-bolt-0123",
  name: "Lightning Bolt",
  setCode: "neo",
  collectorNumber: "0123",
  finish: "NONFOIL",
  language: "en",
  condition: "NM",
};

function boltLine() {
  return {
    name: NEO_BOLT.name,
    setCode: NEO_BOLT.setCode,
    collectorNumber: NEO_BOLT.collectorNumber,
    scryfallId: NEO_BOLT.scryfallId,
    condition: NEO_BOLT.condition,
    finish: NEO_BOLT.finish,
    language: NEO_BOLT.language!,
    quantity: 1,
  };
}

describe("CHN-005 channel outbox propagation", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("sale on channel A delists B and C through processOutboxRow adapter path", async () => {
    const delistedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === "DELETE") {
          delistedUrls.push(String(url));
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ id: "unexpected" }), { status: 200 });
      }),
    );

    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    const channelA = await createTestChannel({ name: "Mana Pool A", type: "MANAPOOL" });
    const channelB = await createTestChannel({ name: "Mana Pool B", type: "MANAPOOL" });
    const channelC = await createTestChannel({ name: "Mana Pool C", type: "MANAPOOL" });

    const listingB = await createTestListing(channelB.id, received.stockItem.id, "mp-listing-b");
    const listingC = await createTestListing(channelC.id, received.stockItem.id, "mp-listing-c");
    await createTestListing(channelA.id, received.stockItem.id, "mp-listing-a");

    await importExternalOrder(
      {
        manapoolOrderId: "mp-sale-a",
        reference: "ORDER-A",
        lines: [boltLine()],
      },
      TEST_OWNER_CONTEXT,
      { channelId: channelA.id },
    );

    const offeredB = await db.$transaction((tx) =>
      getChannelOfferedQty(tx, channelB.id, received.stockItem.id),
    );
    const offeredC = await db.$transaction((tx) =>
      getChannelOfferedQty(tx, channelC.id, received.stockItem.id),
    );
    expect(offeredB).toBe(0);
    expect(offeredC).toBe(0);

    const reservation = await db.stockReservation.findFirst({
      where: { stockItemId: received.stockItem.id, status: "ACTIVE" },
    });
    expect(reservation?.quantity).toBe(1);

    const outbox = await db.channelOutbox.findMany({
      where: { operation: "DELIST" },
      orderBy: { createdAt: "asc" },
    });
    expect(outbox).toHaveLength(2);

    for (const row of outbox) {
      await processOutboxRow(TEST_OWNER_CONTEXT, row.id);
    }

    expect(delistedUrls).toEqual(
      expect.arrayContaining([
        "https://manapool.test/api/v1/seller/listings/mp-listing-b",
        "https://manapool.test/api/v1/seller/listings/mp-listing-c",
      ]),
    );

    const updatedB = await db.channelListing.findUnique({ where: { id: listingB.id } });
    const updatedC = await db.channelListing.findUnique({ where: { id: listingC.id } });
    expect(updatedB?.lastSyncedQty).toBe(0);
    expect(updatedB?.status).toBe("DELISTED");
    expect(updatedC?.lastSyncedQty).toBe(0);
    expect(updatedC?.status).toBe("DELISTED");
  });

  it("manual CSV channels are skipped by outbox propagation", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 2);
    const pushChannel = await createTestChannel({ name: "Push", type: "MANAPOOL" });
    const csvChannel = await createTestChannel({
      name: "CSV",
      type: "EBAY",
      syncMode: "MANUAL_CSV",
    });

    await createTestListing(pushChannel.id, received.stockItem.id);
    await createTestListing(csvChannel.id, received.stockItem.id);

    await importExternalOrder(
      {
        manapoolOrderId: "mp-partial-sale",
        lines: [boltLine()],
      },
      TEST_OWNER_CONTEXT,
      { channelId: pushChannel.id },
    );

    const outbox = await db.channelOutbox.findMany();
    expect(outbox.every((row) => row.channelId !== csvChannel.id)).toBe(true);
  });

  it("propagates offered quantity 2 through processOutboxRow adapter update", async () => {
    const patchBodies: Record<string, unknown>[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PATCH") {
          patchBodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
          return new Response(null, { status: 204 });
        }
        return new Response(JSON.stringify({ id: "unexpected" }), { status: 200 });
      }),
    );

    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);
    await reserveStock(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 3,
      reference: { referenceType: "order", referenceId: "hold-partial" },
    });

    const channelB = await createTestChannel({ name: "Mana Pool B", type: "MANAPOOL" });
    await createTestListing(channelB.id, received.stockItem.id, "mp-listing-qty");

    await db.$transaction((tx) =>
      propagateAvailabilityChange(TEST_OWNER_CONTEXT, tx, received.stockItem.id),
    );

    const outbox = await db.channelOutbox.findFirst({
      where: { operation: "UPDATE_QTY", channelId: channelB.id },
    });
    expect(outbox).not.toBeNull();
    expect((outbox!.payload as unknown as OutboxPayload).quantity).toBe(2);

    await processOutboxRow(TEST_OWNER_CONTEXT, outbox!.id);
    expect(patchBodies[0]).toMatchObject({ quantity: 2 });

    const listing = await db.channelListing.findFirst({
      where: { channelId: channelB.id, stockItemId: received.stockItem.id },
    });
    expect(listing?.lastSyncedQty).toBe(2);
    expect(listing?.status).toBe("ACTIVE");
  });
});
