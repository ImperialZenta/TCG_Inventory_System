# ADR-005: Reservation and availability engine

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-06 |
| **First implementer** | **SKU-003** (Reserve and release stock) |

## Context

**CHN-005** (oversell guard), **POS-001** (cart reserves), **FUL-003** (ship converts reserve to decrement), and **S-004** (available quantity) all depend on one rule:

> **Available = onHand − reserved**

If POS, channels, and fulfilment each implement their own reservation logic, double-selling is guaranteed. **B-010** (atomic pick guard) already demonstrates the right idea: re-check inside the transaction before commit. Generalise that into a single module.

## Decision

All reservation and availability changes go through **`src/lib/stock/availability.ts`** (name negotiable). No other module updates `reservedQuantity` or interprets "available".

### Operations

| Function | Effect |
|----------|--------|
| `reserve(ctx, tx, stockItemId, qty, ref)` | Increments reserved if `onHand - reserved >= qty`; else throws `InsufficientStockError` |
| `release(ctx, tx, stockItemId, qty, ref)` | Decrements reserved (clamp at 0 with audit if bug) |
| `commitSale(ctx, tx, stockItemId, qty, ref)` | Decrements both onHand and reserved; writes movement |
| `getAvailable(tx, stockItemId)` | Returns `onHand - reserved` |

### Concurrency

Inside `db.$transaction`:

1. **Lock or conditional update** the `StockItem` row (`SELECT … FOR UPDATE` or `updateMany` with `where: { id, onHandQuantity: { gte: … } }` checking available).
2. Re-read counts before write (same pattern as [`pick-guard.ts`](../../../src/lib/blocks/pick-guard.ts)).
3. Fail atomically — no partial reserve.

### Channel-facing rule

Channel adapters and CSV export call **`getAvailable`**, never `onHandQuantity`. **CHN-005** is enforced here, not in each adapter.

### Expiry

**SKU-003** acceptance requires stale reservations to expire. Implement as a worker job (ADR-006) that calls `release` with reason `EXPIRED`.

## Consequences

- **Positive:** One place to test oversell scenarios; POS and channels cannot drift.
- **Negative:** All quantity mutation paths must route through the engine — code review responsibility.
- **Neutral:** Block-mode picking (P-004) bypasses this for `CardLine` consumption; dual-model callers must choose the right path.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Optimistic locking only on StockItem | Retry storms under counter + online load |
| Reserve in channel only | Local inventory would not reflect carts |
| Pessimistic lock entire stock table | Too coarse at 100k SKUs |

## Related stories

SKU-003, S-004, CHN-005, POS-001, FUL-003, CHN-007.

## References

- [src/lib/blocks/pick-guard.ts](../../../src/lib/blocks/pick-guard.ts)
- [ADR-004](004-append-only-ledger-pattern.md)
- [epic-10-sellable-stock.md](../../backlog/epic-10-sellable-stock.md)
