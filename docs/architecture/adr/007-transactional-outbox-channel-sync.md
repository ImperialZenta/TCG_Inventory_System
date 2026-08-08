# ADR-007: Transactional outbox for channel sync

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-06 |
| **First implementer** | **CHN-002** (Listing push to one live channel) |

## Context

When stock changes (sale, receive, reserve release), connected marketplaces must update. Calling Shopify/eBay **inside** the same request as the stock mutation creates two failure modes:

1. **DB commits, API fails** — channel shows stale quantity → oversell.
2. **API succeeds, DB rolls back** — channel shows stock you do not have.

**CHN-005** requires that stock and channel state cannot diverge after a crash. The standard fix is the **transactional outbox**.

## Decision

### Outbox table (sketch)

| Column | Purpose |
|--------|---------|
| `id` | Primary key |
| `channelId` | Target channel |
| `operation` | `UPSERT_LISTING`, `UPDATE_QTY`, `UPDATE_PRICE`, `DELIST` |
| `payload` | JSON: stockItemId, sku, qty, priceCents, idempotencyKey |
| `status` | `PENDING`, `PROCESSING`, `DONE`, `FAILED` |
| `attempts` | Retry count |
| `lastError` | Last failure message |
| `createdAt` / `processedAt` | Timing |

### Write path

Inside the **same `db.$transaction`** as the stock mutation (ADR-005):

1. Update stock / movement / reservation.
2. Insert outbox row(s) with `status: PENDING`.
3. Write `InventoryEvent` if user-facing.

Commit. HTTP response returns success to user **before** any external API call.

### Drain path

Worker (ADR-006) polls `PENDING` rows, calls the **channel adapter** (ADR-008), marks `DONE` or `FAILED` with backoff.

### Idempotency

Each outbox row carries an **`idempotencyKey`** (e.g. `stockItemId:version:operation`). Adapters send it to channels that support idempotency; replays are safe.

### Health

**CHN-009** reads outbox `FAILED` rows and staleness — no separate health store required.

## Consequences

- **Positive:** At-least-once delivery with safe retries; crash between DB and API no longer oversells.
- **Negative:** Channel updates are eventually consistent (seconds, not milliseconds) — acceptable for TCG listing use case.
- **Neutral:** CSV-only channels (CHN-006) skip outbox; manual export remains immediate.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Synchronous API in request | Crash window; slow checkout |
| Change data capture (Debezium) | Ops complexity overkill |
| Dual-write without outbox | Same crash window as sync API |

## Related stories

CHN-002, CHN-004, CHN-005, CHN-007, CHN-009, FUL-003 (status writeback).

## References

- [ADR-005](005-reservation-and-availability-engine.md)
- [ADR-006](006-background-worker-pg-boss.md)
- [ADR-008](008-provider-adapter-registry.md)
- [epic-14-channel-sync.md](../../backlog/epic-14-channel-sync.md)
