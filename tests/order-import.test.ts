import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { normalizeOrdersFromFixture } from "@/lib/manapool/normalize-order";
import { importExternalOrder } from "@/lib/orders/import-order";
import { TEST_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import { db } from "@/lib/db";
import { disconnectTestDb, resetTestDb } from "./helpers/db";
import { createTestExternalOrder } from "./helpers/fixtures";
import fixtureJson from "../docs/fixtures/manapool-order-sample.json";

describe("order import", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("imports an order from fixture JSON", async () => {
    const orders = normalizeOrdersFromFixture(fixtureJson);
    expect(orders).toHaveLength(1);

    const result = await importExternalOrder(orders[0]!, TEST_CONTEXT);
    expect(result.created).toBe(true);
    expect(result.lineCount).toBe(2);

    const stored = await db.externalOrder.findUnique({
      where: { id: result.externalOrderId },
      include: { lines: true },
    });
    expect(stored?.status).toBe("IMPORTED");
    expect(stored?.lines).toHaveLength(2);
  });

  it("skips duplicate manapool order id", async () => {
    const first = await createTestExternalOrder({ manapoolOrderId: "dup-001" });
    const second = await createTestExternalOrder({ manapoolOrderId: "dup-001" });

    expect(first.externalOrderId).toBe(second.externalOrderId);

    const count = await db.externalOrder.count();
    expect(count).toBe(1);
  });

  it("records order.imported event", async () => {
    await createTestExternalOrder();

    const event = await db.inventoryEvent.findFirst({
      where: { eventType: INVENTORY_EVENT_TYPES.ORDER_IMPORTED },
    });
    expect(event).not.toBeNull();
    expect(event?.summary).toContain("MANAPOOL");
  });
});
