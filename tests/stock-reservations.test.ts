import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { TEST_OWNER_CONTEXT } from "@/lib/context/domain-context";
import {
  commitSale,
  getStockAvailability,
  InsufficientStockError,
  receiveStock,
  releaseStock,
  reserveStock,
  sweepExpiredReservations,
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

const ORDER_REF = { referenceType: "order", referenceId: "order-001" };

describe("SKU-003 reserve and release stock", () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await disconnectTestDb();
  });

  it("reservation reduces available but not on-hand", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);

    await reserveStock(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 2,
      reference: ORDER_REF,
    });

    const availability = await db.$transaction((tx) =>
      getStockAvailability(tx, received.stockItem.id),
    );
    expect(availability).toEqual({ onHand: 5, reserved: 2, available: 3 });
  });

  it("fulfilment converts a reservation into a decrement", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);
    await reserveStock(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 2,
      reference: ORDER_REF,
    });

    await commitSale(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 2,
      reference: ORDER_REF,
    });

    const availability = await db.$transaction((tx) =>
      getStockAvailability(tx, received.stockItem.id),
    );
    expect(availability).toEqual({ onHand: 3, reserved: 0, available: 3 });

    const movements = await db.stockMovement.findMany({
      where: { stockItemId: received.stockItem.id },
    });
    expect(movements).toHaveLength(2);
    expect(movements[1]).toMatchObject({ delta: -2, reason: "SALE" });
  });

  it("cancelling releases the reservation", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);
    await reserveStock(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 2,
      reference: ORDER_REF,
    });

    await releaseStock(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 2,
      reference: ORDER_REF,
      releaseReason: "CANCEL",
    });

    const availability = await db.$transaction((tx) =>
      getStockAvailability(tx, received.stockItem.id),
    );
    expect(availability).toEqual({ onHand: 5, reserved: 0, available: 5 });
  });

  it("over-reserving is refused", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);
    await reserveStock(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 4,
      reference: { referenceType: "order", referenceId: "order-first" },
    });

    await expect(
      reserveStock(TEST_OWNER_CONTEXT, {
        stockItemId: received.stockItem.id,
        quantity: 2,
        reference: { referenceType: "order", referenceId: "order-second" },
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);

    const availability = await db.$transaction((tx) =>
      getStockAvailability(tx, received.stockItem.id),
    );
    expect(availability.reserved).toBe(4);
  });

  it("concurrent reservations cannot both win", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 1);

    const results = await Promise.allSettled([
      reserveStock(TEST_OWNER_CONTEXT, {
        stockItemId: received.stockItem.id,
        quantity: 1,
        reference: { referenceType: "order", referenceId: "order-a" },
      }),
      reserveStock(TEST_OWNER_CONTEXT, {
        stockItemId: received.stockItem.id,
        quantity: 1,
        reference: { referenceType: "order", referenceId: "order-b" },
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.status === "rejected" && rejected[0].reason).toBeInstanceOf(
      InsufficientStockError,
    );

    const availability = await db.$transaction((tx) =>
      getStockAvailability(tx, received.stockItem.id),
    );
    expect(availability).toEqual({ onHand: 1, reserved: 1, available: 0 });
  });

  it("stale reservations expire", async () => {
    const received = await receiveStock(TEST_OWNER_CONTEXT, NEO_BOLT, 5);
    const pastExpiry = new Date(Date.now() - 60_000);

    await reserveStock(TEST_OWNER_CONTEXT, {
      stockItemId: received.stockItem.id,
      quantity: 2,
      reference: ORDER_REF,
      expiresAt: pastExpiry,
    });

    await sweepExpiredReservations(TEST_OWNER_CONTEXT);

    const availability = await db.$transaction((tx) =>
      getStockAvailability(tx, received.stockItem.id),
    );
    expect(availability.reserved).toBe(0);

    const reservation = await db.stockReservation.findFirstOrThrow({
      where: { stockItemId: received.stockItem.id },
    });
    expect(reservation.releaseReason).toBe("EXPIRED");
    expect(reservation.status).toBe("EXPIRED");
  });
});
