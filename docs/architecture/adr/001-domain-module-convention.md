# ADR-001: Domain module convention

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-06 |
| **First implementer** | **P-001** (Pick list from order) |

## Context

The codebase already follows an implicit structure: server actions in `src/app/*/actions.ts` validate input and call functions in `src/lib/<domain>/`, which mutate data inside `db.$transaction` and call `recordInventoryEvent`. Examples: [`src/lib/blocks/lifecycle.ts`](../../../src/lib/blocks/lifecycle.ts), [`src/lib/staging/formalize.ts`](../../../src/lib/staging/formalize.ts), [`src/lib/blocks/remove.ts`](../../../src/lib/blocks/remove.ts).

Phase 4+ adds substantial domains (pick, stock, pricing, channels, orders, POS). Without an explicit convention, new code will drift — some mutations will skip events, some will call Prisma from actions, and composability (e.g. pick inside fulfil inside outbox) will break.

## Decision

**All state-changing business logic lives in `src/lib/<domain>/`.** Server actions and route handlers are thin adapters.

### Rules

1. **One domain folder per bounded context** — e.g. `pick/`, `stock/`, `channels/`. Shared utilities (`money/`, `context/`) are not domains.
2. **Mutations run inside `db.$transaction`** unless the operation is strictly read-only.
3. **Every mutation writes an `InventoryEvent`** (or a domain-specific ledger row that also triggers an event summary) in the same transaction.
4. **Domain functions accept `tx: Prisma.TransactionClient`** when they may be composed by other domain functions. Top-level entry points open the transaction.
5. **Failures throw typed errors** (`PickError`, `StockError`, …) with user-safe messages. Actions catch and map to `{ ok: false, message }`.
6. **No direct Prisma calls from `src/app/`** except trivial reads for page rendering.
7. **Revalidation stays in actions** — domain modules do not call `revalidatePath`.

### Entry point shape (illustrative)

```typescript
// src/lib/pick/create-pick-list.ts
export async function createPickListFromOrder(
  ctx: DomainContext,
  orderId: string,
): Promise<CreatePickListResult> {
  return db.$transaction(async (tx) => {
    // ... allocate, create PickList / PickItems
    await recordInventoryEvent(tx, { eventType: ..., payload: ..., actor: ctx.actor });
    return result;
  });
}
```

## Consequences

- **Positive:** Pick, stock, and channel code compose safely; audit trail stays complete; tests target domain functions with a test database.
- **Negative:** More files than inline action logic; developers must learn the pattern.
- **Neutral:** Existing block/staging code already mostly complies; Phase 4 pick code establishes the template for new domains.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| tRPC / separate API layer | Adds framework weight; server actions suffice for this monolith |
| Domain logic in actions | Already outgrown at block/staging scale; parity multiplies domains |
| Event sourcing everywhere | `InventoryEvent` is audit, not source of truth; full ES is overkill |

## Related stories

P-001 through P-014, SKU-001 through SKU-010, PRC-003, CHN-002, FUL-001, POS-001, BUY-003.

## References

- [`src/lib/events/record.ts`](../../../src/lib/events/record.ts)
- [`src/app/blocks/actions.ts`](../../../src/app/blocks/actions.ts)
- [ARCHITECTURE.md](../ARCHITECTURE.md)
