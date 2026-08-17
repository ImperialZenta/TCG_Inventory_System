import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import {
  getChannelOfferedQty,
  isCatalogCardChaosOnly,
  isStockItemOfferable,
  listPromotableInventory,
} from "@/lib/channels/availability";
import { receiveStock, reserveStock, type StockIdentity } from "@/lib/stock";
import { createFormalizedImport } from "./helpers/fixtures";
import { createTestChannel } from "./helpers/channels";
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

describe("CHN-005 channel availability", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("offered quantity equals available minus per-channel buffer", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 3);
    const channel = await createTestChannel({
      name: "Shopify",
      type: "SHOPIFY",
      reserveBufferQty: 1,
    });

    const offered = await db.$transaction((tx) =>
      getChannelOfferedQty(tx, channel.id, received.stockItem.id),
    );
    expect(offered).toBe(2);
  });

  it("every channel is told available not on-hand when reserved", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);
    await reserveStock(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 3,
      reference: { referenceType: "order", referenceId: "hold-1" },
    });

    const channelA = await createTestChannel({ name: "A", type: "MANAPOOL", reserveBufferQty: 0 });
    const channelB = await createTestChannel({ name: "B", type: "SHOPIFY", reserveBufferQty: 0 });

    const [offeredA, offeredB] = await db.$transaction(async (tx) => [
      await getChannelOfferedQty(tx, channelA.id, received.stockItem.id),
      await getChannelOfferedQty(tx, channelB.id, received.stockItem.id),
    ]);

    expect(offeredA).toBe(2);
    expect(offeredB).toBe(2);
  });

  it("zero on-hand stock is not offerable", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    const channel = await createTestChannel({ name: "eBay", type: "EBAY" });

    await db.stockItem.update({
      where: { id: received.stockItem.id },
      data: { onHandQuantity: 0 },
    });

    const offerable = await db.$transaction((tx) =>
      isStockItemOfferable(tx, received.stockItem.id),
    );
    const offered = await db.$transaction((tx) =>
      getChannelOfferedQty(tx, channel.id, received.stockItem.id),
    );

    expect(offerable).toBe(false);
    expect(offered).toBe(0);
  });

  it("chaos-only cards are not offerable stock and appear as promotable inventory", async () => {
    await createFormalizedImport(binId, 1);
    const cardLine = await db.cardLine.findFirst();
    expect(cardLine).not.toBeNull();

    const catalogCardId = "neo-bolt-chaos-only";
    await db.cardLine.update({
      where: { id: cardLine!.id },
      data: {
        scryfallId: catalogCardId,
        name: "Lightning Bolt",
        setCode: "neo",
        collectorNumber: "0123",
      },
    });

    const chaosOnly = await db.$transaction((tx) => isCatalogCardChaosOnly(tx, catalogCardId));
    expect(chaosOnly).toBe(true);

    const promotable = await db.$transaction((tx) => listPromotableInventory(tx));
    expect(promotable.some((row) => row.catalogCardId === catalogCardId)).toBe(true);

    const stockRows = await db.stockItem.findMany({
      where: { catalogCardId, onHandQuantity: { gt: 0 } },
    });
    expect(stockRows).toHaveLength(0);
  });
});
