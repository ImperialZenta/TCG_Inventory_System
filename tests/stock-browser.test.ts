import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import {
  adjustStockQuantity,
  countStockItems,
  getStockItemDetail,
  listStockItems,
  receiveStock,
  reserveStock,
  StockError,
  type StockIdentity,
} from "@/lib/stock";
import { disconnectTestDb, resetTestDb } from "./helpers/db";

const NEO_BOLT: StockIdentity = {
  scryfallId: "neo-bolt-browser-0123",
  name: "Lightning Bolt",
  setCode: "neo",
  collectorNumber: "0123",
  finish: "NONFOIL",
  language: "en",
  condition: "NM",
};

const NEO_FOIL: StockIdentity = {
  ...NEO_BOLT,
  scryfallId: "neo-bolt-browser-foil",
  finish: "FOIL",
};

describe("SKU-009 stock browser and adjustments", () => {
  let binId: string;

  beforeEach(async () => {
    ({ binId } = await resetTestDb());
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("includes location on browse rows when stock is assigned to a bin", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1, { binId });

    const rows = await listStockItems();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.locationLabel).toBe("TEST-A · TEST-A-B01");
  });

  it("filters by location bin with a matching result count", async () => {
    const shelfB = await db.shelf.create({
      data: { code: "TEST-B", label: "Second shelf", sortOrder: 2 },
    });
    const binB = await db.bin.create({
      data: {
        binId: "TEST-B-B01",
        shelfId: shelfB.id,
        label: "Second bin",
        sortOrder: 1,
      },
    });

    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 2, { binId });
    await receiveStock(TEST_OWNER_CONTEXT, NEO_FOIL, 1, { binId: binB.id });

    const inBinA = await listStockItems({ binId });
    expect(inBinA).toHaveLength(1);
    expect(inBinA[0]?.name).toBe("Lightning Bolt");
    expect(await countStockItems({ binId })).toBe(1);

    const inBinB = await listStockItems({ binId: binB.id });
    expect(inBinB).toHaveLength(1);
    expect(inBinB[0]?.finish).toBe("FOIL");
    expect(await countStockItems({ binId: binB.id })).toBe(1);
  });

  it("lists stock with on-hand, reserved, available, cost and price fields", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 3, {
      marketPriceCents: 199,
    });
    await db.stockItem.update({
      where: { id: received.stockItem.id },
      data: { costBasisCents: 120 },
    });
    await reserveStock(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 1,
      reference: { referenceType: "order", referenceId: "ord-1" },
    });

    const rows = await listStockItems();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: received.stockItem.id,
      name: "Lightning Bolt",
      setCode: "neo",
      finish: "NONFOIL",
      language: "en",
      condition: "NM",
      onHand: 3,
      reserved: 1,
      available: 2,
      costBasisCents: 120,
      marketPriceCents: 199,
    });
  });

  it("searches and filters with a result count", async () => {
    await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 2);
    await receiveStock(TEST_OWNER_CONTEXT, NEO_FOIL, 1);
    await receiveStock(
      TEST_OWNER_CONTEXT,
      { ...NEO_BOLT, scryfallId: "mid-bolt", setCode: "mid", condition: "LP" },
      1,
    );

    const byName = await listStockItems({ search: "lightning" });
    expect(byName).toHaveLength(3);
    expect(await countStockItems({ search: "lightning" })).toBe(3);

    const bySet = await listStockItems({ setCode: "mid" });
    expect(bySet).toHaveLength(1);
    expect(await countStockItems({ setCode: "mid" })).toBe(1);

    const byCondition = await listStockItems({ condition: "LP" });
    expect(byCondition).toHaveLength(1);

    const byGame = await listStockItems({ gameId: "mtg" });
    expect(byGame).toHaveLength(3);
  });

  it("adjusts quantity with a reason and records the acting user", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);

    const result = await adjustStockQuantity(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      targetOnHand: 4,
      reason: "DAMAGE",
    });

    expect(result.onHandAfter).toBe(4);

    const item = await db.stockItem.findUniqueOrThrow({ where: { id: received.stockItem.id } });
    expect(item.onHandQuantity).toBe(4);

    const movement = await db.stockMovement.findFirstOrThrow({
      where: { stockItemId: received.stockItem.id, reason: "DAMAGE" },
    });
    expect(movement.delta).toBe(-1);
    expect(movement.actor).toBe(TEST_OWNER_CONTEXT.actor!.id);
  });

  it("refuses an adjustment without a reason", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);

    await expect(
      adjustStockQuantity(TEST_OWNER_CONTEXT, {
        stockItemId: received.stockItem.id,
        targetOnHand: 4,
        reason: "",
      }),
    ).rejects.toThrow(StockError);

    await expect(
      adjustStockQuantity(TEST_OWNER_CONTEXT, {
        stockItemId: received.stockItem.id,
        targetOnHand: 4,
        reason: undefined,
      }),
    ).rejects.toThrow("Adjustment reason is required");
  });

  it("returns movement history newest first with delta, reason, actor, reference and time", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 2, {
      referenceType: "intake",
      referenceId: "import-42",
    });
    await adjustStockQuantity(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      targetOnHand: 1,
      reason: "COUNT_ADJUST",
    });

    const detail = await getStockItemDetail(received.stockItem.id);
    expect(detail).not.toBeNull();
    expect(detail!.movements).toHaveLength(2);
    expect(detail!.movements[0]!).toMatchObject({
      reason: "COUNT_ADJUST",
      delta: -1,
      actor: TEST_OWNER_CONTEXT.actor!.id,
      referenceType: null,
      referenceId: null,
    });
    expect(detail!.movements[0]!.createdAt).toBeInstanceOf(Date);
    expect(detail!.movements[1]!).toMatchObject({
      reason: "RECEIVE",
      delta: 2,
      referenceType: "intake",
      referenceId: "import-42",
    });
  });

  it("retains zero-quantity items and hides them from the default list", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);
    await adjustStockQuantity(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      targetOnHand: 0,
      reason: "DAMAGE",
    });

    expect(await db.stockItem.count()).toBe(1);
    expect(await listStockItems()).toHaveLength(0);
    expect(await listStockItems({ includeZeroQty: true })).toHaveLength(1);
    expect(await countStockItems({ includeZeroQty: true })).toBe(1);
  });

  it("rejects adjusting below reserved quantity", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);
    await reserveStock(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 3,
      reference: { referenceType: "order", referenceId: "ord-reserve" },
    });

    await expect(
      adjustStockQuantity(TEST_OWNER_CONTEXT, {
        stockItemId: received.stockItem.id,
        targetOnHand: 2,
        reason: "COUNT_ADJUST",
      }),
    ).rejects.toThrow(/reserved quantity/);
  });
});
