# Product Backlog — TCG Chaos Inventory

Phase 1 focus: **Magic: The Gathering** chaos-style block inventory.

Priority key: **Must** · **Should** · **Could** · **Won't (Phase 1)**

Status key: **Done** · **Partial** · **Schema** · **Stub** · **—**

| Status | Meaning |
|--------|---------|
| **Done** | Usable end-to-end in the app |
| **Partial** | Code exists; workflow incomplete or read-only |
| **Schema** | Database/seed only; no user workflow |
| **Stub** | Page/route placeholder only |
| **—** | Not started |

---

## Epic 0: Platform & Data

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| PL-001 | Docker + PostgreSQL 16 stack | Must | Done |
| PL-002 | JSON backup export | Must | Done |
| PL-003 | Full backup restore (wipe + reload, type `RESTORE`); nested FK fix for position-indexed backups | Must | Done |
| PL-004 | Danger zone deletes (4 tiers, type `DELETE`) | Should | Done |
| PL-005 | Mana Pool listing CSV export per block | Must | Done |
| PL-006 | Settings: shelves, bins, staging target, save feedback | Must | Done |
| PL-007 | Language mapping (Scryfall ↔ Mana Pool) | Must | Done |

---

## Epic 1: Block & Location Foundation

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| B-001 | Create Block with auto ID (MTG-0001), label, location | Must | Partial |
| B-002 | Block lifecycle: OPEN, SEALED, ACTIVE, ARCHIVED, LIQUIDATED | Must | Partial |
| B-003 | Track packed, sealed, last pick dates | Must | Done |
| B-004 | Location hierarchy: Shelf → Bin → Block; unlimited bin blocks + move/reassign | Must | Done |
| B-005 | Block capacity hints (target count) | Should | Done |
| B-006 | Block tags/tiers (bulk, trade-in, mystery, high-value) | Should | Partial |
| B-007 | QR/barcode label generation | Should | — |
| B-008 | Block notes and photo attachment | Could | Notes in schema |
| B-009 | Audit log for block changes | Must | Partial |

---

## Epic 2: MTG Catalog & Card Identity

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| C-001 | Scryfall integration (name, set, rarity, image, prices) | Must | Partial |
| C-002 | Finishes: normal, foil, etched; languages | Must | Done |
| C-003 | Conditions: NM, LP, MP, HP, DMG | Must | Done |
| C-004 | Cache Scryfall data locally | Should | — |
| C-005 | Bulk line entry (mixed commons as single line) | Should | Done |
| C-006 | Set-level shortcuts | Could | — |

---

## Epic 3: Intake (Chaos Packing)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| I-001 | Open new block workflow | Must | Stub |
| I-002 | Add cards via Scryfall search + qty + condition | Must | — |
| I-003 | Seal block (freeze contents) | Must | Done |
| I-004 | Intake session summary | Should | — |
| I-005 | Quick-add by set code + collector number | Should | — |
| I-006 | Camera card recognition | Could | — |
| I-007 | CSV import (DelverLens, etc.) | Could | — |
| I-008 | Duplicate detection for high-value cards | Should | — |
| I-009 | ManaBox CSV upload → `StagingImport` / `StagingCard` | Must | Done |
| I-010 | Block breakdown by Settings target count | Must | Done |
| I-011 | Review suggested blocks before commit | Must | Done |
| I-012 | Formalize staging → `Block` + `CardLine` (auto MTG ID, bin assign) | Must | Done |
| I-013 | Position-indexed intake (expand qty, hard-cap blocks, packing reminders) | Must | Done |
| I-014 | Live in-app sequential intake (ordered scan in-app) | Should | — |
| I-015 | Remove block by block ID (only post-formalize mutation) | Must | — |
| I-016 | Pending staging queue on `/staging` with review + delete per import | Should | Done |
| I-017 | Upload activity log + batched large CSV import (5k+ cards) | Should | Done |
| I-018 | Formalize UX: default bin for all blocks + per-block override | Should | — |

---

## Epic 4: Picking & Fulfillment

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| P-001 | Pick list from order (blocks → cards) | Must | Stub |
| P-002 | Route optimization by location | Must | Partial |
| P-003 | Mark picked / short / substitute | Must | Schema |
| P-004 | Decrement inventory + update last_pick_date | Must | — |
| P-005 | Single-block pick for counter sales | Must | — |
| P-006 | Group pick list by block | Must | — |
| P-007 | TCGplayer pullsheet upload | Could | — |
| P-008 | Pick performance metrics | Could | — |
| P-009 | Position pick list (explicit position; lowest dupe; renumber after pick) | Must | — |
| P-010 | Move picked card to history (dwell since pack / position-at-pick) | Should | — |

Mana Pool order import (Orders page) — **Stub**, planned for Phase 4.

---

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
| A-008 | Recommended actions on stale blocks | Should | Partial |
| A-009 | Value at pack vs current (market drift) | Could | — |
| A-010 | Cohort view (blocks packed same week) | Could | — |
| A-011 | Export aging report (CSV/PDF) | Should | — |

---

## Epic 6: Search & Inventory Browser

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| S-001 | Search by card → show block(s) | Must | Stub |
| S-002 | Search by block ID → contents + age | Must | Done |
| S-003 | Filter: set, rarity, condition, foil, age | Should | — |
| S-004 | Global qty by card across blocks | Must | — |
| S-005 | Location map/grid | Could | — |

---

## Epic 7: Pricing & Valuation

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| V-001 | Market prices from Scryfall | Should | Partial |
| V-002 | Block total value on seal + refresh | Should | Partial |
| V-003 | Cost basis per block/batch | Could | — |
| V-004 | Chaos vs sort labor calculator | Could | — |

---

## Epic 8: Operations

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| O-001 | Cycle count workflow | Should | — |
| O-002 | Block transfer (new location) | Must | — |
| O-003 | Split block | Should | — |
| O-004 | Merge blocks | Could | — |
| O-005 | Full change history | Should | Schema |
| O-006 | Role-based access | Could | — |

---

## Phase 2+ Parking Lot

- Multi-game support (Pokemon, Lorcana, FAB)
- Marketplace sync (TCGplayer, ManaPool API listing push)
- Autopricing rules engine
- Mystery box / bulk lot products
- Camera OCR intake
- COGS, margin, insurance export
- Customer-facing storefront

---

## Phase Roadmap

### Phase 1 — Complete

Docker, settings, shelf/bin/block model, dashboard, blocks list/detail, analytics aging, Mana Pool CSV export, backup export/restore, danger zone deletes. Staging intake delivered in Phase 2.

### Phase 2 — Complete (Staging)

**Intake path:** ManaBox CSV → position-indexed expand → hard-cap block breakdown → review → formalize (MTG IDs + bin assignment).

**Delivered:**

- **I-009 … I-013, I-016, I-017** — full CSV staging pipeline through formalize
- Upload activity log; batched DB writes (large imports validated at 5k+ cards)
- Pending staging queue (review + delete per import)
- Position 1 = front card; qty adjacency / cross-block split warnings
- Unlimited bins (**B-004**); block move/reassign from block detail

**Deferred:** **I-018** bulk bin assign at formalize (110-dropdown pain at scale).

### Phase 3 — Next (Block activation & lifecycle)

Goal: Manage blocks **after** staging formalize — seal for picking, open manually, remove safely.

| Order | ID | Story | Why now |
|-------|-----|-------|---------|
| 1 | I-003 | Seal block (freeze contents) | Done — OPEN → SEALED, Unsealed labels in UI |
| 2 | I-001 | Open new block workflow | Manual block creation outside CSV staging |
| 3 | I-015 | Remove block by block ID | Safe delete post-formalize; pairs with seal lifecycle |
| 4 | B-002 | Block lifecycle UI (Partial → Done) | Wire SEALED / ACTIVE / ARCHIVED transitions on block detail |
| 5 | B-007 | QR/barcode / team bag labels | MTG IDs exist after formalize; printable labels for physical bins |

**Optional quick win (before or parallel):** **I-018** default-bin formalize — low effort, high payoff after large imports.

**Out of scope for Phase 3:** Picking (Phase 4), position pick **P-009**, Mana Pool orders stub.

**Suggested first slice (I-003):** Block detail **Seal block** action (OPEN → SEALED, set `sealedAt`); blocks list shows SEALED status; validate non-empty block before seal.

### Phase 4 — Orders & picking

Mana Pool order import (Orders stub), **P-001**, **P-004**, **P-006**, **P-009** position pick + renumber, **P-010** pick history.

### Phase 5 — Polish

**S-001**, **S-004**, **O-002**, **A-004+**, pick waves, reconciliation.
