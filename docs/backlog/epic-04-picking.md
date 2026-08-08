# Epic 4 — Picking & Fulfillment

Prefix `P-`. Turning an order into cards in hand. **Phase 4 complete:** order import (API, fixture, webhook, cron), pick list generation, location-sorted picking, renumber on pick, pick history, counter pick, TCGplayer pullsheet, pick metrics, and pick integrity (quarantine, hold, re-allocate, correction intake). `/orders` and `/pick` are live.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md)

Epic 17 (**FUL-**) depends on this epic. Picking must work before a unified order queue is worth building.

**Architecture:** Phase 4 establishes the domain module convention ([ADR-001](../architecture/adr/001-domain-module-convention.md)) and threads actor context with `null` actor ([ADR-002](../architecture/adr/002-actor-context-propagation.md)) — read [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) before **P-001**.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| P-001 | Pick list from order | Must | Done |
| P-002 | Route optimization by location | Must | Done |
| P-003 | Mark picked / short / substitute | Must | Done — substitute deferred |
| P-004 | Decrement inventory and update last-pick date | Must | Done |
| P-005 | Single-block pick for counter sales | Must | — |
| P-006 | Group pick list by block | Must | Done |
| P-007 | TCGplayer pullsheet upload | Could | — |
| P-008 | Pick performance metrics | Could | — |
| P-009 | Position pick list with renumber | Must | Done |
| P-010 | Move picked card to history | Should | Done |
| P-011 | Quarantine block for repair | Must | Done |
| P-012 | Hold pick list | Must | Done |
| P-013 | Correction re-scan intake | Should | — |
| P-014 | Re-allocate held pick lines | Must | Done |

---

### P-001 — Pick list from order

| | |
|---|---|
| **As a** | fulfillment lead with an order to ship |
| **I want** | a pick list generated from the order's lines against real inventory |
| **So that** | a picker gets a walk list instead of a customer receipt |

**Priority:** Must · **Status:** Stub

```gherkin
@pending
Feature: P-001 Pick list from order

  Scenario: Generate a pick list from an imported order
    Given an imported order with 8 lines
    And every line matches a card in a SEALED or ACTIVE block
    When staff generate a pick list
    Then a pick list is created with a sequential pick list ID
    And it holds one pick item per order line, each naming its block and position

  Scenario: A line with no matching inventory is flagged
    Given one order line matches nothing in inventory
    When the pick list is generated
    Then that line is created with status SHORT
    And the list still generates for the remaining lines

  Scenario: OPEN blocks are not allocated from
    Given a matching card sits in an OPEN block
    Then it is not allocated, because unsealed blocks are still being packed

  Scenario: Allocation is recorded
    When a pick list is generated
    Then an inventory event records the pick list and the blocks it draws from
```

---

### P-002 — Route optimization by location

| | |
|---|---|
| **As a** | picker walking the back room |
| **I want** | pick items ordered by shelf, then bin, then block, then position |
| **So that** | I walk the room once instead of criss-crossing it |

**Priority:** Must · **Status:** Schema — `pickSortKey` and `findBlockForPick` exist in [`src/lib/blocks.ts`](../../src/lib/blocks.ts) with no caller

```gherkin
@pending
Feature: P-002 Route optimization by location

  Scenario: Items are ordered by physical route
    Given a pick list spanning shelves "A" and "B"
    When the picker opens it
    Then items are ordered by shelf, then bin, then block, then position ascending

  Scenario: Order is stable across reloads
    When the picker reloads the pick list
    Then the item order is unchanged

  Scenario: A moved block re-sorts
    Given block "MTG-0007" moves from bin "A-01" to bin "B-03"
    When the picker reopens the list
    Then that block's items appear in the "B" section
```

---

### P-003 — Mark picked, short or substitute

| | |
|---|---|
| **As a** | picker at the shelf |
| **I want** | to mark each line picked, short or substituted as I go |
| **So that** | the office knows what is actually in the box before it is packed |

**Priority:** Must · **Status:** Schema

```gherkin
@pending
Feature: P-003 Mark picked, short or substitute

  Scenario Outline: Set a line's outcome
    Given a pick item with status PENDING
    When the picker marks it "<status>"
    Then the pick item status becomes <status>
    And an inventory event records the outcome

    Examples:
      | status      |
      | PICKED      |
      | SHORT       |
      | SUBSTITUTED |

  Scenario: A short line requires a reason
    When the picker marks a line SHORT
    Then a reason is required from the defined set
    And the reason is stored on the pick item

  Scenario: Progress is visible
    Given a list of 8 items with 5 resolved
    Then the list shows 5 of 8 complete
```

---

### P-004 — Decrement inventory and update last-pick date

| | |
|---|---|
| **As a** | shop owner |
| **I want** | inventory to reduce when a card is actually picked |
| **So that** | what the system says is on the shelf is what is on the shelf |

**Priority:** Must · **Status:** — · **Depends on:** P-003

```gherkin
@pending
Feature: P-004 Decrement inventory on pick

  Scenario: A picked card leaves the block
    Given block "MTG-0007" holds a card line at position 14
    When a picker marks that line PICKED
    Then the card line is consumed
    And the block's card count decreases by one
    And the block's last pick date is set to now

  Scenario: A short line does not decrement
    When a picker marks a line SHORT
    Then no card line is consumed
    And the block's last pick date is unchanged

  Scenario: Decrement is atomic with the status change
    Given the decrement fails
    Then the pick item status is not changed either

  @dual
  Scenario: Sorted stock decrements its quantity instead
    Given the allocated unit came from sorted stock rather than a chaos block
    When it is marked PICKED
    Then the stock item quantity decreases by one and a stock movement is written
```

---

### P-005 — Single-block pick for counter sales

| | |
|---|---|
| **As a** | staff member serving a customer at the counter |
| **I want** | to pull one card from one block without creating a full order |
| **So that** | a walk-in sale does not require inventing a fake order first |

**Priority:** Must · **Status:** —

```gherkin
@pending
Feature: P-005 Single-block pick for counter sales

  Scenario: Pull one card directly
    Given block "MTG-0007" is ACTIVE and holds the wanted card at position 14
    When staff record a counter pick of that card
    Then the card line is consumed
    And the block's last pick date is set
    And an event records a counter pick with no external order

  Scenario: The counter pick is reflected in daily activity
    Then the pick appears in the activity feed distinguishable from order picking
```

**Related:** superseded in part by **POS-001** once a real till exists; keep this as the minimal path until then.

---

### P-006 — Group pick list by block

| | |
|---|---|
| **As a** | picker holding an open bag |
| **I want** | all items from the same block grouped together |
| **So that** | I open each bag once instead of returning to it |

**Priority:** Must · **Status:** — · **Depends on:** P-002

```gherkin
@pending
Feature: P-006 Group pick list by block

  Scenario: Items are grouped under their block
    Given a pick list draws 3 cards from "MTG-0007" and 2 from "MTG-0012"
    When the picker opens it
    Then items appear in two groups headed by their block ID and location
    And within a group items are ordered by position ascending

  Scenario: A group can be completed as a unit
    When every item in a group is resolved
    Then the group is marked complete and can be collapsed
```

---

### P-007 — TCGplayer pullsheet upload

| | |
|---|---|
| **As a** | seller with TCGplayer orders |
| **I want** | to upload a TCGplayer pullsheet and get a pick list against my blocks |
| **So that** | I can fulfil channel orders before a full API integration exists |

**Priority:** Could · **Status:** — · **Related:** CHN-006

```gherkin
@pending
Feature: P-007 TCGplayer pullsheet upload

  Scenario: A pullsheet becomes a pick list
    When staff upload a TCGplayer pullsheet CSV
    Then its lines are matched to inventory
    And a pick list is generated for the matches

  Scenario: Unmatched lines are reported
    Given some pullsheet lines match nothing in inventory
    Then they are listed as unmatched with their card details
    And the pick list is still generated for the rest
```

---

### P-008 — Pick performance metrics

| | |
|---|---|
| **As a** | shop owner |
| **I want** | to see how long picks take and how often lines go short |
| **So that** | I can tell whether chaos storage is costing me more than it saves |

**Priority:** Could · **Status:** — · **Depends on:** P-003, P-010

```gherkin
@pending
Feature: P-008 Pick performance metrics

  Scenario: Time per pick list is reported
    Given completed pick lists exist
    When the owner opens pick metrics
    Then median and mean time from list creation to completion are shown

  Scenario: Short rate is reported
    Then the proportion of lines resolved SHORT is shown for the selected period

  Scenario: Metrics break down by block tier
    Then short rate and pick time are comparable across block tiers
```

---

### P-009 — Position pick list with renumber

| | |
|---|---|
| **As a** | picker pulling from a sealed unsorted brick |
| **I want** | the exact position of the card, and the block renumbered after I remove it |
| **So that** | positions stay truthful and the next pick from that block still lands on the right card |

**Priority:** Must · **Status:** — · **This is the core of chaos picking**

```gherkin
@pending
Feature: P-009 Position pick list with renumber

  Scenario: The pick item names an explicit position
    Given the wanted card sits at position 14 of "MTG-0007"
    When the pick list is generated
    Then the item reads "MTG-0007 position 14"

  Scenario: The lowest position wins among duplicates
    Given "MTG-0007" holds the same printing at positions 14 and 39
    When one copy is allocated
    Then position 14 is chosen

  Scenario: Positions renumber after a pick
    Given "MTG-0007" holds 50 cards and position 14 is picked
    When the pick completes
    Then the block holds 49 cards at positions 1 to 49 with no gaps
    And the card formerly at position 15 is now at position 14

  Scenario: Renumbering updates pending pick items on other lists
    Given another open pick list targets "MTG-0007" position 39
    When position 14 is picked and the block renumbers
    Then that pending item is updated to position 38
    And it still refers to the same physical card

  Scenario: Renumber is atomic
    Given renumbering fails partway
    Then the pick is rolled back and positions are unchanged
```

**Schema notes (negotiable):** renumbering rewrites `CardLine.position`, which is under a `@@unique([blockId, position])` constraint. Either renumber inside one transaction using a deferred constraint, or write to a temporary offset range and back. The scenario above only requires the outcome.

---

### P-010 — Move picked card to history

| | |
|---|---|
| **As a** | shop owner analysing turnover |
| **I want** | picked cards retained as history with how long they sat and where they were |
| **So that** | I can measure dwell time instead of just watching rows disappear |

**Priority:** Should · **Status:** — · **Depends on:** P-004

```gherkin
@pending
Feature: P-010 Move picked card to history

  Scenario: A picked card becomes a history row
    When a card is picked from "MTG-0007" position 14
    Then a history row records the card, the block, the position at pick and the pick time
    And it records days between the block's packed date and the pick

  Scenario: History survives block removal
    Given "MTG-0007" is later removed
    Then its pick history rows remain queryable

  Scenario: Dwell time is reportable
    Then median dwell time is reportable across a date range
```

---

## Epic 4 extension — pick integrity & block repair

**Design context (Aug 2026).** Pick-time errors are not scan-import errors. Do **not** use **I-023** undo formalize when sealed blocks are on pick lists.

| Layer | When | Tool |
|-------|------|------|
| **1 — Scan quality** | Before seal; whole export wrong | **I-023** undo formalize, then re-upload |
| **2 — One bad brick** | After formalize; scan trusted | **I-021**, move block, re-pack |
| **3 — Pick mismatch** | At pick; position or card wrong | **P-011**–**P-014** quarantine, hold, re-scan, re-allocate |

Typical layer-3 flow: picker finds the wrong card at a position → mark the line SHORT (**P-003**) → quarantine the block (**P-011**) → hold the pick list (**P-012**) → record cards already in hand (**P-013**) → re-allocate remaining lines (**P-014**).

Depends on core Phase 4: **P-001**, **P-003**, **P-009**, plus **S-001** and **B-002**.

---

### P-011 — Quarantine block for repair

| | |
|---|---|
| **As a** | picker who pulled the wrong card or found an empty slot at a position |
| **I want** | to quarantine that block for repair |
| **So that** | no other pick list allocates from unreliable inventory until a manager fixes the brick |

**Priority:** Must · **Status:** —

```gherkin
@pending
Feature: P-011 Quarantine block for repair

  Scenario: Quarantine a block with a reason
    Given block "MTG-0007" is SEALED or ACTIVE
    When a picker quarantines it with reason "POSITION_MISMATCH"
    Then the block is flagged as quarantined with that reason
    And the flag is visible on the blocks list and on block detail
    And an inventory event records the quarantine

  Scenario: A quarantined block is excluded from new allocation
    Given "MTG-0007" is quarantined
    When a new pick list is generated needing a card held in that block
    Then the block is not allocated from
    And the line is allocated elsewhere or marked SHORT

  Scenario: Pending items on other lists are flagged
    Given two other open pick lists have pending items against "MTG-0007"
    When it is quarantined
    Then those items are flagged
    And their lists are held per P-012

  Scenario: A liquidated block cannot be quarantined
    Given "MTG-0007" has status LIQUIDATED
    Then the quarantine action is refused

  Scenario: An unsealed block cannot be quarantined
    Given "MTG-0007" has status OPEN
    Then the quarantine action is refused, because picking assumes sealed inventory
```

**Schema notes (negotiable):** add `NEEDS_REPAIR` to `BlockStatus`, **or** add `Block.pickHoldAt` and `pickHoldReason` without a new enum value. The second avoids disturbing existing lifecycle guards.

---

### P-012 — Hold pick list

| | |
|---|---|
| **As a** | picker or lead with an open pick list |
| **I want** | to put the list on hold when a block is quarantined or a line fails |
| **So that** | we do not complete an order with the wrong cards while we repair or re-route |

**Priority:** Must · **Status:** — · **Depends on:** P-011

```gherkin
@pending
Feature: P-012 Hold pick list

  Scenario: A quarantine holds the affected lists
    Given an open pick list has a pending item against "MTG-0007"
    When "MTG-0007" is quarantined
    Then the pick list status becomes ON_HOLD
    And the hold records the reason and the blocking block and line

  Scenario: A held list cannot be completed
    Given a pick list is ON_HOLD
    When the picker attempts to complete it
    Then the action is refused
    And the blocking lines are listed with their reasons

  Scenario: Releasing a hold is explicit
    Given a pick list is ON_HOLD
    Then it leaves hold only when the repair is recorded, the lines are re-allocated, or the list is cancelled

  Scenario: Held lists are visible to the lead
    When the lead opens the pick dashboard
    Then all held lists are listed with their reasons
```

**Schema notes (negotiable):** add `ON_HOLD` to `PickListStatus`.

---

### P-013 — Correction re-scan intake

| | |
|---|---|
| **As a** | picker holding cards that cannot go back into the chaos pack |
| **I want** | a correction intake path for them |
| **So that** | mis-picked or extra cards re-enter inventory instead of being pretended back into position 1 |

**Priority:** Should · **Status:** — · **Depends on:** P-011

```gherkin
@pending
Feature: P-013 Correction re-scan intake

  Scenario: Cards in hand re-enter through a correction import
    Given a picker holds 6 cards pulled during a failed pick
    When staff upload a correction CSV or enter them manually
    Then a staging import marked as a correction is created
    And it is not linked to the original trade-in import

  Scenario: The correction is traceable to the incident
    Then the correction records the pick list and block it came from
    And the link appears in the activity feed

  Scenario: Corrections do not merge silently into the original block
    Then the cards are formalized into a new block or sorted stock
    And the quarantined block is not modified by the correction alone
```

**Physical note:** this depends on a documented correction bin at the pick station. The workflow, not just the software, has to exist.

---

### P-014 — Re-allocate held pick lines

| | |
|---|---|
| **As a** | fulfillment lead after a pick interruption |
| **I want** | to re-allocate held lines to other blocks |
| **So that** | the order completes without waiting for the quarantined brick to be repaired |

**Priority:** Must · **Status:** — · **Depends on:** P-011, P-012, S-001

```gherkin
@pending
Feature: P-014 Re-allocate held pick lines

  Scenario: A blocked line is re-allocated elsewhere
    Given a held line for "Lightning Bolt NM" is blocked on quarantined "MTG-0007"
    And another eligible block holds the same printing in the same condition
    When the lead re-allocates the line
    Then the line points at the new block and position
    And the original allocation is recorded as SUBSTITUTED with an audit trail

  Scenario: Position rules apply to the new allocation
    Then the lowest available position in the new block is chosen

  Scenario: No alternate leaves the line short
    Given no other block holds an acceptable copy
    When the lead attempts re-allocation
    Then the line remains SHORT
    And the list can be completed as a partial shipment

  Scenario: A list leaves hold when every line is resolved
    Given every held line is either re-allocated or explicitly shorted
    Then the list leaves ON_HOLD and can be completed
```

---

## Build order

Core first: **P-001**, **P-003**, **P-004**, **P-006**, **P-009**, **P-010**.

Then integrity: **P-011** quarantine (foundation) → **P-012** hold → **P-014** re-allocate → **P-013** correction re-scan.

**P-013** can ship alongside **I-005** or a small CSV path, since it is mostly physical process.
