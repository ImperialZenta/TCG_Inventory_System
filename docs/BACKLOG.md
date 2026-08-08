# Product Backlog — TCG Inventory System

Index. Story detail, INVEST framing and Gherkin acceptance criteria live in the per-epic files.

| Document | Contents |
|----------|----------|
| [Architecture](architecture/ARCHITECTURE.md) | Runways, target shape, ADR index — read before cross-cutting stories |
| [Testing](TESTING.md) | Vitest, Docker test service, Agent B / spec compliance workflow |
| [Testing playbook](TESTING-PLAYBOOK.md) | When to test, golden paths, smoke log, reminders |
| [Conventions](backlog/CONVENTIONS.md) | INVEST definition of ready, Gherkin house style, status keys, ID prefix registry |
| [SortSwift parity matrix](backlog/PARITY-SORTSWIFT.md) | Gap analysis across all ten SortSwift categories, dual-model rationale, parity phasing |
| [Intake strategy](backlog/INTAKE-STRATEGY.md) | Design context for intake: scan → CSV → staging, the sort decision, recovery paths |
| [Status audit, Aug 2026](backlog/AUDIT-2026-08.md) | Status corrections found by reading the code, with evidence |

---

## Scope

**Phases 1–5** deliver chaos-block inventory for **Magic: The Gathering** — the original product, largely built.

**Phases 6–11** pursue **SortSwift parity**: a second, sorted sellable-stock inventory alongside the chaos blocks, multi-game support, autopricing, channel sync, POS, buylist and fulfilment.

The two inventory modes coexist. A physical card is in exactly one of them, and **SKU-004** is the only bridge.

| | Chaos bulk mode | Sorted stock mode |
|---|---|---|
| **Model** | `Block` + `CardLine` | `StockItem` + `StockMovement` |
| **Address** | `MTG-0007` position 14 | Shelf / bin / row |
| **Sellable individually** | No | Yes |
| **Epics** | 1–4 | 10, 13–17 |

## Keys

**Priority:** Must · Should · Could · Won't

| Status | Meaning |
|--------|---------|
| **Done** | Usable end-to-end in the app |
| **Partial** | Code exists; workflow incomplete or read-only |
| **Schema** | Database or helpers only; no user workflow |
| **Stub** | Page or route placeholder only |
| **Parked** | Specified at header level; not scheduled |
| **—** | Not started |

---

## Epic 0 — [Platform & Data](backlog/epic-00-platform.md) · `PL-`

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| PL-001 | Docker + PostgreSQL 16 stack | Must | Done |
| PL-002 | JSON backup export | Must | Done |
| PL-003 | Full backup restore | Must | Done |
| PL-004 | Danger zone deletes (4 tiers) | Should | Done |
| PL-005 | Mana Pool listing CSV export per block | Must | Done |
| PL-006 | Settings: shelves, bins, staging target | Must | Done |
| PL-007 | Language mapping (Scryfall ↔ Mana Pool) | Must | Done |
| PL-008 | Automated tests for remove and staging flows | Should | Done |

## Epic 1 — [Block & Location Foundation](backlog/epic-01-blocks.md) · `B-`

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| B-001 | Create block with auto ID, label, location | Must | Done (staging path) |
| B-002 | Block lifecycle OPEN → LIQUIDATED | Must | Done |
| B-003 | Track packed, sealed, last-pick dates | Must | Done |
| B-004 | Location hierarchy and block move | Must | Done |
| B-005 | Block capacity hints | Should | Done |
| B-006 | Block tags/tiers | Should | Schema |
| B-007 | QR/barcode team bag labels | Could | Deferred |
| B-008 | Block notes and photo attachment | Could | Partial |
| B-009 | Audit log for block changes | Must | Done |
| B-010 | Atomic pick guard on block remove | Must | Done |
| B-011 | Disable remove UI when picks exist | Should | Done |
| B-012 | Status-aware block removal | Should | Done |
| B-013 | Global inventory event log + Activity feed | Should | Done |
| B-014 | Case-insensitive remove confirmation | Could | — |
| B-015 | Persist remove success message | Could | Done |
| B-016 | Document MTG ID non-recycling | Could | — |
| B-017 | Backup reminder on remove | Should | — |
| B-018 | Empty block removal policy | Could | — |

## Epic 2 — [MTG Catalog & Card Identity](backlog/epic-02-catalog.md) · `C-`

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| C-001 | Scryfall integration | Must | Partial |
| C-002 | Finishes and languages | Must | Done |
| C-003 | Conditions NM–DMG | Must | Done |
| C-004 | Cache Scryfall data locally | Should | — |
| C-005 | Bulk line entry | Should | Done |
| C-006 | Set-level shortcuts | Could | — |

## Epic 3 — [Intake (Chaos Packing)](backlog/epic-03-intake.md) · `I-`

Read [intake strategy](backlog/INTAKE-STRATEGY.md) before implementing I-001, I-002, I-006 or I-014.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| I-001 + I-002 | Manual block creation with card add (one slice) | Should | Stub |
| I-003 | Seal block | Must | Done |
| I-004 | Intake session summary | Should | — |
| I-005 | Quick-add by set + collector number | Should | — |
| I-006 | Camera recognition in-app | Could | Superseded by SCN-002 |
| I-007 | Alternate CSV sources | Could | Partial |
| I-008 | Duplicate detection for high-value cards | Should | — |
| I-009 | ManaBox CSV upload to staging | Must | Done |
| I-010 | Block breakdown by target count | Must | Done |
| I-011 | Review suggested blocks before commit | Must | Done |
| I-012 | Formalize staging into blocks | Must | Done |
| I-013 | Position-indexed intake | Must | Done |
| I-014 | Live in-app sequential intake | Could | Superseded by SCN-002 |
| I-015 | Remove block by block ID | Must | Partial |
| I-016 | Pending staging queue | Should | Done |
| I-017 | Upload log + batched large import | Should | Done |
| I-018 | Formalize default bin + compact table | Should | Done |
| I-019 | Bulk line add on OPEN block | Should | — |
| I-020 | Bulk seal blocks | Should | Done |
| I-021 | Safe partial block removal | Should | — |
| I-022 | Staging review assignment state | Must | Done |
| I-023 | Undo formalize import | Must | Done |
| I-024 | Staging list status badges | Should | Done |
| I-025 | Upload without auto-redirect | Should | Done |

## Epic 4 — [Picking & Fulfillment](backlog/epic-04-picking.md) · `P-`

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| P-001 | Pick list from order | Must | Done |
| P-002 | Route optimization by location | Must | Done |
| P-003 | Mark picked / short / substitute | Must | Done |
| P-004 | Decrement inventory on pick | Must | Done |
| P-005 | Single-block pick for counter sales | Must | Done |
| P-006 | Group pick list by block | Must | Done |
| P-007 | TCGplayer pullsheet upload | Could | Done |
| P-008 | Pick performance metrics | Could | Done |
| P-009 | Position pick list with renumber | Must | Done |
| P-010 | Move picked card to history | Should | Done |
| P-011 | Quarantine block for repair | Must | Done |
| P-012 | Hold pick list | Must | Done |
| P-013 | Correction re-scan intake | Should | Done |
| P-014 | Re-allocate held pick lines | Must | Done |

## Epic 5 — [Block Aging & Analytics](backlog/epic-05-aging.md) · `A-`

Every currency figure in this epic reads zero until **V-005** ships.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| A-001 | Block age dashboard | Must | Done |
| A-002 | Aging buckets | Must | Done |
| A-003 | Stale block list | Must | Done |
| A-004 | Block velocity | Must | — |
| A-005 | Capital tied up per block | Should | — |
| A-006 | Location heat map | Should | — |
| A-007 | Aging alerts | Should | — |
| A-008 | Recommended actions | Should | Partial |
| A-009 | Value at pack vs current | Could | — |
| A-010 | Cohort view | Could | — |
| A-011 | Export aging report | Should | — |

## Epic 6 — [Search & Inventory Browser](backlog/epic-06-search.md) · `S-`

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| S-001 | Search by card, show blocks | Must | Stub |
| S-002 | Search by block ID | Must | Done |
| S-003 | Filter by set, rarity, condition, foil, age | Should | — |
| S-004 | Global quantity by card | Must | — |
| S-005 | Location map or grid | Could | — |

## Epic 7 — [Pricing & Valuation](backlog/epic-07-pricing.md) · `V-`

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| **V-005** | **Persist market price through formalize** | **Must** | **— defect** |
| V-001 | Market prices from Scryfall | Should | Partial |
| V-002 | Block total value on seal and refresh | Should | — |
| V-003 | Cost basis per block or batch | Could | — |
| V-004 | Chaos vs sort labor calculator | Could | — |

## Epic 8 — [Operations](backlog/epic-08-operations.md) · `O-`

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| O-001 | Cycle count workflow | Should | — |
| O-002 | Block transfer to a new location | Must | Partial |
| O-003 | Split block | Should | — |
| O-004 | Merge blocks | Could | — |
| O-005 | Full change history | — | Retired → B-013 |
| O-006 | Role-based access | — | Retired → ACC-002 |

## Epic 9 — [I-015 QA Hardening](backlog/epic-09-qa-hardening.md)

A programme, not a prefix. Indexes 15 stories that live in Epics 0, 1 and 3. 10 shipped, 5 open.

---

# SortSwift parity — Phases 6 to 11

See the [parity matrix](backlog/PARITY-SORTSWIFT.md) for the full gap analysis.

## Epic 10 — [Sellable Stock Inventory](backlog/epic-10-sellable-stock.md) · `SKU-` · Phase 6

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| SKU-001 | Stock item ledger with on-hand quantity | Must | — |
| SKU-002 | Sort staged cards to stock instead of a block | Must | — |
| SKU-003 | Reserve and release stock | Must | — |
| SKU-004 | Promote cards from a chaos block to stock | Must | — |
| SKU-005 | Stock locations and transfers | Should | — |
| SKU-006 | Cost basis and margin on stock | Must | — |
| SKU-007 | Internal SKU and barcode | Should | — |
| SKU-008 | Sealed product and custom SKUs | Should | — |
| SKU-009 | Stock browser and adjustments | Must | — |
| SKU-010 | Scale to 100,000 stock items | Should | — |

## Epic 11 — [Multi-Game Catalog](backlog/epic-11-multi-game.md) · `GAM-` · Phase 7

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| GAM-001 | Game registry with per-game ID sequences | Must | — |
| GAM-002 | Catalog provider interface with local cache | Must | — |
| GAM-003 | Pokémon support including Japanese printings | Must | — |
| GAM-004 | Add a further game without changing intake | Should | — |
| GAM-005 | New set refresh | Should | — |
| GAM-006 | Per-game condition and finish vocabularies | Should | — |

## Epic 12 — [Scan Intake Parity](backlog/epic-12-scan-intake.md) · `SCN-` · Phase 7

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| SCN-001 | Alternate printing picker on staged rows | Must | — |
| SCN-002 | Camera capture and recognition | Should | — |
| SCN-003 | Foil, language and anomaly flagging | Must | — |
| SCN-004 | Price overlay during review | Must | — |
| SCN-005 | Sequential in-app intake with positions | Could | — |
| SCN-006 | Card images on intake | Should | — |

## Epic 13 — [Autopricing & Market Data](backlog/epic-13-autopricing.md) · `PRC-` · Phase 8

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| PRC-001 | Multiple market price sources | Should | — |
| PRC-002 | Scheduled market price refresh | Must | — |
| PRC-003 | Rule engine with ordered steps | Must | — |
| PRC-004 | Cost-aware floors and margin rules | Must | — |
| PRC-005 | Price history | Must | — |
| PRC-006 | Per-channel pricing configuration | Must | — |
| PRC-007 | Bulk reprice | Must | — |
| PRC-008 | Rule tester and price explanation | Must | — |
| PRC-009 | Manual price override with protection | Should | — |

## Epic 14 — [Channel Sync & Marketplaces](backlog/epic-14-channel-sync.md) · `CHN-` · Phase 9

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| CHN-001 | Channel registry and configuration | Must | — |
| CHN-002 | Listing push to one live channel | Must | — |
| CHN-003 | Per-channel listing selection | Should | — |
| CHN-004 | Quantity reconciliation both directions | Must | — |
| CHN-005 | Oversell guard | Must | — |
| CHN-006 | Marketplace CSV export templates | Must | — |
| CHN-007 | Order ingestion from channels | Must | — |
| CHN-008 | Additional channels | Should | — |
| CHN-009 | Sync health and failure recovery | Must | — |

## Epic 15 — [Point of Sale & In-Store](backlog/epic-15-pos.md) · `POS-` · Phase 10

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| POS-001 | Cart and checkout against live stock | Must | — |
| POS-002 | Barcode and card scan to cart | Must | — |
| POS-003 | Split tender and payment recording | Must | — |
| POS-004 | Store credit issuance and redemption | Must | — |
| POS-005 | Multiple concurrent carts | Should | — |
| POS-006 | Tax handling and exemptions | Must | — |
| POS-007 | Receipts | Should | — |
| POS-008 | Custom and non-catalog line items | Should | — |
| POS-009 | Returns and refunds at the counter | Must | — |
| POS-010 | Till reconciliation and day close | Should | — |
| POS-011 | Self-service customer kiosk | Could | Parked |
| POS-012 | Event and tournament support | Could | Parked |

## Epic 16 — [Buylist](backlog/epic-16-buylist.md) · `BUY-` · Phase 10

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| BUY-001 | Customer submission portal | Should | — |
| BUY-002 | Rule-based offer calculation | Must | — |
| BUY-003 | Counter intake: review, grade, approve | Must | — |
| BUY-004 | Payout in cash or store credit | Must | — |
| BUY-005 | Approved buylist auto-enters inventory | Must | — |
| BUY-006 | Published buylist with wanted quantities | Should | — |
| BUY-007 | Submission notifications | Should | — |
| BUY-008 | Buylist reporting | Should | — |
| BUY-009 | Multi-language customer surface | Could | Parked |

## Epic 17 — [Orders, Shipping & Fulfillment](backlog/epic-17-fulfillment.md) · `FUL-` · Phase 11

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| FUL-001 | Unified order queue | Must | — |
| FUL-002 | Mana Pool order import | Must | Done |
| FUL-003 | Fulfilment and stock deduction | Must | — |
| FUL-004 | Shipping label purchase and printing | Must | — |
| FUL-005 | Tracking and status writeback | Must | — |
| FUL-006 | Returns handling | Must | — |
| FUL-007 | Packing slips and picklist integration | Should | — |
| FUL-008 | Multi-order batch fulfilment | Should | — |
| FUL-009 | Shipping cost and carrier reporting | Could | Parked |
| FUL-010 | Prepaid shipping wallet | Could | Parked |

## Epic 18 — [Consignment](backlog/epic-18-consignment.md) · `CON-` · Parked

Six stories at header level. Unparks when the shop commits to consignment commercially and phases 6–11 are in use.

## Epic 19 — [Reporting & Analytics](backlog/epic-19-reporting.md) · `RPT-` · Mostly parked

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| RPT-005 | CSV export for any report | Should | — |
| RPT-001 – RPT-004, RPT-006 – RPT-008 | Sales, valuation, margin, channel, SKU aging, scheduled delivery, dashboard | Should/Could | Parked |

## Epic 20 — [Access Control & Platform Parity](backlog/epic-20-access-platform.md) · `ACC-` · Phase 6

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| ACC-001 | User accounts and authentication | Must | — |
| ACC-002 | Roles and permissions | Must | — |
| ACC-003 | Actor on every event and movement | Must | — |
| ACC-004 | Session management and device sign-out | Should | — |
| ACC-005 | Feature modules | Could | Parked |
| ACC-006 | External inventory API | Could | Parked |
| ACC-007 | Native mobile app | Could | Parked |

---

# Phase roadmap

## Phase 1 — Complete

Docker, settings, shelf/bin/block model, dashboard, blocks list and detail, aging analytics, Mana Pool CSV export, backup export and restore, danger zone deletes.

## Phase 2 — Complete (Staging)

Scan at the counter → staff validate condition and authenticity → export CSV → **Staging** → position-indexed expand → hard-cap breakdown → review → formalize with MTG IDs and bin assignment.

Delivered: **I-009**–**I-013**, **I-016**, **I-017**, **I-018**. Validated at 5,000+ cards per import.

## Phase 3 — Complete (Block lifecycle)

| ID | Story | Outcome |
|----|-------|---------|
| I-003 | Seal block | Done |
| I-015 | Remove block by block ID | Partial — see **I-021** |
| B-002 | Block lifecycle UI | Done |
| I-018 | Default bin at formalize | Done |

Deferred: **B-007** labels, **I-001** + **I-002** manual creation.

## Phase 3a — Complete (QA hardening)

**I-022**, **I-023**, **I-024**, **I-025**, **B-010**–**B-013**, **B-015**, **PL-008** all Done. Open: **I-021**, **B-014**, **B-016**, **B-017**, **B-018**. See [Epic 9](backlog/epic-09-qa-hardening.md).

## Phase 3b — Exception intake (deferred)

**I-001** + **I-002** as one slice, then **I-019**, then **I-005**. Build only when a concrete non-CSV need appears.

## Phase 4 — Orders & picking

**Status:** Complete — Mana Pool import (API, fixture, webhook, cron), pick lists, location sort, pick/short/substitute/renumber, `PickHistory`, counter pick, TCGplayer pullsheet, pick metrics, quarantine/hold/re-allocate, correction intake.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| P-001 | Pick list from order | Must | Done |
| P-002 | Route optimization by location | Must | Done |
| P-003 | Mark picked / short / substitute | Must | Done |
| P-004 | Decrement inventory on pick | Must | Done |
| P-005 | Single-block pick for counter sales | Must | Done |
| P-006 | Group pick list by block | Must | Done |
| P-007 | TCGplayer pullsheet upload | Could | Done |
| P-008 | Pick performance metrics | Could | Done |
| P-009 | Position pick list with renumber | Must | Done |
| P-010 | Move picked card to history | Should | Done |
| P-011 | Quarantine block for repair | Must | Done |
| P-012 | Hold pick list | Must | Done |
| P-013 | Correction re-scan intake | Should | Done |
| P-014 | Re-allocate held pick lines | Must | Done |

## Phase 5 — Polish

**S-001**, **S-004**, **O-002** bulk transfer, **A-004** onward, pick waves, reconciliation.

---

## Phase 6 — Identity and sellable stock

Nothing later is auditable without an actor, and nothing is sellable or priceable without a persisted price and a real quantity.

| Order | Stories | Why |
|-------|---------|-----|
| 1 | **ACC-001**, **ACC-002**, **ACC-003** | Every parity feature moves money; unattributed history cannot be retrofitted |
| 2 | **V-005** | Prices are currently discarded at formalize — every value figure reads zero |
| 3 | **SKU-001**, **SKU-003**, **SKU-009** | The stock ledger, reservations, and a way to inspect them |
| 4 | **SKU-002**, **SKU-004**, **SKU-006** | The sort decision, the promote bridge, and cost basis |

## Phase 7 — Multi-game and scan parity

**GAM-001** → **GAM-002** → **GAM-003**, then **SCN-001**, **SCN-004**, **SCN-003**, **SCN-006**. **SCN-002** camera capture last, since **SCN-001** delivers most of the value at a fraction of the cost.

## Phase 8 — Autopricing

**PRC-002** → **PRC-003** → **PRC-004** → **PRC-005** → **PRC-008**, then **PRC-007** and **PRC-009**. **PRC-006** waits for **CHN-001**.

## Phase 9 — Channel sync

**CHN-001** → **CHN-006** CSV templates → **CHN-002** one live channel → **CHN-005** oversell guard → **CHN-007** order ingestion → **CHN-004** reconciliation → **CHN-009** health. **CHN-008** proves the adapter model.

CSV templates come before any API: they cover every marketplace immediately at low risk and keep working when an API breaks.

## Phase 10 — Counter and buylist

**POS-001** → **POS-002** → **POS-004** → **POS-003** → **POS-006** → **POS-009**, then **BUY-002** → **BUY-003** → **BUY-004** → **BUY-005**. Customer-facing buylist (**BUY-001**) after the internal offer engine is trusted.

## Phase 11 — Unified fulfilment

Requires Phase 4 picking. **FUL-001** → **FUL-003** → **FUL-002** → **FUL-005** → **FUL-004** → **FUL-006**.

## Parked

Consignment (**CON-**), advanced reporting (**RPT-001**–**RPT-004**, **RPT-006**–**RPT-008**), kiosk (**POS-011**), events (**POS-012**), hardware sorters, external API (**ACC-006**), native mobile (**ACC-007**).

---

## Minimum viable parity

SortSwift's own framing of the shortest credible path is chaos scanning, condition and location-aware inventory, multi-channel sync, rule-based autopricing, basic POS, and CSV tools. Against this codebase that is **phases 6 through 10**. Buylist, unified orders, kiosk and advanced reporting close the remaining distance.
