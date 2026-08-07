# Epic 1 — Block & Location Foundation

Prefix `B-`. The physical model: Shelf → Bin → Block, block lifecycle, and the guards around removal.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| B-001 | Create block with auto ID, label, location | Must | Done (staging path) |
| B-002 | Block lifecycle: OPEN → SEALED → ACTIVE → ARCHIVED → LIQUIDATED | Must | Done |
| B-003 | Track packed, sealed and last-pick dates | Must | Done |
| B-004 | Location hierarchy with unlimited bins and block move | Must | Done |
| B-005 | Block capacity hints (target count) | Should | Done |
| B-006 | Block tags/tiers | Should | Schema — corrected, see [audit](AUDIT-2026-08.md) |
| B-007 | QR/barcode team bag label generation | Could | Deferred |
| B-008 | Block notes and photo attachment | Could | Partial (notes only) |
| B-009 | Audit log for block changes | Must | Done |
| B-010 | Atomic pick guard on block remove | Must | Done |
| B-011 | Disable remove UI when block has pick history | Should | Done |
| B-012 | Status-aware block removal | Should | Done |
| B-013 | Global inventory event log + Activity feed | Should | Done |
| B-014 | Case-insensitive remove confirmation | Could | — |
| B-015 | Persist remove success message before redirect | Could | Done |
| B-016 | Document that MTG IDs are never recycled | Could | — |
| B-017 | Backup reminder on block remove danger zone | Should | — |
| B-018 | Empty block removal policy | Could | — |

---

### B-001 — Create block with auto ID, label, location

| | |
|---|---|
| **As a** | packer committing a staged import |
| **I want** | each brick to get a sequential MTG ID, an optional label and a bin |
| **So that** | the physical bag on the shelf has one unambiguous name I can look up |

**Priority:** Must · **Status:** Done (staging path; manual creation is **I-001**)

```gherkin
@done
Feature: B-001 Create block with auto ID, label and location

  Scenario: Formalize allocates sequential IDs
    Given no blocks exist
    When staff formalize an import that breaks into 3 blocks
    Then the blocks are named "MTG-0001", "MTG-0002" and "MTG-0003"
    And each is assigned to the bin chosen at formalize

  Scenario: IDs continue after a removal and are never reused
    Given blocks up to "MTG-0009" exist
    And "MTG-0007" has been removed
    When staff formalize one more block
    Then it is named "MTG-0010"
    And no block is named "MTG-0007"

  Scenario: A block is created OPEN
    When a block is created by formalize
    Then its status is OPEN
    And its packed date is set to now
```

**Related:** **I-001** manual creation (deferred, Phase 3b), **B-016** ID non-recycling.

---

### B-002 — Block lifecycle

| | |
|---|---|
| **As a** | listing manager |
| **I want** | each block to move through a defined lifecycle |
| **So that** | I can tell at a glance what is packable, sellable, retired or gone |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: B-002 Block lifecycle

  Scenario Outline: Valid transitions
    Given block "MTG-0007" has status <from>
    When staff perform "<action>" on block detail
    Then the block status becomes <to>
    And an inventory event recording the transition is written

    Examples:
      | from     | action     | to         |
      | OPEN     | seal       | SEALED     |
      | SEALED   | activate   | ACTIVE     |
      | ACTIVE   | archive    | ARCHIVED   |
      | ARCHIVED | liquidate  | LIQUIDATED |

  Scenario Outline: Invalid transitions are rejected
    Given block "MTG-0007" has status <from>
    When staff attempt "<action>"
    Then the action is rejected with a reason
    And the status remains <from>

    Examples:
      | from       | action    |
      | OPEN       | activate  |
      | LIQUIDATED | activate  |
      | LIQUIDATED | archive   |

  Scenario: Liquidated is terminal
    Given block "MTG-0007" has status LIQUIDATED
    When staff open block detail
    Then no further lifecycle action is offered
```

---

### B-003 — Track packed, sealed and last-pick dates

| | |
|---|---|
| **As a** | shop owner watching capital sit on a shelf |
| **I want** | every block to record when it was packed, sealed and last picked from |
| **So that** | aging analytics can tell me which bricks are dead weight |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: B-003 Block date tracking

  Scenario: Packed date is set at creation
    When a block is created
    Then its packed date is the creation time

  Scenario: Sealed date is set at seal
    Given block "MTG-0007" is OPEN with no sealed date
    When staff seal it
    Then its sealed date is set to now

  @pending
  Scenario: Last pick date updates when a card is pulled
    Given block "MTG-0007" is ACTIVE
    When a picker marks a card from it as PICKED
    Then the block's last pick date is set to now
```

**Note:** the last-pick scenario is `@pending` because picking is not built. The column exists and aging reads it. Closed by **P-004**.

---

### B-004 — Location hierarchy and block move

| | |
|---|---|
| **As a** | staff member reorganising the back room |
| **I want** | unlimited bins under shelves and the ability to move a block between bins |
| **So that** | the digital location always matches where the bag physically sits |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: B-004 Location hierarchy and block move

  Scenario: Bins are not capped
    Given shelf "A" already holds 20 bins
    When staff add another bin to shelf "A"
    Then it is created without a capacity warning

  Scenario: Move a block to a different bin
    Given block "MTG-0007" is in bin "A-01"
    When staff move it to bin "B-03" from block detail
    Then its location reads "B / B-03"
    And an inventory event recording the move is written

  Scenario: Deleting a shelf does not delete its bins' blocks
    Given shelf "A" holds bin "A-01" which holds block "MTG-0007"
    When shelf "A" is deleted
    Then block "MTG-0007" still exists
    And bin "A-01" is detached from any shelf
```

---

### B-005 — Block capacity hints

| | |
|---|---|
| **As a** | packer filling a team bag |
| **I want** | each block to carry the target card count it was broken down for |
| **So that** | I know when the bag is full and the brick matches the pack sheet |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: B-005 Block capacity hints

  Scenario: Target count carries from the import
    Given the staging target count is 50
    When an import is formalized
    Then each created block has a target count of 50

  Scenario: Card count is shown against the target
    Given block "MTG-0007" has a target count of 50 and holds 50 cards
    When staff view block detail
    Then the card count is displayed against the target
```

---

### B-006 — Block tags/tiers

| | |
|---|---|
| **As a** | shop owner deciding what to do with a brick |
| **I want** | to tag a block as bulk, trade-in, mystery-eligible or high-value hold |
| **So that** | I can pull the right bricks for a mystery box or a high-value audit without opening them |

**Priority:** Should · **Status:** Schema — the `BlockTier` enum exists and is displayed, but formalize always writes `GENERAL` and no UI can change it

```gherkin
@pending
Feature: B-006 Block tags and tiers

  Scenario: Set a tier on an existing block
    Given block "MTG-0007" has tier GENERAL
    When staff change its tier to "BULK_COMMONS" on block detail
    Then the tier is saved
    And an inventory event recording the tier change is written

  Scenario: Choose a tier at formalize
    When staff formalize an import
    Then they can select a tier applied to every created block
    And it defaults to GENERAL

  Scenario: Filter the blocks list by tier
    Given blocks exist with tiers GENERAL and HIGH_VALUE_HOLD
    When staff filter the blocks list by "HIGH_VALUE_HOLD"
    Then only the high-value blocks are listed
```

---

### B-007 — QR/barcode team bag labels

| | |
|---|---|
| **As a** | staff member who formalized one or more blocks from a staging import |
| **I want** | printable team-bag labels with the MTG block ID and a scannable code |
| **So that** | physical bags match digital inventory without handwriting errors, and pickers can identify bricks quickly at the shelf |

**Priority:** Could · **Status:** Deferred

**Trigger to build:** Manual labeling is the default for now. Revisit when handwritten labels cause errors, slow formalize throughput, or block Phase 4 picking workflows.

```gherkin
@pending
Feature: B-007 QR and barcode team bag labels

  Scenario: Print a label for one block
    Given block "MTG-0007" exists
    When staff choose "Print label" on block detail
    Then a print-ready page shows "MTG-0007" in large type
    And it shows a QR or Code 128 symbol encoding the block ID

  Scenario: Print labels for a whole import
    Given a formalized import produced 12 blocks
    When staff choose "Print labels" on the staging review page
    Then one label per block is produced in a single print-ready page

  Scenario: Reprint an older block
    Given block "MTG-0007" was formalized last month
    When staff print its label again
    Then the label is produced identically to the original

  Scenario: Label carries location context
    Given block "MTG-0007" sits in bin "A-01" on shelf "A"
    When its label is printed
    Then the label shows "A / A-01", the card count and the packed date
```

**Out of scope (v1):** in-app camera scan (**I-014**, superseded by **SCN-**), bin or shelf-only labels, label printer hardware setup, custom label stock beyond one documented layout.

**Related:** **B-001**, **B-004**, **B-016**, **PL-005**, **P-002**, **P-009**.

---

### B-008 — Block notes and photo attachment

| | |
|---|---|
| **As a** | packer who noticed something odd about a brick |
| **I want** | to leave a note and attach a photo on the block |
| **So that** | the next person handling the bag knows before they open it |

**Priority:** Could · **Status:** Partial — `Block.notes` exists in the schema; photos do not

```gherkin
@done
Scenario: Notes persist on a block
  Given block "MTG-0007" has a note recorded
  When staff view block detail
  Then the note is displayed
```

```gherkin
@pending
Feature: B-008 Block photo attachment

  Scenario: Attach a photo to a block
    When staff upload a photo on block detail
    Then the photo is stored and shown on the block
    And it is included in the JSON backup

  Scenario: Edit a note from the UI
    When staff edit the note on block detail and save
    Then the new text is persisted and an event is written
```

---

### B-009 — Audit log for block changes

| | |
|---|---|
| **As an** | owner investigating a discrepancy |
| **I want** | every block change recorded with what happened and when |
| **So that** | I can answer a dispute after the block itself is gone |

**Priority:** Must · **Status:** Done — delivered by **B-013**

```gherkin
@done
Feature: B-009 Audit log for block changes

  Scenario: Block changes appear on the block's own history
    Given block "MTG-0007" has been sealed and moved
    When staff view block detail
    Then a recent activity list shows the seal and the move with timestamps

  Scenario: History survives deletion of the block
    Given block "MTG-0007" has been removed
    When the owner opens "/activity"
    Then the removal event is still listed with "MTG-0007" in its payload
```

**Supersedes:** **O-005** (duplicate framing of the same capability).

---

### B-010 — Atomic pick guard on block remove

| | |
|---|---|
| **As a** | picker or manager removing a block |
| **I want** | removal rejected if pick items exist at the moment of deletion |
| **So that** | I never get a cryptic mid-transaction failure when picking and removal overlap |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: B-010 Atomic pick guard on block remove

  Scenario: A pick item created concurrently blocks the delete
    Given block "MTG-0007" has no pick items when the remove form is opened
    And a pick item is created for it before the remove transaction commits
    When the remove transaction runs
    Then it is rolled back
    And the user sees a pick-history message rather than a generic failure
    And no card lines were deleted

  Scenario: A foreign key violation is reported in plain language
    Given a database constraint rejects the delete because of a referencing pick item
    When the error surfaces
    Then it is translated into a pick-history explanation
```

---

### B-011 — Disable remove UI when block has pick history

| | |
|---|---|
| **As a** | staff member on block detail |
| **I want** | the remove action hidden or disabled when pick history exists |
| **So that** | I discover the constraint before typing a confirmation |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: B-011 Disable remove when picks exist

  Scenario: Remove is blocked in the UI
    Given block "MTG-0007" has at least one pick item
    When staff view block detail
    Then the remove section is disabled with a reason
    And no confirmation field is shown

  Scenario: Remove is offered when no picks exist
    Given block "MTG-0007" has no pick items and status OPEN
    When staff view block detail
    Then the remove section is enabled with a confirmation field
```

---

### B-012 — Status-aware block removal

| | |
|---|---|
| **As a** | listing manager |
| **I want** | removal blocked for ACTIVE blocks until they are archived, and blocked outright once liquidated |
| **So that** | live listings and physical inventory cannot drift apart |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: B-012 Status-aware block removal

  Scenario Outline: Removal eligibility by status
    Given block "MTG-0007" has status <status> and no pick items
    When staff attempt to remove it
    Then removal is <outcome>

    Examples:
      | status     | outcome                                            |
      | OPEN       | allowed                                            |
      | SEALED     | allowed                                            |
      | ARCHIVED   | allowed                                            |
      | ACTIVE     | blocked with a message to take the block offline first |
      | LIQUIDATED | blocked as a final state                           |

  Scenario: Pick history is checked before status
    Given block "MTG-0007" has status ACTIVE and has pick items
    When staff attempt to remove it
    Then the pick-history reason is shown rather than the status reason
```

---

### B-013 — Global inventory event log and Activity feed

| | |
|---|---|
| **As an** | owner auditing inventory changes |
| **I want** | one append-only feed of every block and staging action |
| **So that** | I can trace mistakes across the whole system, not one block at a time |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: B-013 Global inventory event log

  Scenario: The feed lists all recorded event types
    Given blocks have been formalized, sealed, moved, taken through lifecycle and removed
    When the owner opens "/activity"
    Then events for formalize, seal, move, lifecycle and removal are listed newest first
    And staging formalize, undo and delete events are listed

  Scenario: Filter by category and block ID
    Given the feed holds events for several blocks
    When the owner filters by block ID "MTG-0007"
    Then only events referencing "MTG-0007" are shown

  Scenario: Payload survives the deletion of its subject
    Given block "MTG-0007" is removed
    Then the removal event retains "MTG-0007" in its payload
    And the event's block reference is null rather than the event being deleted

  Scenario: Events are append-only
    Then no user-facing action edits or deletes an existing event
```

**Note:** phase 4 pick and order event types are defined but not yet emitted. `actor` is nullable and never populated — closed by **ACC-001**.

---

### B-014 — Case-insensitive remove confirmation

| | |
|---|---|
| **As a** | staff member confirming a block removal on a phone |
| **I want** | the confirmation to accept the MTG ID in any letter case |
| **So that** | a mobile keyboard's autocapitalisation does not block a valid delete |

**Priority:** Could · **Status:** —

```gherkin
@pending
Feature: B-014 Case-insensitive remove confirmation

  Scenario: Lowercase confirmation is accepted
    Given block "MTG-0001" is eligible for removal
    When staff type "mtg-0001" into the confirmation field and submit
    Then the block is removed

  Scenario: A different block ID is still rejected
    Given block "MTG-0001" is eligible for removal
    When staff type "mtg-0002" and submit
    Then the block is not removed
    And a mismatch message is shown
```

---

### B-015 — Persist remove success message before redirect

| | |
|---|---|
| **As a** | staff member who removed a block |
| **I want** | to see the success message, including any staging-unlock note, after the redirect |
| **So that** | I know the action completed and what to do next instead of landing on a 404 |

**Priority:** Could · **Status:** Done

```gherkin
@done
Feature: B-015 Remove success message survives redirect

  Scenario: Redirect to the blocks list with a flash message
    Given block "MTG-0007" is removed from block detail
    Then the user is redirected server-side to a valid destination
    And a success banner naming "MTG-0007" is displayed
    And no 404 is shown for the deleted block page

  Scenario: Removing the last block of an import notes the staging unlock
    Given "MTG-0007" is the last remaining block of a formalized import
    When it is removed
    Then the destination page explains that the staging import is now unlocked
```

---

### B-016 — Document that MTG IDs are never recycled

| | |
|---|---|
| **As a** | staff member assigning physical team-bag labels |
| **I want** | clear documentation that removed MTG IDs are not reused |
| **So that** | I do not place a new brick into a bag labelled with a retired ID |

**Priority:** Could · **Status:** —

```gherkin
@pending
Feature: B-016 Document MTG ID non-recycling

  Scenario: The rule is written down where staff will find it
    When a staff member reads the README or in-app help
    Then it states that MTG IDs are allocated sequentially and never reused after removal

  Scenario: The remove confirmation reinforces it
    When a block is removed
    Then the success message notes that its ID will not be reissued
    And it advises destroying or relabelling the physical bag
```

**Related:** **B-007** (labels), **B-001** (allocation).

---

### B-017 — Backup reminder on block remove danger zone

| | |
|---|---|
| **As a** | staff member deleting a block |
| **I want** | a backup reminder in the danger zone |
| **So that** | I can export data before an irreversible mistake |

**Priority:** Should · **Status:** —

```gherkin
@pending
Feature: B-017 Backup reminder on block remove

  Scenario: The remove danger zone offers a backup link
    Given block "MTG-0007" is eligible for removal
    When staff view the remove section on block detail
    Then a reminder links to "/api/backup/export"
    And the wording matches the Settings danger zone pattern

  Scenario: The reminder does not block the action
    When staff proceed without downloading a backup
    Then the removal still completes
```

---

### B-018 — Empty block removal policy

| | |
|---|---|
| **As a** | packer who created an empty block by accident |
| **I want** | a defined behaviour for removing zero-card blocks |
| **So that** | stray empty rows neither clutter bins nor get removed without intent |

**Priority:** Could · **Status:** — · **Decision needed:** warn-and-allow versus block

```gherkin
@pending
Feature: B-018 Empty block removal policy

  Scenario: Removing an empty block warns but proceeds
    Given block "MTG-0007" holds zero card lines
    When staff remove it
    Then a warning notes the block was empty
    And the removal completes

  Scenario: Empty blocks are visible as such
    Given block "MTG-0007" holds zero card lines
    When staff view the blocks list
    Then it is marked as empty
```

**Note:** the scenarios above encode the warn-and-allow option. If the decision goes the other way, replace them rather than adding a second policy.
