# ADR-004: Append-only ledger pattern

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-06 |
| **First implementer** | **SKU-001** (Stock item ledger) |

## Context

`InventoryEvent` is append-only audit — events are never edited or deleted. Phase 6 introduces **quantities and balances** that many stories mutate: stock on-hand, reservations, store credit, consignment payouts. Allowing direct overwrites of `onHandQuantity` without a trail makes disputes unresolvable and breaks **SKU-001**'s acceptance ("on-hand is derivable from movements").

The same pattern applies beyond stock: store credit (**POS-004**), buylist payouts (**BUY-004**), and eventually consignment accruals (**CON-004**).

## Decision

**Balances change only through append-only movement rows.** The cached balance column (if any) is a performance denormalisation that must equal the sum of movements.

### Stock (`StockMovement`)

| Field | Purpose |
|-------|---------|
| `stockItemId` | Which SKU |
| `delta` | Signed integer (+receive, −sale) |
| `reason` | Enum: `RECEIVE`, `PROMOTE`, `SALE`, `RETURN`, `COUNT_ADJUST`, `TRANSFER`, `RESERVE`, `RELEASE`, `DAMAGE` |
| `referenceType` / `referenceId` | Order, pick list, promotion, etc. |
| `actor` | From DomainContext (ADR-002) |
| `createdAt` | Immutable timestamp |

`StockItem.onHandQuantity` may be maintained in the same transaction as the movement insert, but **corrections never UPDATE old movements** — they insert compensating rows.

### Relationship to `InventoryEvent`

- **Movements** = quantity/financial ledger (machine-verifiable sum).
- **InventoryEvent** = human-readable audit feed (summaries for `/activity`).

Write both in one transaction when a user-facing action occurs. Worker-only internal steps may write movements + outbox without duplicating every line to events — document exceptions in the implementing story.

### Block mode

Chaos blocks already treat position consumption as destructive (`CardLine` delete on pick). That remains valid for block mode. **ADR-004 applies to sorted stock and financial balances**, not to position-indexed chaos bricks.

## Consequences

- **Positive:** SKU-010 scale story can verify integrity; disputes trace to a row; rollback = compensating entry.
- **Negative:** More rows than a single quantity column; reports aggregate movements.
- **Neutral:** Aligns with existing audit philosophy.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Update `onHandQuantity` only | No history; fails INVEST testable acceptance |
| Full event sourcing | Overkill; movements + events is sufficient |
| Soft-delete movements | Breaks sum invariant; audit distrust |

## Related stories

SKU-001, SKU-003, SKU-004, SKU-009, POS-004, BUY-004, FUL-003, CON-004 (parked).

## References

- [epic-10-sellable-stock.md](../../backlog/epic-10-sellable-stock.md)
- [ADR-001](001-domain-module-convention.md)
- [ADR-002](002-actor-context-propagation.md)
