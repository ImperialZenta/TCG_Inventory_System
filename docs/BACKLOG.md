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

## Intake strategy (design context)

**Read this first** when picking up intake or block-creation work. Captures product decisions from trade-in workflow review (Aug 2026).

### Primary path: scan → CSV → staging (Done)

For store trade-ins and bulk chaos packing, **scan-first intake is the preferred workflow** — not manual card lookup in-app.

| Step | Who | Tool |
|------|-----|------|
| Identify card + printing | Scanner app | **ManaBox**, **Delver Lens**, or **TCGplayer** mobile / Scan & Identify |
| Validate condition, catch proxies/counterfeits, adjust wrong matches | **Human staff** | Visual inspection + condition tap at counter |
| Export identified list | Scanner app | CSV with Scryfall ID (ManaBox native; Delver Lens via export/converters) |
| Load into chaos system | This app | **Staging** → review breakdown → formalize → blocks |

Industry shop/inventory tools (TCGplayer Scan & Identify, SortSwift, TCG Sync, etc.) optimize for **camera/batch scan → human QC → inventory**, not typing card names from a catalog of tens of thousands of printings. Manual Scryfall search per card does not scale for trade-in volume.

**This app’s staging pipeline (I-009–I-013) is the correct primary intake path.** `/intake` redirects to `/staging` by design.

### Human role at trade-in

Staff are **required** in the middle — but for **validation**, not identification from scratch:

- Set/adjust condition (NM/LP/MP/HP/DMG)
- Reject or flag proxies and counterfeits (scanners cannot detect these)
- Correct misidentified printings when the scanner offers candidates
- Accept/counter the trade and assign store credit

Do **not** plan trade-in throughput around staff manually searching Scryfall for every card.

### Recovering from a bad scan (formalized too early)

When staff distrust the **scan/CSV** (not just one physical brick), the recovery path is **import-level**, not single-block remove:

| Situation | Preferred action | Story |
|-----------|------------------|-------|
| Still in staging (`PARSED`) — not formalized yet | Delete staging import; fix scan; re-upload CSV | **I-016** (Done) |
| Formalized (`ASSIGNED`) — question entire scan | **Undo formalize** (**I-023**) — one click removes all blocks + deletes import; re-upload export file | **I-023** (Done) |
| Formalized — scan trusted, one physical brick wrong | Single-block remove or move; optional partial repair | **I-015**, **I-021** (Should) |
| At pick — wrong card at position | Quarantine block, hold list, re-allocate; **not** undo import | **P-011–P-014** (Phase 4) |

**Do not** require staff to remove blocks one-by-one (or use Settings “clear inventory”) to redo a trade-in batch. Industry pattern (TCGplayer Scan & Identify batches): fix or discard the **working batch** before it is committed — formalize is the commit point.

Today (until ~~**I-023**~~): ~~undo formalize = remove every block individually, then delete staging (**I-016**).~~ **Done** — **Undo formalize** on formalized staging review.

### Exception path: manual block + card add (Deferred)

**I-001** (create OPEN block) and **I-002** (add cards via Scryfall) are **one bundled slice**, not separate deliverables. An empty OPEN block alone is a dead end (cannot seal, cannot export for Mana Pool, cannot pick).

Ship together only when a concrete **non-CSV** use case justifies the build:

- Small ad-hoc batch (no scanner handy)
- Single overflow brick after a CSV formalize
- Bulk-only brick via **C-005** bulk line (no per-card lookup)
- Post-formalize correction / repair (prefer **I-005** set+collector quick-add or staging row fix first)

**Not** the trade-in counter workflow. Priority lowered to **Should**; deferred past Phase 3 core lifecycle work.

### Scryfall in this codebase today

| Capability | Status | Used for |
|------------|--------|----------|
| Search + set/collector lookup (`lib/scryfall.ts`) | Partial (**C-001**) | ManaBox CSV enrichment, `/api/cards/search` |
| In-app card selection UI on block detail | — (**I-002**) | Not built; exception/repair only when built |
| Local Scryfall cache | — (**C-004**) | Not built |

### Intake story priority summary

| Tier | Stories | When |
|------|---------|------|
| **Primary (Done)** | I-009–I-013, I-016, I-017 | ManaBox CSV through formalize |
| **Primary polish** | I-018, I-024 ✓, I-025 ✓ | Default bin at formalize; list badges; manual upload→review navigation |
| **Post-formalize lifecycle** | I-003 ✓, I-015 Partial, B-002 ✓, B-007 | Phase 3 |
| **I-015 hardening (QA)** | PL-008 ✓; I-021 Should; B-012–B-018; B-010 ✓, B-011 ✓; I-022 ✓, I-023 ✓ | Phase 3a |
| **Exception intake (bundle)** | I-001 + I-002 (+ optional I-005, bulk line UI) | Phase 3b — defer until needed |
| **Future scan-in-app** | I-014, I-006 | Only if bringing scanner into app; large build; CSV bridge sufficient for now |

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
| PL-008 | Automated tests for block remove and staging redo flows | Should | Done — Vitest integration tests (undo, remove, re-formalize, lifecycle, pick guard) |

---

## Epic 1: Block & Location Foundation

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| B-001 | Create Block with auto ID (MTG-0001), label, location | Must | Partial — via staging formalize; manual create is **I-001** (exception path) |
| B-002 | Block lifecycle: OPEN, SEALED, ACTIVE, ARCHIVED, LIQUIDATED | Must | Done — seal (I-003) + activate/archive/liquidate on block detail |
| B-003 | Track packed, sealed, last pick dates | Must | Done |
| B-004 | Location hierarchy: Shelf → Bin → Block; unlimited bin blocks + move/reassign | Must | Done |
| B-005 | Block capacity hints (target count) | Should | Done |
| B-006 | Block tags/tiers (bulk, trade-in, mystery, high-value) | Should | Partial |
| B-007 | QR/barcode label generation | Should | — |
| B-008 | Block notes and photo attachment | Could | Notes in schema |
| B-009 | Audit log for block changes | Must | Partial — per-block recent activity only; see **B-013** for global removal history |
| B-010 | Atomic pick guard on block remove (no check-then-act race) | Must | Done |
| B-011 | Disable remove UI when block has pick history | Should | Done |
| B-012 | Status-aware block removal (OPEN/SEALED vs ACTIVE+) | Should | — — QA finding #6 |
| B-013 | Global audit feed for block removals and lifecycle events | Should | — — QA finding #5; extends **B-009** |
| B-014 | Case-insensitive block ID remove confirmation | Could | — — QA finding #8 |
| B-015 | Persist remove success message before redirect | Could | Done — server redirect + destination flash (no 404) |
| B-016 | Document MTG ID non-recycling after block remove | Could | — — QA finding #10; ops/docs, not code unless UI hint added |
| B-017 | Backup reminder on block remove danger zone | Should | — — QA finding #11 |
| B-018 | Empty block removal policy (allow with warning, or block) | Could | — — QA finding #12 |

---

## Epic 2: MTG Catalog & Card Identity

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| C-001 | Scryfall integration (name, set, rarity, image, prices) | Must | Partial — CSV enrichment + API route; no in-app picker UI (**I-002**) |
| C-002 | Finishes: normal, foil, etched; languages | Must | Done |
| C-003 | Conditions: NM, LP, MP, HP, DMG | Must | Done |
| C-004 | Cache Scryfall data locally | Should | — |
| C-005 | Bulk line entry (mixed commons as single line) | Should | Done |
| C-006 | Set-level shortcuts | Could | — |

---

## Epic 3: Intake (Chaos Packing)

See **Intake strategy (design context)** above before implementing I-001, I-002, I-006, or I-014.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| I-001 | Manual OPEN block: create empty block (MTG ID, label, bin, target count) **outside CSV staging** | Should | Stub — **bundle with I-002**; not trade-in primary path |
| I-002 | Add cards to OPEN block via Scryfall search + qty + condition + position | Should | — — **bundle with I-001**; exception/repair tooling, not trade-in throughput |
| I-003 | Seal block (freeze contents) | Must | Done |
| I-004 | Intake session summary | Should | — |
| I-005 | Quick-add by set code + collector number (OPEN blocks; uses existing Scryfall lookup) | Should | — — lighter than I-002; good for one-off corrections |
| I-006 | Camera card recognition (in-app) | Could | — — defer; use ManaBox/Delver Lens → CSV; see I-014 |
| I-007 | Alternate CSV sources (Delver Lens export, etc.) | Could | Partial — any CSV with Scryfall ID/name+set works via staging; no Delver-native upload |
| I-008 | Duplicate detection for high-value cards | Should | — |
| I-009 | ManaBox CSV upload → `StagingImport` / `StagingCard` | Must | Done — **primary trade-in intake path** |
| I-010 | Block breakdown by Settings target count | Must | Done |
| I-011 | Review suggested blocks before commit | Must | Done |
| I-012 | Formalize staging → `Block` + `CardLine` (auto MTG ID, bin assign) | Must | Done |
| I-013 | Position-indexed intake (expand qty, hard-cap blocks, packing reminders) | Must | Done |
| I-014 | Live in-app sequential intake (camera scan + ordered positions in-app) | Could | — — large build; CSV bridge sufficient until proven need |
| I-015 | Remove block by block ID (only post-formalize mutation) | Must | Partial — per-block delete; whole-import scan redo → **I-023** Done |
| I-016 | Pending staging queue on `/staging` with review + delete per import | Should | Done |
| I-017 | Upload activity log + batched large CSV import (5k+ cards) | Should | Done |
| I-018 | Formalize UX: default bin for all blocks + per-block override; compact table for large imports | Should | Done |
| I-019 | Bulk line add on OPEN block (`isBulkLine`; no per-card Scryfall lookup) | Should | — — exception path for mixed commons / bulk bricks |
| I-020 | Bulk seal blocks (by staging import or by bin) | Should | Done |
| I-021 | Safe partial block removal from multi-block imports (no orphaned staging cards) | Should | — — one trusted scan, one bad brick; scan distrust → **I-023** |
| I-022 | Staging review reflects formalize assignment state (assigned vs unassigned cards) | Must | Done |
| I-023 | Undo formalize import (remove all blocks for import; delete staging — discard-only v1) | Must | Done |
| I-024 | Staging list status badges (pending vs formalized; undo availability on list) | Should | Done |
| I-025 | Upload success: no auto-redirect to review (manual Continue to review) | Should | Done |

### I-024 — Staging list status badges (INVEST)

| | |
|---|---|
| **As a** | staff member on the Staging page |
| **I want** | each pending and formalized import to show clear status badges before I open it |
| **So that** | I know what needs formalize, which imports are committed, and whether undo formalize is still available |

**Acceptance**

- **Pending staging** (`PARSED`): badge **Awaiting formalize**; helper text that import is not in inventory yet.
- **Formalized imports** (`ASSIGNED`): badge **Formalized**; block count and MTG ID summary on the row.
- When all linked blocks are **OPEN** and undo-eligible: badge **Undo available**.
- When undo is blocked (sealed blocks, pick history, etc.): badge **Undo blocked** with short reason from undo summary.
- **Formalized imports** section expanded by default when it has rows (no hidden collapsed list).

**Related:** **I-016** (queue), **I-023** (undo formalize), **I-022** (detail-page assignment visibility — separate).

### I-025 — Upload wizard: manual review navigation (INVEST)

| | |
|---|---|
| **As a** | staff member uploading a ManaBox CSV |
| **I want** | to stay on the Staging page after breakdown until I click Continue to review |
| **So that** | I can read the activity log and confirm counts before the next wizard step (same as formalize — no timed redirect) |

**Acceptance**

- After successful upload, page does **not** auto-navigate to `/staging/[importId]`.
- Success banner shows breakdown summary; **Continue to review →** is the only navigation to review.
- Pending staging list refreshes so the new import appears without leaving the page.
- Copy matches formalize flow tone (stay until ready; explicit next step).

**Related:** **I-017** (upload log + batched import), formalize stay-on-page (no post-formalize redirect to Blocks).

### I-022 — Assignment visibility on formalized review (INVEST)

| | |
|---|---|
| **As a** | staff member reviewing a formalized staging import |
| **I want** | to see which cards are in MTG blocks vs unassigned on the review page |
| **So that** | I trust counts after formalize, undo, or partial block remove |

**Acceptance (shipped)**

- Formalized review shows per-MTG-block **in inventory** vs **CardLine** counts with links to block detail.
- Unassigned staging cards grouped by suggested block with orphan warning when count &gt; 0.
- Stats grid shows **Formalized**, in-inventory totals, and unassigned subtext.
- Totals reconcile: assigned + unassigned = import total; CardLine sum matches assigned staging units.
- Re-formalize workflow deferred to **I-021**.

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
| P-011 | Quarantine block for repair (take offline from new picks) | Must | — — Phase 4 extension |
| P-012 | Hold pick list when block quarantined or pick interrupted | Must | — — Phase 4 extension |
| P-013 | Correction re-scan intake (cards pulled from chaos during pick) | Should | — — Phase 4 extension |
| P-014 | Re-allocate held pick lines to alternate blocks | Must | — — Phase 4 extension |

Mana Pool order import (Orders page) — **Stub**, planned for Phase 4.

See **Epic 4 extension: pick integrity & block repair** below for **P-011–P-014** user stories and acceptance.

---

### Epic 4 extension: pick integrity & block repair

**Design context (Aug 2026).** Pick-time errors are **not** scan-import errors. Do **not** use **I-023** undo formalize when sealed blocks are on pick lists.

| Layer | When | Tool |
|-------|------|------|
| **1 — Scan quality** | Before seal; whole export wrong | **I-023** undo formalize → re-upload |
| **2 — One bad brick** | After formalize; scan trusted | **I-021**, move block, re-pack |
| **3 — Pick mismatch** | At pick; position/card wrong | **P-011–P-014** quarantine → hold → re-scan / re-allocate |

Typical layer-3 flow: picker finds wrong card at position → mark line **SHORT** (**P-003**) → **quarantine block** (**P-011**) → **hold pick list** (**P-012**) → record cards already in hand (**P-013**) → **re-allocate** remaining lines (**P-014**).

Stories below follow **INVEST**. Depends on core Phase 4: **P-001**, **P-003**, **P-009**, **S-001**, **B-002** (lifecycle).

| ID | User story (value) | Priority | Status |
|----|-------------------|----------|--------|
| **P-011** | **As a** picker who pulled the wrong card (or empty slot) at a position, **I want** to quarantine that block for repair, **so that** no other pick lists allocate from unreliable inventory until a manager fixes the brick. | Must | — |
| **P-012** | **As a** picker or lead with an open pick list, **I want** to put the list on hold when a block is quarantined or a line fails, **so that** we don’t complete an order with wrong cards while we repair or re-route. | Must | — |
| **P-013** | **As a** picker holding cards that can’t go back into the chaos pack, **I want** a correction re-scan path (small import or exception intake), **so that** mis-picked or extra cards re-enter inventory without pretending they’re still at position 1. | Should | — |
| **P-014** | **As a** fulfillment lead after a pick interruption, **I want** to re-allocate held lines to other blocks, **so that** the order can complete without waiting for the quarantined brick to be fully repaired. | Must | — |

#### Acceptance criteria (testable)

| ID | Acceptance |
|----|------------|
| **P-011** | From pick UI or block detail: quarantine **MTG-0007** with reason (e.g. `POSITION_MISMATCH`). Block excluded from **new** pick allocation; status or flag visible on blocks list/detail (extends **B-002** — e.g. `NEEDS_REPAIR` or `pickHold` + reason). Audit entry written. Cannot quarantine already-`LIQUIDATED` block. |
| **P-011** | Quarantining a block with **pending** pick items on **other** open lists flags those lines (or auto-holds lists per **P-012**). Sealed/ACTIVE blocks only (picking assumes sealed inventory). |
| **P-012** | Pick list moves to `ON_HOLD` (new `PickListStatus` or equivalent) with reason + linked block/line. Picker cannot mark list `COMPLETED` while on hold. UI shows which lines blocked and why. |
| **P-012** | Releasing hold requires explicit action (repair complete, re-allocated, or cancel list). Held lists visible on `/pick` dashboard. |
| **P-013** | Workflow documents “correction bin” physically; system accepts CSV upload or minimal manual intake labeled as correction (not tied to original trade-in import). Cards get new staging or OPEN block path; linked to pick list / order in audit notes. Out of scope: auto-merge into original block without repair workflow. |
| **P-014** | For held list line “Lightning Bolt NM” blocked on MTG-0007: **Re-allocate** searches other blocks (**S-001**, **P-009** position rules) and assigns substitute `PickItem` or updates line to new block+position. Original line `SHORT` or `SUBSTITUTED` with audit trail. Order can proceed when all lines resolved or explicitly shorted. |
| **P-014** | If no alternate block exists, line stays `SHORT`; list can complete with customer-service follow-up (partial ship). |

#### Suggested build order (after P-001, P-003, P-009)

1. **P-011** — quarantine block (foundation)
2. **P-012** — hold pick list (depends on P-011 trigger)
3. **P-014** — re-allocate (fulfillment recovery)
4. **P-013** — correction re-scan (physical ops polish; can ship with **I-005** / small CSV)

#### Schema notes (negotiable)

- `BlockStatus`: add `NEEDS_REPAIR` **or** `Block.pickHoldAt` + `pickHoldReason` without new enum value.
- `PickListStatus`: add `ON_HOLD`.
- `PickStatus`: use existing `SHORT` / `SUBSTITUTED`; optional `shortReason` on `PickItem` (`POSITION_MISMATCH`, `BLOCK_QUARANTINED`, `NO_STOCK`).

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

## Epic 9: I-015 QA Hardening (user stories)

Stories below came from QA review of **I-015** (Aug 2026). Each is written for **INVEST**: independent slice, negotiable solution, clear value, estimable scope, small deliverable, testable acceptance.

| ID | User story (value) | Priority | Status |
|----|-------------------|----------|--------|
| **I-023** | **As a** staff member who formalized an import too early, **I want** to undo the entire formalize from the staging review page in one action, **so that** I can fix my export file and re-upload without removing blocks one at a time. | Must | Done |
| **I-022** | **As a** staff member reviewing a formalized staging import, **I want** the breakdown to show which cards are in blocks vs unassigned, **so that** I trust card counts and know when a partial remove left gaps. | Must | Done |
| **I-021** | **As a** packer who trusts the scan but packed one brick wrong, **I want** to remove or repair one block without redoing the whole import, **so that** I fix a physical mistake without re-scanning 5,000 cards. | Should | — |
| **B-010** | **As a** picker or manager removing a block, **I want** the system to reject removal if pick items exist at delete time, **so that** I never get a cryptic failure mid-transaction when picking and removal overlap. | Must | Done |
| **PL-008** | **As a** developer shipping lifecycle changes, **I want** automated tests for full-redo and partial-removal staging paths, **so that** regressions in remove/formalize/delete are caught before deploy. | Should | Done |
| **B-013** | **As an** owner auditing inventory changes, **I want** a global log of block removals (who/when/which MTG ID), **so that** I can answer disputes and trace mistakes after the block detail page is gone. | Should | — |
| **B-012** | **As a** listing manager, **I want** removal blocked or gated for ACTIVE blocks until archived/liquidated, **so that** Mana Pool listings and physical inventory stay in sync. | Should | — |
| **B-011** | **As a** staff member on block detail, **I want** the remove action hidden or disabled when pick history exists, **so that** I discover constraints before typing a confirmation. | Should | Done |
| **B-017** | **As a** staff member deleting a block, **I want** a backup reminder in the danger zone, **so that** I can export data before an irreversible mistake. | Should | — |
| **B-014** | **As a** staff member confirming block removal, **I want** confirmation to accept the MTG ID regardless of letter case, **so that** mobile keyboards do not block a valid delete. | Could | — |
| **B-015** | **As a** staff member who removed a block, **I want** to see the success message (including staging-unlock note) before redirect, **so that** I know the action completed and what to do next. | Could | Done |
| **B-016** | **As a** staff member assigning physical team-bag labels, **I want** clear documentation that removed MTG IDs are not reused, **so that** I do not place a new brick in a bag labeled with a retired ID. | Could | — |
| **B-018** | **As a** packer, **I want** a clear policy for removing empty blocks (allowed with warning, or blocked), **so that** accidental empty formalize rows do not clutter bins or get removed without intent. | Could | — |

### Acceptance criteria (testable)

| ID | Acceptance |
|----|------------|
| **I-023** | Formalize 3+ OPEN blocks → undo (type UNDO) → import gone, blocks gone → re-upload → new MTG IDs. Blocked if any block sealed or has pick history. |
| **I-022** | After formalize, staging review shows per-block “in inventory” vs “unassigned”; after partial remove, orphaned card count visible; totals match `CardLine` + unassigned staging rows. |
| **I-021** | Formalize 3+ blocks → remove 1 block → remaining blocks unchanged; removed block’s cards either (a) re-enter staging as re-formalizable, (b) move to a new block via defined workflow, or (c) UI blocks partial remove with “use Undo formalize (**I-023**) for scan redo” — no silent card loss. |
| **B-010** | Pick item created concurrently with remove attempt → user sees pick-history message, not generic “Remove failed”; no partial delete. |
| **PL-008** | Tests cover: **I-023** undo formalize; remove all blocks → staging delete; remove all blocks → re-formalize; partial remove behavior per **I-021** decision. |
| **B-013** | `REMOVED_BLOCK` (and optionally other actions) visible in Settings or dedicated audit page with MTG ID, timestamp, card count, prior status. |
| **B-012** | ACTIVE/ARCHIVED/LIQUIDATED blocks cannot be removed via UI without lifecycle transition (or explicit override with extra confirm). |
| **B-011** | Block detail with `pickItems > 0`: remove section disabled with reason text; no confirm field shown. |
| **B-017** | Remove danger zone includes link/text matching Settings danger zone backup export pattern. |
| **B-014** | Typing `mtg-0001` succeeds when block is `MTG-0001`. |
| **B-015** | Server redirect after remove (no 404); context-aware destination with remediation flash on staging review. |
| **B-016** | README or in-app help states MTG IDs are sequential and not recycled; optional hint on remove success. |
| **B-018** | Documented behavior for 0-card blocks; UI matches (warn-only or disabled). |

### I-023 acceptance (sketch)

**Goal:** One action on `/staging/[importId]` replaces N× per-block removes when staff need to redo a scan after formalize. **v1 ships discard-only** (delete blocks + delete import).

#### Preconditions (eligibility)

| Rule | Rationale |
|------|-----------|
| `StagingImport.status === ASSIGNED` | Only formalized imports can be undone |
| Every block linked via `StagingCard.assignedBlockId` has **zero** `PickItem` rows | Phase 4 defensive guard (**B-010** related) |
| Every linked block is **`OPEN`** (unsealed) | Sealed/listed bricks use lifecycle / **P-011** repair, not import undo |
| At least one block is linked to this import | No-op with clear message if already reset |

#### UI (implemented v1)

- **Where:** Staging import review page when formalized — danger zone below bulk seal
- **Summary:** block count, card count, MTG IDs (truncated)
- **Confirm:** type `UNDO`
- **Backup reminder:** link to `/api/backup/export`
- **Outcome:** delete all linked blocks + delete staging import; staff re-upload on Staging

#### Out of scope (v1)

- Reset to `PARSED` without deleting import (deferred)
- Pick-time errors — **P-011–P-014**, not **I-023**

#### Definition of done

- **Done** — staff can redo a large import without N× block remove clicks.

### Suggested build order (Phase 3a)

1. **I-023** + **I-022** — ~~scan redo~~ **I-023 Done**; staging assignment visibility next
2. **B-010** + **B-011** — harden per-block remove before Phase 4 picking
3. **PL-008** — ~~lock **I-023** and remove paths with tests~~ **Done**
4. **I-021** — only if partial brick repair is still needed after **I-023** in production
5. **B-013**, **B-012**, **B-017** — ops safety and audit
6. **B-014**, **B-015**, **B-016**, **B-018** — polish

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

**Primary intake path (trade-in + bulk packing):** Scan at counter (ManaBox / Delver Lens / TCGplayer) → staff validates condition & authenticity → export CSV → **Staging** → position-indexed expand → hard-cap block breakdown → review → formalize (MTG IDs + bin assignment).

**Delivered:**

- **I-009 … I-013, I-016, I-017** — full CSV staging pipeline through formalize
- Upload activity log; batched DB writes (large imports validated at 5k+ cards)
- Pending staging queue (review + delete per import)
- Position 1 = front card; qty adjacency / cross-block split warnings
- Unlimited bins (**B-004**); block move/reassign from block detail

**Deferred:** ~~**I-018** bulk bin assign at formalize~~ — **Done** (default bin in Settings, Apply to all, summary view + compact per-block table).

### Phase 3 — Next (Block activation & lifecycle)

Goal: Manage blocks **after** staging formalize — seal, remove safely, full lifecycle, physical labels. **Trade-in intake stays on the CSV staging path** (see Intake strategy).

| Order | ID | Story | Why now |
|-------|-----|-------|---------|
| 1 | I-003 | Seal block (freeze contents) | **Done** — OPEN → SEALED, Unsealed labels in UI |
| 2 | I-015 | Remove block by block ID | **Partial** — per-block delete; whole-import redo → **I-023** Done |
| 3 | B-002 | Block lifecycle UI (Partial → Done) | **Done** — SEALED → ACTIVE → ARCHIVED → LIQUIDATED on block detail |
| 4 | B-007 | QR/barcode / team bag labels | MTG IDs exist after formalize; printable labels for physical bins |
| 5 | I-018 | Default bin at formalize + per-block override | **Done** — Settings default, summary view for large imports |

**Deferred from Phase 3 (was I-001):** Manual OPEN block creation — not needed for trade-in; see Phase 3b.

**Out of scope for Phase 3:** Picking (Phase 4), position pick **P-009**, Mana Pool orders stub, in-app scanner (**I-014**).

### Phase 3a — I-015 hardening (QA follow-up)

Goal: Close gaps found in QA review of block remove — prioritize **scan redo** over partial block repair.

| Order | ID | Story | Why now |
|-------|-----|-------|---------|
| 1 | I-023 | Undo formalize import | **Done** — one click discard; re-upload export file |
| 1b | I-024 | Staging list status badges | **Done** — pending/formalized badges; undo hint on list |
| 1c | I-025 | Upload: manual Continue to review | **Done** — no 8s auto-redirect after CSV breakdown |
| 2 | I-022 | Staging assignment visibility | **Done** — in inventory vs unassigned on review page |
| 3 | B-010 | Atomic pick guard | **Done** — in-tx re-check + FK mapping |
| 4 | B-011 | Disable remove when picks exist | **Done** — blocked UI on block detail |
| 5 | PL-008 | Remove/staging/undo tests | **Done** — Vitest against `tcg_inventory_test` |
| 6 | I-021 | Safe partial block removal | Should — only if one-brick repair still needed |
| 7 | B-013 | Global removal audit | Traceability after block page gone |
| 8 | B-012 | Status-aware removal | Protect ACTIVE listings |
| 9 | B-017 | Backup reminder on remove | Match Settings danger-zone safety |
| 10 | B-014–B-018 | UX/docs polish | Case confirm, success flash, ID docs, empty-block policy |

Ship ~~**I-023**~~ formalize recovery **done** for trade-in. **I-021** is optional polish after **I-023** is in use.

### Phase 3b — Exception intake (defer until concrete need)

Goal: Non-CSV edge cases only. **Do not prioritize for trade-in counter workflow.**

| Order | ID | Story | Notes |
|-------|-----|-------|-------|
| 1 | I-001 + I-002 | Manual block + Scryfall card add | **Single slice** — ship together; OPEN-only mutations; auto-position on qty |
| 2 | I-019 | Bulk line add on OPEN block | Mixed commons without per-card lookup |
| 3 | I-005 | Set + collector quick-add | Lighter repair path; reuses `getScryfallCardBySetAndNumber` |

Acceptance for I-001+I-002: create → add cards → seal → Mana Pool CSV export — not “create empty block.”

### Phase 4 — Orders & picking

**Core:** Mana Pool order import (Orders stub), **P-001**, **P-003**, **P-004**, **P-006**, **P-009** position pick + renumber, **P-010** pick history.

**Pick integrity (after core picking works):** **P-011** quarantine block → **P-012** hold pick list → **P-014** re-allocate alternates → **P-013** correction re-scan. See Epic 4 extension. **I-023** is not used here — scan redo is pre-seal only.

### Phase 5 — Polish

**S-001**, **S-004**, **O-002**, **A-004+**, pick waves, reconciliation.
