# ADR-003: Money as integer cents

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-06 |
| **First implementer** | **V-005** (Persist market price through formalize) |

## Context

`CardLine.priceUsd` was a `Float` (removed in **V-005**). Floating-point arithmetic loses precision on rounding chains — exactly what **PRC-003** (multi-step rule engine), **SKU-006** (weighted-average cost), **POS-003** (split tender), and **BUY-002** (percentage offers) will perform thousands of times per day.

**V-005** shipped integer cents on `StagingCard` and `CardLine` alongside price persistence.

## Decision

**All monetary amounts are stored as signed integer cents** (`Int` in Prisma, `number` in TypeScript with the convention that it is always cents).

### Module: `src/lib/money/`

| Function | Purpose |
|----------|---------|
| `centsFromUsd(dollars: number): number` | Parse display/API dollars to cents (round half-up) |
| `usdFromCents(cents: number): number` | Format for display only — not for further math |
| `formatMoney(cents: number, currency?: string): string` | UI and CSV export |
| `applyPercent(cents: number, percent: number): number` | Integer-safe percentage |
| `roundToIncrement(cents: number, incrementCents: number): number` | PRC-003 rounding steps |

### Schema migration (at V-005)

- Add `priceCents Int?` to `StagingCard` and `CardLine` (or rename `priceUsd` → `priceCents` with migration).
- New tables (`StockItem`, `StockMovement`, price history, payments) use `*Cents` suffix exclusively.
- **Do not** perform arithmetic on `usdFromCents` results.

### Display

UI and Mana Pool CSV export convert at the boundary. Internal domain logic never sees floats for money.

## Consequences

- **Positive:** Deterministic pricing; testable rounding; no 0.1 + 0.2 bugs.
- **Negative:** One-time migration from `priceUsd`; developers must use money helpers.
- **Neutral:** Scryfall returns USD floats — convert once at ingest via `centsFromUsd`.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| `Decimal` / `@db.Decimal` | Heavier; cents sufficient for TCG price ranges |
| Keep float, round at display | Errors compound in rule chains and COGS |
| Store as string | Parsing overhead; cents integers are simpler |

## Related stories

V-005, V-002, V-003, SKU-006, PRC-003, PRC-004, PRC-006, POS-003, BUY-002, BUY-004, RPT-*.

## References

- [epic-07-pricing.md](../../backlog/epic-07-pricing.md) — V-005 schema notes
- [AUDIT-2026-08.md](../../backlog/AUDIT-2026-08.md)
