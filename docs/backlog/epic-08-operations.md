# Epic 8 — Operations

Prefix `O-`. Day-to-day inventory hygiene: counting, moving, splitting and merging blocks.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| O-001 | Cycle count workflow | Should | — |
| O-002 | Block transfer to a new location | Must | Done |
| O-003 | Split block | Should | — |
| O-004 | Merge blocks | Could | — |
| O-005 | Full change history | — | Retired — superseded by B-013 |
| O-007 | Clear bulk-move selection after success | Could | — |
| O-006 | Role-based access | Could | Retired — superseded by ACC-002 |

---

### O-001 — Cycle count workflow

| | |
|---|---|
| **As a** | shop owner |
| **I want** | a guided count of a bin or block with variance recorded |
| **So that** | drift between the system and the shelf is caught before an order fails |

**Priority:** Should · **Status:** —

```gherkin
@pending
Feature: O-001 Cycle count workflow

  Scenario: Count a block and record agreement
    Given block "MTG-0007" is recorded as holding 50 cards
    When staff start a cycle count and enter a counted total of 50
    Then the count is recorded as matching
    And the block's last counted date is set

  Scenario: A variance is recorded rather than silently corrected
    Given block "MTG-0007" is recorded as holding 50 cards
    When staff count 48
    Then a variance of -2 is recorded
    And the block is not silently adjusted
    And an event records the variance with the counter and the time

  Scenario: Resolving a variance is an explicit decision
    Given a variance of -2 is open on "MTG-0007"
    When a manager accepts the counted figure
    Then the recorded count is adjusted to 48
    And the adjustment is attributed to the manager

  Scenario: Count a whole bin
    Given bin "A-01" holds 6 blocks
    When staff run a bin cycle count
    Then each block is presented in turn
    And a bin-level summary of matches and variances is produced

  Scenario: Counting a sealed block warns first
    Given "MTG-0007" is SEALED
    When staff start a count
    Then they are warned that counting requires opening the bag
```

---

### O-002 — Block transfer to a new location

| | |
|---|---|
| **As a** | staff member reorganising storage |
| **I want** | to move blocks between bins, individually or in bulk, with an audit trail |
| **So that** | a shelf reshuffle does not desynchronise the whole system |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: O-002 Single block transfer

  Scenario: Move one block
    Given block "MTG-0007" is in bin "A-01"
    When staff move it to bin "B-03"
    Then its location reads "B / B-03"
    And a move event records the origin and destination
```

```gherkin
@done
Feature: O-002 Bulk block transfer

  Scenario: Move every block in a bin
    Given bin "A-01" holds 6 blocks
    When staff transfer the bin's contents to bin "C-02"
    Then all 6 blocks are in "C-02"
    And one move event is written per block

  Scenario: Move a selection of blocks
    When staff select 3 blocks from the blocks list and transfer them
    Then only those 3 move

  Scenario: A transfer to a nonexistent bin is refused
    Then nothing moves and the error names the missing bin

  Scenario: Transfers are atomic
    Given a bulk transfer fails partway
    Then no block has moved
```

---

### O-003 — Split block

| | |
|---|---|
| **As a** | packer whose brick outgrew its bag |
| **I want** | to split a block into two, keeping positions coherent |
| **So that** | an oversized brick becomes two valid ones without a re-scan |

**Priority:** Should · **Status:** —

```gherkin
@pending
Feature: O-003 Split block

  Scenario: Split at a position
    Given block "MTG-0007" holds 80 cards
    When staff split it after position 50
    Then "MTG-0007" holds 50 cards at positions 1 to 50
    And a new block holds 30 cards renumbered to positions 1 to 30
    And the new block takes the next MTG ID

  Scenario: The new block's destination is chosen
    Then staff choose the bin for the new block during the split

  Scenario: Only unsealed blocks split
    Given "MTG-0007" is SEALED
    When staff attempt a split
    Then it is refused, because the bag is physically closed

  Scenario: Splitting is audited on both blocks
    Then an event records the split, naming the origin and the new block

  Scenario: No cards are lost
    Then the two resulting blocks together hold the original 80 cards
```

---

### O-004 — Merge blocks

| | |
|---|---|
| **As a** | packer consolidating two half-empty bags |
| **I want** | to merge one block into another with positions renumbered |
| **So that** | I reclaim shelf space without losing addressability |

**Priority:** Could · **Status:** —

```gherkin
@pending
Feature: O-004 Merge blocks

  Scenario: Merge two blocks
    Given "MTG-0007" holds 20 cards and "MTG-0012" holds 15
    When staff merge "MTG-0012" into "MTG-0007"
    Then "MTG-0007" holds 35 cards at positions 1 to 35
    And the cards from "MTG-0012" occupy positions 21 to 35 in their original order
    And "MTG-0012" is removed

  Scenario: The retired ID is not reused
    Then no future block is named "MTG-0012"

  Scenario: Only unsealed blocks merge
    Given either block is SEALED
    Then the merge is refused

  Scenario: A merge that would exceed the target count warns
    Given the combined count exceeds the destination's target count
    Then staff are warned before confirming

  Scenario: The merge is audited
    Then an event records both block IDs and the resulting card count
```

---

### O-005 — Full change history

**Retired.** Duplicated **B-009**; both are satisfied by the `InventoryEvent` platform delivered under **B-013**.

**Superseded by:** **B-013**. See [`epic-01-blocks.md`](epic-01-blocks.md).

---

### O-006 — Role-based access

**Retired.** Restated at proper scope in Epic 20, where it is a Phase 6 **Must** rather than a Could — every parity feature writes money-affecting events and needs an actor.

**Superseded by:** **ACC-001**, **ACC-002**, **ACC-003**. See [`epic-20-access-platform.md`](epic-20-access-platform.md).

---

### O-007 — Clear bulk-move selection after success

| | |
|---|---|
| **As a** | staff member who just moved blocks |
| **I want** | row checkboxes to clear when a bulk transfer succeeds |
| **So that** | updated locations are obvious and I do not accidentally move the same blocks again |

**Priority:** Could · **Status:** — · **Source:** Phase 5 smoke 2026-08-09 (deferred UX)

```gherkin
@pending
Feature: O-007 Clear bulk-move selection after success

  Scenario: Selection clears on successful move
    Given two blocks are ticked for bulk transfer
    When the move succeeds
    Then no block rows remain selected
    And the success message is shown
```
