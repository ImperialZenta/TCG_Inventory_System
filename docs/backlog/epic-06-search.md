# Epic 6 — Search & Inventory Browser

Prefix `S-`. Answering "where is this card" and "how many do we have".

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md)

`/inventory` is a stub page. **S-001** and **S-004** are prerequisites for pick allocation (**P-001**, **P-014**) and for anything in Epic 14 that needs to know a real quantity.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| S-001 | Search by card, show blocks | Must | Stub |
| S-002 | Search by block ID, show contents and age | Must | Done |
| S-003 | Filter by set, rarity, condition, foil, age | Should | — |
| S-004 | Global quantity by card across blocks | Must | — |
| S-005 | Location map or grid | Could | — |

---

### S-001 — Search by card, show blocks

| | |
|---|---|
| **As a** | staff member with a customer asking for a card |
| **I want** | to search by card name and see exactly which blocks and positions hold it |
| **So that** | I can answer in seconds instead of opening bags |

**Priority:** Must · **Status:** Stub

```gherkin
@pending
Feature: S-001 Search by card

  Scenario: Find every copy of a card
    Given "Lightning Bolt" is held at "MTG-0007" position 14 and "MTG-0012" position 3
    When staff search "/inventory" for "Lightning Bolt"
    Then both locations are listed with block ID, position, condition, finish, language and block location

  Scenario: Results distinguish printings
    Given copies exist from two different sets
    Then each printing is shown separately with its set and collector number

  Scenario: Block status is visible in results
    Then each result shows whether its block is OPEN, SEALED, ACTIVE, ARCHIVED or LIQUIDATED
    And OPEN blocks are marked as still being packed

  Scenario: No match says so
    When staff search for a card not held
    Then the page states no copies are in inventory

  @dual
  Scenario: Sorted stock appears alongside chaos blocks
    Given the same printing exists as sorted stock and inside a chaos block
    Then both are listed, each labelled with its storage mode
```

---

### S-002 — Search by block ID

| | |
|---|---|
| **As a** | staff member holding a bag |
| **I want** | to look up a block by its printed ID and see its contents and age |
| **So that** | I can identify an unlabelled or ambiguous brick |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: S-002 Search by block ID

  Scenario: Open a block by its ID
    When staff navigate to "/blocks/MTG-0007"
    Then the block's cards are listed in position order
    And its status, location, packed date, age and card count are shown

  Scenario: An unknown ID is handled
    When staff navigate to a block ID that does not exist
    Then a not-found page is shown rather than an error

  Scenario: Recent activity for the block is shown
    Then the block's recent inventory events are listed
```

---

### S-003 — Filter by set, rarity, condition, foil, age

| | |
|---|---|
| **As a** | staff member preparing a targeted pull |
| **I want** | to filter inventory by attributes |
| **So that** | I can find "all foil rares from this set in NM" without reading every block |

**Priority:** Should · **Status:** — · **Depends on:** S-001

```gherkin
@pending
Feature: S-003 Inventory filters

  Scenario: Filter by several attributes at once
    When staff filter by set "neo", condition NM and finish FOIL
    Then only matching card lines are listed
    And the result count is shown

  Scenario: Filter by block age
    When staff filter to cards in blocks older than 90 days
    Then only cards from stale blocks are listed

  Scenario: Filters combine with a text search
    Given a name search is active
    When a condition filter is added
    Then both constraints apply

  Scenario: Filters are clearable
    Then all filters can be cleared in one action

  Scenario: Rarity filtering needs catalog data
    Given rarity is not stored on the card line
    Then rarity filtering resolves through the catalog cache rather than a per-row lookup
```

**Note:** rarity is not persisted on `CardLine`. This story depends on **C-004** or **GAM-002** providing a local catalog to join against.

---

### S-004 — Global quantity by card across blocks

| | |
|---|---|
| **As a** | seller deciding what to list |
| **I want** | one number for how many of a printing we hold in total |
| **So that** | I do not oversell by counting one block and forgetting three others |

**Priority:** Must · **Status:** — · **Prerequisite for:** CHN-005

```gherkin
@pending
Feature: S-004 Global quantity by card

  Scenario: Quantities sum across blocks
    Given a printing is held 3 times in "MTG-0007" and twice in "MTG-0012"
    When staff view that printing
    Then the total reads 5

  Scenario: Quantity breaks down by condition
    Given 3 copies are NM and 2 are LP
    Then the breakdown shows 3 NM and 2 LP

  Scenario: OPEN block contents are excluded from sellable totals
    Given 2 of the copies sit in an OPEN block
    Then the sellable total reads 3
    And the in-packing total of 2 is shown separately

  Scenario: Allocated copies are excluded from available
    Given one copy is already on an open pick list
    Then available reads one fewer than on hand

  @dual
  Scenario: Totals span both storage modes
    Then chaos block copies and sorted stock copies are summed into one on-hand figure
    And the split between modes is visible
```

---

### S-005 — Location map or grid

| | |
|---|---|
| **As a** | new staff member |
| **I want** | a visual map of shelves and bins with their fill state |
| **So that** | I can find a location without memorising the room |

**Priority:** Could · **Status:** —

```gherkin
@pending
Feature: S-005 Location map

  Scenario: Shelves and bins render as a grid
    When staff open the location map
    Then each shelf is shown with its bins in sort order
    And each bin shows its block count

  Scenario: Empty bins are distinguishable
    Then bins holding no blocks are visually distinct from occupied bins

  Scenario: Drill through from the map
    When staff select a bin
    Then its blocks are listed
```
