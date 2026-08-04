# Product Backlog — TCG Chaos Inventory

Phase 1 focus: **Magic: The Gathering** chaos-style block inventory.

Priority key: **Must** · **Should** · **Could** · **Won't (Phase 1)**

---

## Epic 1: Block & Location Foundation

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| B-001 | Create Block with auto ID (MTG-0001), label, location | Must | Schema done |
| B-002 | Block lifecycle: OPEN, SEALED, ACTIVE, ARCHIVED, LIQUIDATED | Must | Schema done |
| B-003 | Track packed, sealed, last pick dates | Must | Schema done |
| B-004 | Location hierarchy: zone / shelf / slot | Must | Schema done |
| B-005 | Block capacity hints (target count) | Should | Schema done |
| B-006 | Block tags/tiers (bulk, trade-in, mystery, high-value) | Should | Schema done |
| B-007 | QR/barcode label generation | Should | — |
| B-008 | Block notes and photo attachment | Could | Notes in schema |
| B-009 | Audit log for block changes | Must | Schema done |

## Epic 2: MTG Catalog & Card Identity

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| C-001 | Scryfall integration (name, set, rarity, image, prices) | Must | API route stub |
| C-002 | Finishes: normal, foil, etched; languages | Must | Schema done |
| C-003 | Conditions: NM, LP, MP, HP, DMG | Must | Schema done |
| C-004 | Cache Scryfall data locally | Should | — |
| C-005 | Bulk line entry (mixed commons as single line) | Should | Schema done |
| C-006 | Set-level shortcuts | Could | — |

## Epic 3: Intake (Chaos Packing)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| I-001 | Open new block workflow | Must | Stub page |
| I-002 | Add cards via Scryfall search + qty + condition | Must | — |
| I-003 | Seal block (freeze contents) | Must | — |
| I-004 | Intake session summary | Should | — |
| I-005 | Quick-add by set code + collector number | Should | — |
| I-006 | Camera card recognition | Could | — |
| I-007 | CSV import (DelverLens, etc.) | Could | — |
| I-008 | Duplicate detection for high-value cards | Should | — |

## Epic 4: Picking & Fulfillment

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| P-001 | Pick list from order (blocks → cards) | Must | Stub page |
| P-002 | Route optimization by location | Must | — |
| P-003 | Mark picked / short / substitute | Must | Schema done |
| P-004 | Decrement inventory + update last_pick_date | Must | — |
| P-005 | Single-block pick for counter sales | Must | — |
| P-006 | Group pick list by block | Must | — |
| P-007 | TCGplayer pullsheet upload | Could | — |
| P-008 | Pick performance metrics | Could | — |

## Epic 5: Block Aging & Analytics

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| A-001 | Block age dashboard (days since pick/seal) | Must | Done |
| A-002 | Aging buckets: 0–30, 31–60, 61–90, 90+ | Must | Done |
| A-003 | Stale block list (90-day threshold) | Must | Done |
| A-004 | Block velocity (picks per period) | Must | — |
| A-005 | Capital tied up per block | Should | Partial |
| A-006 | Location heat map of stale inventory | Should | — |
| A-007 | Aging alerts (60/90/180 day) | Should | — |
| A-008 | Recommended actions on stale blocks | Should | UI hint only |
| A-009 | Value at pack vs current (market drift) | Could | — |
| A-010 | Cohort view (blocks packed same week) | Could | — |
| A-011 | Export aging report (CSV/PDF) | Should | — |

## Epic 6: Search & Inventory Browser

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| S-001 | Search by card → show block(s) | Must | Stub page |
| S-002 | Search by block ID → contents + age | Must | Done |
| S-003 | Filter: set, rarity, condition, foil, age | Should | — |
| S-004 | Global qty by card across blocks | Must | — |
| S-005 | Location map/grid | Could | — |

## Epic 7: Pricing & Valuation

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| V-001 | Market prices from Scryfall | Should | Client lib done |
| V-002 | Block total value on seal + refresh | Should | Partial |
| V-003 | Cost basis per block/batch | Could | — |
| V-004 | Chaos vs sort labor calculator | Could | — |

## Epic 8: Operations

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| O-001 | Cycle count workflow | Should | — |
| O-002 | Block transfer (new location) | Must | — |
| O-003 | Split block | Should | — |
| O-004 | Merge blocks | Could | — |
| O-005 | Full change history | Should | Schema done |
| O-006 | Role-based access | Could | — |

---

## Phase 2+ Parking Lot

- Multi-game support (Pokemon, Lorcana, FAB)
- Marketplace sync (TCGplayer, ManaPool)
- Autopricing rules engine
- Mystery box / bulk lot products
- Camera OCR intake
- COGS, margin, insurance export
- Customer-facing storefront

---

## MVP Sprint (Next)

1. **Intake workflow** — I-001 through I-003
2. **Card search** — S-001, S-004
3. **Pick list basics** — P-001, P-004, P-006
4. **Block transfer** — O-002
