# TCG Chaos Inventory — Product Roadmap

**Forxia Industries Corp.**

Customer-facing phase plan. Technical detail and story status live in [BACKLOG.md](../BACKLOG.md).

---

## Vision

One self-hosted system that handles **bulk trade-in inventory** (chaos blocks) and **individually sellable singles** (sorted stock), with pricing, marketplace sync, counter sales, and buylist — without platform commission or vendor lock-in.

---

## Completed ✅

| Phase | What shipped |
|-------|----------------|
| **1 — Platform** | Docker stack, settings, backup/restore, Mana Pool CSV export |
| **2 — Staging intake** | ManaBox CSV → staging → review → formalize into blocks (5,000+ cards per import) |
| **3 — Block lifecycle** | Seal, guarded removal, undo formalize, activity log |
| **4 — Orders & picking** | Mana Pool order import, location-sorted pick lists, counter pick, hold/quarantine, TCGplayer pullsheet |
| **5 — Polish** | Card search (`/inventory`), global quantity by card, bulk block transfer, pick waves by shelf, webhook/cron auth |

**Available now:** bulk inventory, staging, picking, card search, block aging analytics, market price persistence and valuation, self-hosted deployment.

---

## In progress ⚠️

| Phase | Focus |
|-------|--------|
| **6 — Foundation** | Staff login & roles, per-SKU stock ledger, sort-to-stock, promote from bulk |

---

## Planned 📋

| Phase | Delivers | Unlocks |
|-------|----------|---------|
| **6 — Foundation** | Staff login & roles, per-SKU stock ledger, sort-to-stock, promote from bulk, reservations, cost basis | Auditable shop; sellable singles |
| **7 — Games & scan** | Pokémon and additional TCGs, printing picker, price overlay at review, camera scan | Multi-game shops; faster intake review |
| **8 — Autopricing** | Scheduled price refresh, rule engine, per-channel prices, bulk reprice, price history | Hands-off pricing at scale |
| **9 — Channels** | Marketplace connections, CSV templates, live sync, oversell guard, order import | Multi-channel selling without double-selling |
| **10 — Counter & buylist** | POS checkout, store credit, tax & receipts, buylist offers and payout | In-store retail and trade-in in software |
| **11 — Shipping** | Unified order queue, labels, tracking, returns, batch fulfilment | One fulfilment workflow for all channels |

**Minimum viable full shop** (shortest path to all-in-one parity): **Phases 6 through 10**.

---

## Future (not scheduled) 🔮

Consignment · advanced sales and margin reporting · customer kiosk · events/tournaments · native mobile app · public API · multi-store SaaS hosting

Revisit when Phases 6–11 are in daily use at a pilot store.

---

## Fit by shop type

| Shop | Today | After roadmap |
|------|-------|----------------|
| Trade-in / bulk heavy | **Strong fit** | Stronger with pricing + channels |
| Online singles seller | Picking + export only | Phases 6–9 |
| Full retail + counter | Picking + export only | Phases 10–11 |
| Multi-location chain | Single store | SaaS phase (future) |

---

*Forxia Industries Corp. · TCG Chaos Inventory · Roadmap · August 2026*
