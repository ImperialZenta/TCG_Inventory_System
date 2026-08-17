import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { resolveOversellIncident, countOversellIncidents } from "@/lib/channels/incidents";
import { importExternalOrder } from "@/lib/orders/import-order";
import { receiveStock, type StockIdentity } from "@/lib/stock";
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

const CHAOS_BOLT = {
  scryfallId: "neo-bolt-chaos-0123",
  name: "Lightning Bolt",
  setCode: "neo",
  collectorNumber: "0123",
  finish: "NONFOIL" as const,
  language: "en",
  condition: "NM" as const,
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

describe("CHN-005 oversell guard", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("two channel imports of the last copy open an incident with both order refs", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    const channelA = await createTestChannel({ name: "Mana Pool", type: "MANAPOOL" });
    const channelB = await createTestChannel({ name: "Shopify", type: "SHOPIFY" });

    await importExternalOrder(
      { manapoolOrderId: "mp-first", reference: "ORDER-A", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channelA.id },
    );

    await importExternalOrder(
      { manapoolOrderId: "shop-second", reference: "ORDER-B", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channelB.id },
    );

    const incidents = await db.oversellIncident.findMany({ include: { orders: true } });
    expect(incidents).toHaveLength(1);
    expect(incidents[0]?.orders.map((o) => o.channelOrderRef).sort()).toEqual(["ORDER-A", "ORDER-B"]);

    const oversellEvent = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.OVERSELL_DETECTED },
    });
    expect(oversellEvent).not.toBeNull();

    const flaggedLine = await db.externalOrderLine.findFirst({
      where: { oversellFlag: true },
    });
    expect(flaggedLine).not.toBeNull();
  });

  it("FULFILLED_ALT reserves alternate stock", async () => {
    const sold = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    const alternate = await receiveStock(TEST_OWNER_CONTEXT, { ...NEO_BOLT, scryfallId: "neo-bolt-alt" }, 1);
    const channel = await createTestChannel({ name: "A", type: "MANAPOOL" });

    await importExternalOrder(
      { manapoolOrderId: "mp-sold", reference: "ORDER-1", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channel.id },
    );

    await importExternalOrder(
      { manapoolOrderId: "mp-oversell", reference: "ORDER-2", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channel.id },
    );

    const incident = await db.oversellIncident.findFirstOrThrow();
    await resolveOversellIncident(TEST_OWNER_CONTEXT, incident.id, "FULFILLED_ALT", {
      alternateStockItemId: alternate.stockItem.id,
      note: "Pulled NM copy from bin B",
    });

    const altReservation = await db.stockReservation.findFirst({
      where: {
        stockItemId: alternate.stockItem.id,
        referenceType: "OVERSELL_RESOLUTION",
        status: "ACTIVE",
      },
    });
    expect(altReservation?.quantity).toBe(1);
    expect(sold.stockItem.id).not.toBe(alternate.stockItem.id);

    const resolvedEvent = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.OVERSELL_RESOLVED },
    });
    expect(resolvedEvent).not.toBeNull();
  });

  it("PROMOTED moves a chaos block card into stock", async () => {
    await createFormalizedImport(binId, 1);
    const cardLine = await db.cardLine.findFirst();
    expect(cardLine).not.toBeNull();

    await db.cardLine.update({
      where: { id: cardLine!.id },
      data: {
        scryfallId: CHAOS_BOLT.scryfallId,
        name: CHAOS_BOLT.name,
        setCode: CHAOS_BOLT.setCode,
        collectorNumber: CHAOS_BOLT.collectorNumber,
        finish: CHAOS_BOLT.finish,
        language: CHAOS_BOLT.language,
        condition: CHAOS_BOLT.condition,
        quantity: 1,
      },
    });

    const sold = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    const channel = await createTestChannel({ name: "A", type: "MANAPOOL" });

    await importExternalOrder(
      { manapoolOrderId: "mp-1", reference: "ORDER-1", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channel.id },
    );
    await importExternalOrder(
      { manapoolOrderId: "mp-2", reference: "ORDER-2", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channel.id },
    );

    const incident = await db.oversellIncident.findFirstOrThrow();
    const refreshedLine = await db.cardLine.findUnique({ where: { id: cardLine!.id } });

    await resolveOversellIncident(TEST_OWNER_CONTEXT, incident.id, "PROMOTED", {
      cardLineId: refreshedLine!.id,
      note: "Promoted spare from bulk brick",
    });

    const promotedStock = await db.stockItem.findFirst({
      where: { catalogCardId: CHAOS_BOLT.scryfallId },
    });
    expect(promotedStock?.onHandQuantity).toBe(1);

    const promoteMovement = await db.stockMovement.findFirst({
      where: { stockItemId: promotedStock!.id, reason: "PROMOTE" },
    });
    expect(promoteMovement).not.toBeNull();
    void sold;

    const resolved = await db.oversellIncident.findUnique({ where: { id: incident.id } });
    expect(resolved?.status).toBe("RESOLVED");
    expect(resolved?.resolution).toBe("PROMOTED");

    const resolvedEvent = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.OVERSELL_RESOLVED },
      orderBy: { createdAt: "desc" },
    });
    expect(resolvedEvent).not.toBeNull();
  });

  it("CANCELLED_REFUND keeps the winning reservation and resolves the incident", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    const channelA = await createTestChannel({ name: "A", type: "MANAPOOL" });
    const channelB = await createTestChannel({ name: "B", type: "SHOPIFY" });

    await importExternalOrder(
      { manapoolOrderId: "mp-win", reference: "ORDER-A", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channelA.id },
    );
    await importExternalOrder(
      { manapoolOrderId: "shop-lose", reference: "ORDER-B", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channelB.id },
    );

    const incident = await db.oversellIncident.findFirstOrThrow();
    await resolveOversellIncident(TEST_OWNER_CONTEXT, incident.id, "CANCELLED_REFUND", {
      note: "Refund second buyer on Shopify",
    });

    const activeReservations = await db.stockReservation.count({ where: { status: "ACTIVE" } });
    expect(activeReservations).toBe(1);

    const resolved = await db.oversellIncident.findUnique({ where: { id: incident.id } });
    expect(resolved?.status).toBe("RESOLVED");
    expect(resolved?.resolution).toBe("CANCELLED_REFUND");

    const resolvedEvent = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.OVERSELL_RESOLVED },
    });
    expect(resolvedEvent).not.toBeNull();
  });

  it("counts incidents in the rolling 30-day window", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    const channelA = await createTestChannel({ name: "A", type: "MANAPOOL" });
    const channelB = await createTestChannel({ name: "B", type: "SHOPIFY" });

    await importExternalOrder(
      { manapoolOrderId: "mp-rate-1", reference: "R1", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channelA.id },
    );
    await importExternalOrder(
      { manapoolOrderId: "shop-rate-2", reference: "R2", lines: [boltLine()] },
      TEST_OWNER_CONTEXT,
      { channelId: channelB.id },
    );

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const count = await countOversellIncidents(thirtyDaysAgo, now);
    expect(count).toBe(1);
  });
});
