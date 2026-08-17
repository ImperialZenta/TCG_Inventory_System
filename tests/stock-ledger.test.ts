import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import { INVENTORY_EVENT_TYPES } from "@/lib/events";
import {
  applyStockMovementInTx,
  receiveStock,
  sumMovements,
  verifyOnHandIntegrity,
  StockError,
  type StockIdentity,
} from "@/lib/stock";
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

function identityWithOverride(
  base: StockIdentity,
  override: Partial<StockIdentity>,
): StockIdentity {
  return { ...base, ...override };
}

describe("SKU-001 stock item ledger", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("creates one stock item and increments on-hand for the same identity tuple", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);

    const items = await db.stockItem.findMany();
    expect(items).toHaveLength(1);
    expect(items[0]?.onHandQuantity).toBe(2);
  });

  it("creates a separate stock item when finish differs", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    await receiveStock(
      TEST_OWNER_CONTEXT,
      identityWithOverride(NEO_BOLT, { finish: "FOIL" }),
      1,
    );

    const items = await db.stockItem.findMany();
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.finish).sort()).toEqual(["FOIL", "NONFOIL"]);
  });

  it.each([
    ["language", { language: "jp" }],
    ["condition", { condition: "LP" as const }],
    ["collector number", { collectorNumber: "0456" }],
    ["set code", { setCode: "mid" }],
    [
      "catalog card id",
      { scryfallId: "neo-bolt-9999", catalogCardId: "neo-bolt-9999" },
    ],
    ["game", { gameId: "pokemon" }],
  ])("creates a separate stock item when %s differs", async (_label, override) => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    await receiveStock(TEST_OWNER_CONTEXT, identityWithOverride(NEO_BOLT, override), 1);

    expect(await db.stockItem.count()).toBe(2);
  });

  it("writes a movement with delta, reason, actor and time on receive", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 2);

    const item = await db.stockItem.findFirstOrThrow();
    const movements = await db.stockMovement.findMany({ orderBy: { createdAt: "asc" } });

    expect(movements).toHaveLength(2);
    expect(movements[0]).toMatchObject({
      stockItemId: item.id,
      delta: 5,
      reason: "RECEIVE",
      actor: TEST_OWNER_CONTEXT.actor!.id,
    });
    expect(movements[1]?.delta).toBe(2);
    expect(movements[0]?.createdAt).toBeInstanceOf(Date);
    expect(item.onHandQuantity).toBe(7);
  });

  it("keeps on-hand equal to the sum of movements", async () => {
    const first = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);
    await db.$transaction(async (tx) => {
      await applyStockMovementInTx(tx, TEST_OWNER_CONTEXT, {
        stockItemId: first.stockItem.id,
        delta: -1,
        reason: "COUNT_ADJUST",
      });
      await applyStockMovementInTx(tx, TEST_OWNER_CONTEXT, {
        stockItemId: first.stockItem.id,
        delta: 2,
        reason: "COUNT_ADJUST",
      });
    });

    const sum = await sumMovements(first.stockItem.id);
    const item = await db.stockItem.findUniqueOrThrow({ where: { id: first.stockItem.id } });
    expect(sum).toBe(6);
    expect(item.onHandQuantity).toBe(6);
    expect(await verifyOnHandIntegrity(first.stockItem.id)).toBe(true);
  });

  it("uses compensating movements instead of rewriting history", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);
    const originalMovement = await db.stockMovement.findFirstOrThrow({
      where: { stockItemId: received.stockItem.id },
      orderBy: { createdAt: "asc" },
    });
    const originalSnapshot = {
      delta: originalMovement.delta,
      reason: originalMovement.reason,
      actor: originalMovement.actor,
      createdAt: originalMovement.createdAt.getTime(),
    };

    await db.$transaction(async (tx) => {
      await applyStockMovementInTx(tx, TEST_OWNER_CONTEXT, {
        stockItemId: received.stockItem.id,
        delta: -1,
        reason: "COUNT_ADJUST",
      });
      await applyStockMovementInTx(tx, TEST_OWNER_CONTEXT, {
        stockItemId: received.stockItem.id,
        delta: 2,
        reason: "COUNT_ADJUST",
      });
    });

    const movements = await db.stockMovement.findMany({
      where: { stockItemId: received.stockItem.id },
      orderBy: { createdAt: "asc" },
    });
    expect(movements).toHaveLength(3);
    expect(movements.map((movement) => movement.delta)).toEqual([5, -1, 2]);

    const unchanged = await db.stockMovement.findUniqueOrThrow({
      where: { id: originalMovement.id },
    });
    expect(unchanged.delta).toBe(originalSnapshot.delta);
    expect(unchanged.reason).toBe(originalSnapshot.reason);
    expect(unchanged.actor).toBe(originalSnapshot.actor);
    expect(unchanged.createdAt.getTime()).toBe(originalSnapshot.createdAt);

    const item = await db.stockItem.findUniqueOrThrow({ where: { id: received.stockItem.id } });
    expect(item.onHandQuantity).toBe(6);
  });

  it("does not expose movement update or delete helpers in the stock domain", async () => {
    const stock = await import("@/lib/stock");
    const exportNames = Object.keys(stock);
    expect(exportNames.some((name) => /delete|update|remove/i.test(name))).toBe(false);
  });

  it("rejects a movement that would make on-hand negative", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 2);

    await expect(
      db.$transaction(async (tx) => {
        await applyStockMovementInTx(tx, TEST_OWNER_CONTEXT, {
          stockItemId: received.stockItem.id,
          delta: -3,
          reason: "SALE",
        });
      }),
    ).rejects.toBeInstanceOf(StockError);

    const item = await db.stockItem.findUniqueOrThrow({ where: { id: received.stockItem.id } });
    expect(item.onHandQuantity).toBe(2);
    expect(await db.stockMovement.count()).toBe(1);
  });

  it("records a stock movement inventory event with actor", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 2);

    const event = await db.inventoryEvent.findFirst({
      where: {
        eventType: INVENTORY_EVENT_TYPES.STOCK_MOVEMENT,
        stockItemId: received.stockItem.id,
      },
    });

    expect(event?.actor).toBe(TEST_OWNER_CONTEXT.actor!.id);
    expect(event?.payload).toMatchObject({
      stockItemId: received.stockItem.id,
      delta: 2,
      reason: "RECEIVE",
      onHandAfter: 2,
    });
  });
});
