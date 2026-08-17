import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { importExternalOrder } from "@/lib/orders/import-order";
import { receiveStock, type StockIdentity } from "@/lib/stock";
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

describe("CHN-007 order ingest reserve", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("import reserves matching stock lines", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 2);
    const channel = await createTestChannel({ name: "Mana Pool", type: "MANAPOOL" });

    const result = await importExternalOrder(
      {
        manapoolOrderId: "mp-order-100",
        reference: "REF-100",
        lines: [
          {
            name: NEO_BOLT.name,
            setCode: NEO_BOLT.setCode,
            collectorNumber: NEO_BOLT.collectorNumber,
            scryfallId: NEO_BOLT.scryfallId,
            condition: NEO_BOLT.condition,
            finish: NEO_BOLT.finish,
            language: NEO_BOLT.language!,
            quantity: 1,
          },
        ],
      },
      TEST_OWNER_CONTEXT,
      { channelId: channel.id, importSource: "fixture" },
    );

    expect(result.created).toBe(true);

    const line = await db.externalOrderLine.findFirst({
      where: { externalOrderId: result.externalOrderId },
    });
    expect(line?.stockItemId).toBe(received.stockItem.id);
    expect(line?.unmatched).toBe(false);

    const reservation = await db.stockReservation.findFirst({
      where: { stockItemId: received.stockItem.id, status: "ACTIVE" },
    });
    expect(reservation?.quantity).toBe(1);
  });

  it("re-import is idempotent", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    const channel = await createTestChannel({ name: "Mana Pool", type: "MANAPOOL" });
    const order = {
      manapoolOrderId: "mp-order-dup",
      lines: [
        {
          name: NEO_BOLT.name,
          setCode: NEO_BOLT.setCode,
          collectorNumber: NEO_BOLT.collectorNumber,
          scryfallId: NEO_BOLT.scryfallId,
          condition: NEO_BOLT.condition,
          finish: NEO_BOLT.finish,
          language: NEO_BOLT.language!,
          quantity: 1,
        },
      ],
    };

    const first = await importExternalOrder(order, TEST_OWNER_CONTEXT, { channelId: channel.id });
    const second = await importExternalOrder(order, TEST_OWNER_CONTEXT, { channelId: channel.id });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.externalOrderId).toBe(first.externalOrderId);

    const reservationCount = await db.stockReservation.count();
    expect(reservationCount).toBe(1);
  });

  it("unmatched lines are flagged without blocking import", async () => {
    const channel = await createTestChannel({ name: "Mana Pool", type: "MANAPOOL" });

    const result = await importExternalOrder(
      {
        manapoolOrderId: "mp-order-unmatched",
        lines: [
          {
            name: "Unknown Card",
            setCode: "xxx",
            condition: "NM",
            finish: "NONFOIL",
            language: "en",
            quantity: 1,
          },
        ],
      },
      TEST_OWNER_CONTEXT,
      { channelId: channel.id },
    );

    const line = await db.externalOrderLine.findFirst({
      where: { externalOrderId: result.externalOrderId },
    });
    expect(line?.unmatched).toBe(true);
    expect(line?.stockItemId).toBeNull();
  });
});
