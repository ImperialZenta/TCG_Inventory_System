# ADR-002: Actor context propagation

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-06 |
| **First implementer** | **P-001** threads context (actor `null`); **ACC-001** / **ACC-003** populate it |

## Context

`InventoryEvent.actor` is nullable and never written. Every parity epic after Phase 4 moves money or inventory: POS sales, buylist payouts, price overrides, stock adjustments, channel sync. **ACC-003** requires every event and movement to name who acted.

Retrofitting actor through dozens of call sites after POS and pricing ship is a large, error-prone migration. Threading context from Phase 4 onward keeps the parameter in place before auth exists.

## Decision

Introduce a **`DomainContext`** (or equivalent) passed as the first argument to domain entry points:

```typescript
interface DomainContext {
  /** Display name or user id; null until ACC-001 ships */
  actor: string | null;
  /** Optional correlation id for multi-step workflows */
  correlationId?: string;
}
```

### Rules

1. **Resolved server-side only** — actions call `getDomainContext()` from session (stub returns `{ actor: null }` until ACC-001).
2. **Never accept actor from the client** — form fields and JSON bodies must not carry actor identity.
3. **Passed into every mutation** — `recordInventoryEvent`, future `StockMovement`, outbox writes, and payment records all read `ctx.actor`.
4. **System jobs use a fixed actor** — e.g. `"system:price-refresh"` for PRC-002 worker tasks.
5. **Historical events stay null** — no backfill of actor on pre-auth data (per ACC-001 acceptance).

### Stub until ACC-001

```typescript
// src/lib/context/domain-context.ts (created at P-001)
export async function getDomainContext(): Promise<DomainContext> {
  return { actor: null };
}
```

Replace implementation when session middleware lands; domain signatures unchanged.

## Consequences

- **Positive:** ACC-003 is a stub swap, not a refactor; audit answers "who" from day one of new code.
- **Negative:** Slightly noisier function signatures.
- **Neutral:** Existing block/staging mutations can adopt context incrementally; not required to rewrite all at once.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Global AsyncLocalStorage for actor | Implicit magic; harder to test; hidden in domain tests |
| Add actor only at ACC-003 | Too late — POS/pricing/stock already shipped without it |
| Actor on events only, not movements | Stock ledger needs actor on every movement row too |

## Related stories

ACC-001, ACC-003, P-001+, SKU-001+, POS-001, BUY-004, PRC-009.

## References

- [`prisma/schema.prisma`](../../../prisma/schema.prisma) — `InventoryEvent.actor`
- [epic-20-access-platform.md](../../backlog/epic-20-access-platform.md)
- [ADR-001](001-domain-module-convention.md)
