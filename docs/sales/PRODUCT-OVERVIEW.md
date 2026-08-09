# TCG Chaos Inventory

**Forxia Industries Corp.**

Self-hosted inventory & shop operations for trading card stores
---

## One sentence

A self-hosted system for TCG shops — built for high-volume trade-in and bulk inventory (*chaos blocks*), expanding into sellable singles, marketplace sync, autopricing, counter sales, and buylist. Your data, your server, no platform commission.

---

## Two inventory modes

| | **Bulk / chaos inventory** | **Sorted sellable stock** *(roadmap)* |
|---|---|---|
| **Best for** | Trade-ins, bulk lots, unsorted piles | Singles listed and sold individually |
| **Find a card** | Block ID + position (e.g. MTG-0007 #14) | Shelf / bin / SKU |
| **Sell online as singles** | No — pick from sealed bricks | Yes — live qty syncs to channels |
| **Status** | **Available today** | **Planned (Phases 6–11)** |

Cards live in exactly one mode. Moving bulk into sellable stock is explicit and audited.

---

## Available today

**Intake & staging** — ManaBox CSV upload · staging review before commit · block breakdown · position-indexed intake · formalize to shelves/bins · undo whole import · large imports (5,000+ cards)

**Bulk inventory** — numbered blocks · shelf → bin → block locations · lifecycle (open/sealed/picked/liquidated) · move blocks · activity audit log

**MTG catalog** — Scryfall enrichment · condition, foil, language · bulk line entry

**Order picking** — Mana Pool order import · location-sorted pick lists · picked/short/substitute · hold & quarantine · counter pick · TCGplayer pullsheet · pick history

**Analytics** — block age dashboard · aging buckets · stale block list · search by block ID *(dollar values pending pricing fix)*

**Data & export** — Mana Pool listing CSV per block · JSON backup & restore · self-hosted Docker stack

---

## On the roadmap

| Phase | Delivers |
|-------|----------|
| **5 — Polish** | Card search · global qty by card · velocity reports · secure webhooks |
| **6 — Foundation** | Staff login & roles · per-SKU stock ledger · sort-to-stock · promote from bulk · reservations · cost basis |
| **7 — Games & scan** | Pokémon + more TCGs · printing picker · price overlay at review · camera scan |
| **8 — Autopricing** | Scheduled refresh · rule engine · per-channel prices · bulk reprice · price history |
| **9 — Channels** | Marketplace sync · CSV templates · live listings · oversell guard · order import |
| **10 — Counter** | POS checkout · store credit · tax & receipts · buylist offers & payout |
| **11 — Shipping** | Unified order queue · labels · tracking · returns · batch fulfilment |

**Minimum viable full shop:** Phases 6–10 (login, sellable stock, pricing, channels, counter POS).

---

## Future (not near-term)

Consignment · advanced sales/margin reporting · customer kiosk · events/tournaments · native mobile app · public API · multi-store SaaS

---

## Who it's for

| Shop type | Fit |
|-----------|-----|
| **Trade-in / bulk heavy** | Strong fit today |
| **Online singles seller** | After Phases 6–9 |
| **Full retail + counter** | After Phases 10–11 |
| **Multi-location chain** | Single shop first |

---

*Forxia Industries Corp. · TCG Chaos Inventory · August 2026*