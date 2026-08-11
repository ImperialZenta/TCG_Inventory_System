# Epic 22 — Channel Catalogs & Upload Sessions

Prefix `CHL-`. Block-mode marketplace listing: bin groupings (channel catalogs) plus upload sessions that reserve SEALED blocks, export CSV, and batch-activate after external upload.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [ADR-013](../architecture/adr/013-channel-catalogs-block-listing.md)

**Phase 5b.** Does **not** depend on SKU-001 (unlike CHN-006 stock export). Supersedes draft LST “staging mirror” listing session.

**Architecture:** [ADR-013](../architecture/adr/013-channel-catalogs-block-listing.md) — integrity matrix **I-01** through **I-17**.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| CHL-001 | Channel catalog entity + assign bins | Must | Done |
| CHL-002 | Blocks inherit default channel from bin on formalize and move | Should | — |
| CHL-003 | Upload session: select SEALED blocks, choose channel, reserve | Must | Done |
| CHL-004 | Generate session CSV (Mana Pool); aggregate across blocks | Must | Done |
| CHL-005 | Complete upload session: batch ACTIVATE, set channel | Must | Done |
| CHL-006 | Cancel upload session: release reservations | Must | Done |
| CHL-007 | Upload sessions UI: pending list, detail, complete/cancel | Must | Done |
| CHL-008 | Channel catalogs UI: bin membership, filter sealed blocks | Should | Done |
| CHL-009 | Close PL-005 test gap: golden CSV + aggregation tests | Should | Done |
| CHL-010 | Multi-channel UI; TCGplayer CSV stub | Should | — |
| CHL-011 | Export/session audit log + Activity feed links | Should | — |
| CHL-012 | Pick gating: exclude session-reserved SEALED blocks | Must | Done |
| CHL-013 | Take offline playbook + ARCHIVE delist checklist (manual MP) | Should | — |
| CHL-014 | Permissions: configure catalogs, create/complete/cancel sessions | Must | Done |
| CHL-015 | Lifecycle integrity guards (matrix I-02–I-17) | Must | Done |

**Build order:** CHL-003 → CHL-006 → CHL-012 → CHL-004 → CHL-005 → CHL-007 → CHL-014 → CHL-001 → CHL-002 → CHL-008 → CHL-009 → CHL-010 → CHL-011 → CHL-013 → CHL-015 (guards land with CHL-003–012; CHL-015 captures cross-cutting scenarios for Agent B).

---

### CHL-001 — Channel catalog entity + assign bins

| | |
|---|---|
| **As a** | listing manager |
| **I want** | to group bins into a marketplace catalog |
| **So that** | I can filter sealed blocks by where they live on the shelf when building an upload |

**Priority:** Must · **Status:** — · **Depends on:** B-004, PL-006

```gherkin
@done
Feature: CHL-001 Channel catalog bin membership

  Scenario: Assign two bins to the Mana Pool catalog
    Given bins "A-01" and "A-02" exist
    When staff assign both to the Mana Pool channel catalog
    Then both bins appear as members
    And the catalog is listed under Mana Pool

  Scenario: A bin cannot join two Mana Pool catalogs
    Given bin "A-01" is in the Mana Pool catalog
    When staff attempt to add "A-01" to a second Mana Pool catalog
    Then the action is rejected with a reason naming the existing catalog

  Scenario: The same bin may appear on different channel catalogs
    Given bin "A-01" is in the Mana Pool catalog
    When staff add "A-01" to the TCGplayer catalog
    Then both memberships exist

  Scenario: Removing a bin from a catalog does not change block status
    Given bin "A-01" holds sealed block "MTG-0007"
    When staff remove "A-01" from the Mana Pool catalog
    Then "MTG-0007" remains SEALED
```

**Schema notes (negotiable):** `ChannelCatalog`, `ChannelCatalogBin` — see ADR-013.

---

### CHL-002 — Blocks inherit default channel from bin

| | |
|---|---|
| **As a** | packer formalizing blocks |
| **I want** | new blocks to pick up the bin's default marketplace |
| **So that** | channel filters are correct before I start an upload session |

**Priority:** Should · **Status:** — · **Depends on:** CHL-001, I-012

```gherkin
@pending
Feature: CHL-002 Block channel inheritance from bin

  Scenario: Formalize sets block channel from bin default
    Given bin "A-01" is in the Mana Pool catalog
    When staff formalize an import into "A-01"
    Then the new block's channel is MANAPOOL

  Scenario: Moving a block updates its channel hint
    Given block "MTG-0007" is in bin "A-01" on the Mana Pool catalog
    And bin "B-01" is on the TCGplayer catalog only
    When staff move "MTG-0007" to "B-01"
    Then the block's channel hint becomes TCGPLAYER

  Scenario: Upload session complete overrides channel hint
    Given block "MTG-0007" has channel hint MANAPOOL
    When staff complete an upload session for "MTG-0007" on TCGPLAYER
    Then the block's channel is TCGPLAYER
```

**Note:** Inheritance is a **hint** for UI/filtering; upload session complete is authoritative.

---

### CHL-003 — Upload session create + reserve

| | |
|---|---|
| **As a** | seller with several sealed bricks ready to list |
| **I want** | to batch sealed blocks into an upload session for one marketplace |
| **So that** | they are reserved while I upload the CSV externally |

**Priority:** Must · **Status:** — · **Depends on:** B-002

```gherkin
@done
Feature: CHL-003 Upload session create and reserve

  Background:
    Given blocks "MTG-0001" through "MTG-0005" have status SEALED

  Scenario: Create a session for Mana Pool with five blocks
    When staff create upload session "UP-0001" for MANAPOOL with those blocks
    Then the session status is DRAFT
    And all five blocks are reserved for "UP-0001"

  Scenario: OPEN blocks cannot be added
    Given block "MTG-0010" has status OPEN
    When staff attempt to add "MTG-0010" to a new upload session
    Then the action is rejected

  Scenario: ACTIVE blocks cannot be added
    Given block "MTG-0011" has status ACTIVE
    When staff attempt to add "MTG-0011" to a new upload session
    Then the action is rejected with a reason that the block is already active

  Scenario: A block reserved elsewhere cannot join a second session
    Given block "MTG-0007" is reserved in open session "UP-0001"
    When staff attempt to add "MTG-0007" to session "UP-0002"
    Then the action is rejected

  Scenario: Session receives a sequential display id
    When staff create the first upload session
    Then its display id is "UP-0001"
```

---

### CHL-004 — Generate session CSV

| | |
|---|---|
| **As a** | seller |
| **I want** | one Mana Pool CSV for all blocks in my upload session |
| **So that** | I can import once at manapool.com |

**Priority:** Must · **Status:** — · **Depends on:** CHL-003, PL-005, PL-007

```gherkin
@done
Feature: CHL-004 Generate upload session CSV

  Scenario: CSV merges identical printings across session blocks
    Given session "UP-0001" includes sealed "MTG-0007" with 2x "Lightning Bolt" NM
    And session "UP-0001" includes sealed "MTG-0008" with 1x "Lightning Bolt" NM
    When staff generate the Mana Pool CSV for "UP-0001"
    Then the session status is CSV_READY
    And the CSV contains one "Lightning Bolt" row with quantity 3

  Scenario: Bulk lines without Scryfall ID are excluded
    Given a session block holds only bulk lines without Scryfall ID
    When staff generate the CSV
    Then the action fails or warns with zero listable rows

  Scenario: Regenerate replaces the downloadable file metadata
    Given session "UP-0001" is CSV_READY
    When staff regenerate the CSV
    Then a new export audit row is written
    And the session remains CSV_READY

  Scenario: Generate re-validates block eligibility
    Given block "MTG-0007" in the session was unsealed to OPEN by another action
    When staff generate the CSV
    Then the action is rejected and names "MTG-0007"
```

---

### CHL-005 — Complete upload session

| | |
|---|---|
| **As a** | seller who verified the Mana Pool import |
| **I want** | to mark the upload session complete |
| **So that** | all included blocks become ACTIVE on that channel |

**Priority:** Must · **Status:** — · **Depends on:** CHL-004, B-002

```gherkin
@done
Feature: CHL-005 Complete upload session

  Background:
    Given upload session "UP-0001" is CSV_READY for MANAPOOL
    And it includes sealed blocks "MTG-0001" through "MTG-0005"

  Scenario: Complete activates all session blocks
    When staff confirm complete on "UP-0001"
    Then all five blocks have status ACTIVE and channel MANAPOOL
    And each block's activatedAt is set
    And session "UP-0001" status is COMPLETED
    And reservations are cleared
    And an inventory event "upload.completed" is recorded

  Scenario: Complete requires CSV_READY
    Given session "UP-0002" is DRAFT
    When staff attempt to complete "UP-0002"
    Then the action is rejected

  Scenario: Complete is all-or-nothing
    Given block "MTG-0003" in the session is no longer SEALED
    When staff attempt to complete "UP-0001"
    Then no block in the session is activated
    And the session remains CSV_READY

  Scenario: Complete requires explicit confirmation
    When staff open the complete action
    Then the UI states that the app does not verify Mana Pool accepted the file
    And staff must confirm before ACTIVATE runs
```

---

### CHL-006 — Cancel upload session

| | |
|---|---|
| **As a** | seller who aborted a marketplace upload |
| **I want** | to cancel the upload session |
| **So that** | blocks are released without going ACTIVE |

**Priority:** Must · **Status:** — · **Depends on:** CHL-003

```gherkin
@done
Feature: CHL-006 Cancel upload session

  Scenario: Cancel releases reservations
    Given open session "UP-0001" reserves sealed block "MTG-0007"
    When staff cancel "UP-0001"
    Then "MTG-0007" remains SEALED
    And "MTG-0007" is not reserved
    And session status is CANCELLED

  Scenario: Cancel warns when CSV was already generated
    Given session "UP-0001" is CSV_READY
    When staff open cancel
    Then the UI warns that Mana Pool may already have been updated if they uploaded the file

  Scenario: Completed sessions cannot be cancelled
    Given session "UP-0001" is COMPLETED
    When staff attempt to cancel "UP-0001"
    Then the action is rejected
```

---

### CHL-007 — Upload sessions UI

| | |
|---|---|
| **As a** | seller |
| **I want** | a hub for open and completed upload sessions |
| **So that** | I can track in-flight listing work |

**Priority:** Must · **Status:** — · **Depends on:** CHL-003–006

```gherkin
@done
Feature: CHL-007 Upload sessions UI

  Scenario: Pending sessions list
    Given sessions "UP-0001" (CSV_READY) and "UP-0002" (DRAFT) exist
    When staff open "/uploads"
    Then both appear under pending
    And each shows channel, block count and status

  Scenario: Session detail shows reserved blocks
    Given session "UP-0001" reserves "MTG-0007" and "MTG-0008"
    When staff open "/uploads/UP-0001"
    Then both blocks are listed with location and card counts
    And download CSV and complete/cancel actions match session status
```

---

### CHL-008 — Channel catalogs UI

| | |
|---|---|
| **As a** | listing manager |
| **I want** | to configure bin membership and filter sealed blocks |
| **So that** | upload session block selection is faster |

**Priority:** Should · **Status:** — · **Depends on:** CHL-001, CHL-007

```gherkin
@done
Feature: CHL-008 Channel catalogs UI

  Scenario: Configure bin membership
    When staff open "/catalogs"
    Then each channel catalog shows member bins and sealed block counts

  Scenario: Filter sealed blocks by catalog when creating a session
    Given the Mana Pool catalog includes bin "A-01"
    And "A-01" holds sealed blocks "MTG-0007" and "MTG-0008"
    When staff start a new Mana Pool upload session filtered to that catalog
    Then "MTG-0007" and "MTG-0008" are offered for selection
    And blocks outside the catalog are not pre-selected
```

---

### CHL-009 — PL-005 test gap closure

| | |
|---|---|
| **As a** | maintainer |
| **I want** | automated tests for Mana Pool CSV aggregation |
| **So that** | export regressions are caught before store listing |

**Priority:** Should · **Status:** — · **Depends on:** PL-005, CHL-004

```gherkin
@done
Feature: CHL-009 Mana Pool CSV export tests

  Scenario: Golden CSV matches fixture for single block
    Given block "MTG-0007" matches docs/fixtures/manapool-listing-staging-01.csv source data
    When export runs for that block alone
    Then the output matches the golden file byte-for-byte except price column

  Scenario: Cross-block aggregation matches golden
    Given session blocks match docs/fixtures/manapool-upload-session-merged.csv source data
    When export runs for the session
    Then merged quantities match the golden file
```

---

### CHL-010 — Multi-channel UI stub

| | |
|---|---|
| **As a** | seller planning TCGplayer listing |
| **I want** | to create a TCGplayer upload session |
| **So that** | the workflow is ready when the CSV template ships |

**Priority:** Should · **Status:** — · **Depends on:** CHL-007

```gherkin
@pending
Feature: CHL-010 Multi-channel stub

  Scenario: TCGplayer session can be created but CSV is stubbed
    When staff create an upload session for TCGPLAYER
    Then block reservation works as for MANAPOOL
    And generate CSV shows that TCGplayer export is not yet available
```

---

### CHL-011 — Export audit log

| | |
|---|---|
| **As a** | shop owner |
| **I want** | export and session events in the activity feed |
| **So that** | I can audit who listed what and when |

**Priority:** Should · **Status:** — · **Depends on:** CHL-004, B-013

```gherkin
@pending
Feature: CHL-011 Upload session audit

  Scenario: CSV generation writes an event
    When staff generate CSV for session "UP-0001"
    Then an inventory event "upload.csv_generated" is recorded with block ids and row count

  Scenario: Activity links to session detail
    When staff open the activity entry
    Then it links to "/uploads/UP-0001"
```

---

### CHL-012 — Pick gating for reserved blocks

| | |
|---|---|
| **As a** | picker |
| **I want** | orders to skip blocks reserved for upload |
| **So that** | we do not pick inventory mid-listing |

**Priority:** Must · **Status:** — · **Depends on:** CHL-003, P-004

```gherkin
@done
Feature: CHL-012 Pick gating for upload reservations

  Scenario: Allocation skips reserved sealed block
    Given block "MTG-0007" is SEALED and reserved in open session "UP-0001"
    And block "MTG-0008" is SEALED ACTIVE on MANAPOOL with the same printing
    When an order line matches that printing
    Then allocation may use "MTG-0008" but not "MTG-0007"

  Scenario: Counter-pick rejects reserved block
    Given block "MTG-0007" is reserved in an open upload session
    When staff attempt counter-pick from "MTG-0007"
    Then the action is rejected with a reason naming the upload session

  Scenario: After complete or cancel reserved block is pickable again
    Given block "MTG-0007" was reserved and session was cancelled
    When an order line matches a card in "MTG-0007"
    Then allocation may use "MTG-0007" once it is otherwise eligible
```

---

### CHL-013 — Take offline playbook

| | |
|---|---|
| **As a** | seller archiving an active block |
| **I want** | clear steps to delist from Mana Pool manually |
| **So that** | I do not leave stale qty on the marketplace |

**Priority:** Should · **Status:** — · **Depends on:** B-002

```gherkin
@pending
Feature: CHL-013 Take offline playbook

  Scenario: ARCHIVE shows manual delist checklist
    Given block "MTG-0007" has status ACTIVE on MANAPOOL
    When staff choose Take offline
    Then the UI lists manual Mana Pool steps: export inventory, reduce/remove qty, re-import or vacation mode
    And the app does not claim the marketplace was updated

  Scenario: ARCHIVE succeeds without API delist
    When staff confirm Take offline on "MTG-0007"
    Then the block status is ARCHIVED
```

**Deliverable:** Update [STORE-OPERATIONS.md](../operations/STORE-OPERATIONS.md) listing section.

---

### CHL-014 — Permissions

| | |
|---|---|
| **As a** | shop owner |
| **I want** | role-gated catalog and upload actions |
| **So that** | only trusted staff can publish inventory |

**Priority:** Must · **Status:** — · **Depends on:** ACC-002, CHL-007

```gherkin
@done
Feature: CHL-014 Upload and catalog permissions

  Scenario Outline: Role may perform action
    Given a user with role <role>
    When they attempt <action>
    Then the attempt <result>

    Examples:
      | role     | action              | result    |
      | STAFF    | create upload session | succeeds |
      | STAFF    | complete session    | fails     |
      | MANAGER  | complete session    | succeeds  |
      | READ_ONLY| open /uploads       | fails     |
      | MANAGER  | configure catalogs  | succeeds  |
```

**Schema notes (negotiable):** `UPLOAD_SESSION_INTAKE`, `UPLOAD_SESSION_COMPLETE`, `UPLOAD_SESSION_CANCEL`, `CATALOG_CONFIGURE`.

---

### CHL-015 — Lifecycle integrity guards

| | |
|---|---|
| **As a** | shop owner |
| **I want** | the system to reject unsafe state combinations |
| **So that** | listing and picking cannot corrupt inventory integrity |

**Priority:** Must · **Status:** — · **Depends on:** CHL-003–006, CHL-012, B-002, B-012

**Related:** ADR-013 integrity matrix **I-02** through **I-17**.

```gherkin
@done
Feature: CHL-015 Upload session integrity guards

  Scenario: Per-block ACTIVATE is blocked while reserved
    Given block "MTG-0007" is reserved in open session "UP-0001"
    When staff attempt Mark as listed on block detail for "MTG-0007"
    Then the action is rejected
    And the reason names session "UP-0001"

  Scenario: Block remove is blocked while reserved
    Given block "MTG-0007" is reserved in an open upload session
    When staff attempt to remove "MTG-0007"
    Then the action is rejected

  Scenario: Quarantined block cannot join a session
    Given block "MTG-0007" is SEALED with pickHoldAt set
    When staff attempt to add "MTG-0007" to an upload session
    Then the action is rejected

  Scenario: Complete is idempotent
    Given session "UP-0001" is already COMPLETED
    When staff attempt to complete "UP-0001" again
    Then the action is rejected or is a no-op without duplicate events

  Scenario: Moving a reserved block is allowed with warning
    Given block "MTG-0007" is reserved in session "UP-0001"
    When staff move "MTG-0007" to another bin
    Then the move succeeds
    And "MTG-0007" remains in session "UP-0001"
    And the UI notes the new location on the session detail page
```

---

## Edge conditions review checklist (for Agent B / implementation)

Use this when stepping through each story before `@done`:

1. **Session open + order import** — picks skip reserved blocks; may short until complete (**I-01**, **I-17**).
2. **Session CSV_READY + staff uploads to MP but cancels in app** — MP may have qty; cancel warning (**I-06**).
3. **Session complete but MP import failed** — app ACTIVE, MP wrong; confirmation copy only v1 (**I-05**).
4. **Two ACTIVE blocks same printing same channel** — valid; picks choose by allocation rules (**I-04**).
5. **Regenerate CSV after MP upload** — staff may upload wrong file; show generated-at (**I-13**).
6. **Concurrent sessions disjoint blocks** — allowed.
7. **Bin removed from catalog mid-session** — session unchanged; block IDs stable (**I-08**).
8. **PL-005 per-block export while block reserved** — allow download or block? **Decision:** allow ad-hoc export; reservation is for session batch + pick gating only (document in ADR-013 consequences).

**Out of scope v1:** auto-delist on ARCHIVE, API upload verification, SKU-mode export, vacation mode integration.

**Related:** **PL-005**, **B-002**, **B-004**, **B-012**, **P-004**, **S-004**, **CHN-001**, **CHN-006** (stock `@dual`).
