# Epic 18 — Consignment

Prefix `CON-`. Selling cards the shop does not own.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Parked.** Not scheduled into any phase.

---

## Why parked

Consignment is the one SortSwift category that is a genuine business-model decision rather than a capability gap. Building it commits the shop to holding, insuring, pricing and accounting for other people's property, and to paying out on a schedule. That is a legal and cashflow question, and no amount of software makes it the right call for a shop that has not decided to offer it.

It is also the category with the deepest dependencies. Consignment needs, at minimum: sorted stock (**SKU-001**) to hold the items, cost basis (**SKU-006**) generalised into an ownership concept, channel sync (**CHN-**) to sell them, unified orders (**FUL-**) to know when they sold, reporting (**RPT-**) to compute payouts, and access control (**ACC-**) so a consignor can see their own items and nobody else's. It is the last thing that can be built, not a thing that was skipped.

**Unparking criterion:** the shop decides to take consignment inventory commercially, and phases 6 through 11 are in production use. Until both hold, this epic stays a header.

---

## Scope sketch

Recorded so the dependency is visible in the parity matrix, not as buildable stories.

| ID | Story | Priority |
|----|-------|----------|
| CON-001 | Consignor records and agreements | Could |
| CON-002 | Owned versus consigned inventory separation | Could |
| CON-003 | Consignor submission and intake | Could |
| CON-004 | Per-consignor payout calculation | Could |
| CON-005 | Consignor portal | Could |
| CON-006 | Consignment reporting and reconciliation | Could |

### CON-001 — Consignor records and agreements
A consignor record with contact details, an agreed commission rate or split, payout terms and the agreement itself. Every consigned item traces to exactly one consignor.

### CON-002 — Owned versus consigned inventory separation
The load-bearing story. Inventory gains an ownership dimension so consigned items are excluded from the shop's own valuation, cost basis, margin and insurance figures, while still being sellable, priceable and syncable exactly like owned stock. Doing this late means revisiting every report; if this epic is ever unparked, this story comes first.

### CON-003 — Consignor submission and intake
Receiving items from a consignor, agreeing the terms per item or per batch, and entering them into stock as consigned rather than owned.

### CON-004 — Per-consignor payout calculation
When a consigned item sells, split the proceeds by the agreed rate, accrue the consignor's share, and record the payout when it is made. Needs to survive returns and refunds, which is where naive implementations break.

### CON-005 — Consignor portal
A consignor sees their own items, what has sold, at what price, and what they are owed. Requires **ACC-** with a customer-facing role that can see exactly one consignor's data.

### CON-006 — Consignment reporting and reconciliation
Statements per consignor per period, outstanding liability across all consignors, and reconciliation of accrued against paid.

---

## Related

**SKU-006** (cost basis) should be built with ownership in mind even though consignment is parked — a nullable owner reference on `StockItem` costs nothing now and saves a migration across every report later. That is the only concession this epic asks for.
