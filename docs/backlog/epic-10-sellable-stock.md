# Epic 10 — Sellable Stock Inventory (dual model)

Prefix `SKU-`. The second inventory mode: individually sellable cards with a live quantity.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Phase 6.** This is the keystone of SortSwift parity. Pricing, channel sync, POS and buylist all need one authoritative answer to "how many of this exact card can I sell right now", and a chaos block cannot give it — a sealed brick's contents are not sellable until a picker physically pulls them.

## The dual model

| | Chaos bulk mode | Sorted stock mode |
|---|---|---|
| **Model** | `Block` + `CardLine` (Epics 1–4) | `StockItem` + `StockMovement` (this epic) |
| **Address** | `MTG-0007` position 14 | Shelf / bin / row |
| **Sellable individually** | No | Yes |
| **Good for** | Bulk, commons, unassessed trade-in, mystery feedstock | Singles worth an individual listing |

A physical card is in exactly one mode. **SKU-004** is the only bridge, and it is always explicit and audited. Nothing in this epic weakens the chaos block model; it sits beside it.

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

---

### SKU-001 — Stock item ledger with on-hand quantity

| | |
|---|---|
| **As a** | seller |
| **I want** | one row per distinct sellable card with a quantity and an append-only movement history |
| **So that** | there is a single authoritative answer to how many I hold, and I can prove how it got that way |

**Priority:** Must · **Status:** — · **Depends on:** V-005, ACC-001

**Identity.** A stock item is uniquely identified by game, catalog card ID, set code, collector number, finish, language and condition. Two cards differing in any one of those are different stock items. This tuple is the SKU.

```gherkin
@pending
Feature: SKU-001 Stock item ledger

  Scenario: A stock item is unique on its identity tuple
    Given a stock item exists for MTG "neo/0123" NONFOIL "en" NM
    When another unit of the same printing, finish, language and condition is received
    Then no second stock item is created
    And the existing item's on-hand quantity increases by one

  Scenario: A differing attribute creates a separate item
    Given a stock item exists for MTG "neo/0123" NONFOIL "en" NM
    When a FOIL copy of the same printing is received
    Then a second stock item is created

  Scenario Outline: Each attribute separates identity
    Given a stock item for MTG "neo/0123" NONFOIL "en" NM
    When a unit differing only in <attribute> is received
    Then a separate stock item is created

    Examples:
      | attribute        |
      | finish           |
      | language         |
      | condition        |
      | collector number |
      | game             |

  Scenario: Every quantity change writes a movement
    Given a stock item with on-hand 5
    When 2 units are received
    Then on-hand reads 7
    And a movement records +2, its reason, its actor and its time

  Scenario: On-hand is derivable from movements
    Then the sum of a stock item's movements equals its on-hand quantity

  Scenario: Movements are append-only
    Then no user action edits or deletes a movement
    And a correction is made by writing a compensating movement

  Scenario: Quantity cannot go negative
    Given a stock item with on-hand 2
    When a movement of -3 is attempted
    Then it is rejected
    And on-hand remains 2
```

**Schema notes (negotiable):**

- `StockItem` — `gameId`, `catalogCardId`, `setCode`, `collectorNumber`, `finish`, `language`, `condition`, `onHandQuantity`, `reservedQuantity`, `costBasisCents`, `marketPriceCents`, `locationId`, timestamps. Unique index on the identity tuple.
- `StockMovement` — append-only ledger per [ADR-004](../../architecture/adr/004-append-only-ledger-pattern.md).
- Money in integer cents ([ADR-003](../../architecture/adr/003-money-as-integer-cents.md)).
- `StockMovement` complements rather than replaces `InventoryEvent`: movements are the quantity ledger, events are the human-readable audit feed. Write both.

---

### SKU-002 — Sort staged cards to stock instead of a block

| | |
|---|---|
| **As a** | staff member reviewing a staged import |
| **I want** | to send some or all of it into sorted stock rather than into chaos blocks |
| **So that** | cards worth listing individually go straight to sellable inventory without being bagged first |

**Priority:** Must · **Status:** — · **Depends on:** SKU-001

```gherkin
@pending
Feature: SKU-002 Sort staged cards to stock

  Scenario: Send a whole import to stock
    Given a staging import with status PARSED holding 120 units
    When staff choose "sort to stock" and confirm
    Then stock items are created or incremented for all 120 units
    And no blocks are created
    And the import status becomes ASSIGNED

  Scenario: Split an import between both modes
    Given a staged import where 40 units are marked for stock and 280 for chaos
    When staff commit the import
    Then the 40 units become stock
    And the 280 units are formalized into blocks
    And the import total still reconciles to 320

  Scenario: A value threshold suggests the destination
    Given the sort threshold is 2.00
    When staff open the review page
    Then units priced at or above 2.00 default to stock
    And units below default to chaos
    And every default is overridable

  Scenario: Unpriced units default to chaos
    Given a unit has no price
    Then it defaults to chaos, because promoting one card later is cheaper than sorting a thousand now

  Scenario: The commit is atomic across both destinations
    Given the commit fails partway
    Then no stock items and no blocks are created
    And the import status is still PARSED

  Scenario: The destination is auditable
    Then an inventory event records how many units went to each mode
```

---

### SKU-003 — Reserve and release stock

| | |
|---|---|
| **As a** | seller listing on several channels at once |
| **I want** | stock committed to an order held back from what is available to sell |
| **So that** | two channels cannot sell the same physical card |

**Priority:** Must · **Status:** — · **Depends on:** SKU-001 · **Prerequisite for:** CHN-005

**Architecture:** implement via the reservation gatekeeper in [ADR-005](../../architecture/adr/005-reservation-and-availability-engine.md). Reservation expiry uses the worker from [ADR-006](../../architecture/adr/006-background-worker-pg-boss.md).

**Definition.** Available equals on-hand minus reserved. Channels are offered available, never on-hand. This one rule is what "never oversell" reduces to.

```gherkin
@pending
Feature: SKU-003 Reserve and release stock

  Scenario: A reservation reduces available but not on-hand
    Given a stock item with on-hand 5 and reserved 0
    When 2 units are reserved for an order
    Then on-hand reads 5, reserved reads 2 and available reads 3

  Scenario: Fulfilment converts a reservation into a decrement
    Given a stock item with on-hand 5 and reserved 2
    When the order ships
    Then on-hand reads 3, reserved reads 0 and available reads 3
    And a movement records -2 with reason SALE

  Scenario: Cancelling releases the reservation
    Given a stock item with on-hand 5 and reserved 2
    When the order is cancelled
    Then reserved reads 0 and available reads 5
    And on-hand is unchanged

  Scenario: Over-reserving is refused
    Given a stock item with on-hand 5 and reserved 4
    When 2 more units are requested
    Then the reservation is refused
    And reserved remains 4

  Scenario: Concurrent reservations cannot both win
    Given a stock item with available 1
    When two orders attempt to reserve it at the same time
    Then exactly one succeeds and the other is refused
    And available never goes below zero

  Scenario: Stale reservations expire
    Given a reservation has passed its hold window without being fulfilled
    When reservations are swept
    Then it is released and the release is recorded with reason EXPIRED
```

---

### SKU-004 — Promote cards from a chaos block to stock

| | |
|---|---|
| **As a** | staff member who found a valuable card in a bulk brick |
| **I want** | to move that card out of its block and into sellable stock in one action |
| **So that** | it can be listed and sold, and the two inventory modes never both claim it |

**Priority:** Must · **Status:** — · **Depends on:** SKU-001, P-009

**This is the only bridge between the two modes.** It must be atomic: the card leaves the block and enters stock in one transaction, or neither happens.

```gherkin
@pending
Feature: SKU-004 Promote a card from a chaos block to stock

  Scenario: Promote one card
    Given block "MTG-0007" holds "Lightning Bolt" NM at position 14
    When staff promote that card to stock
    Then the card line is removed from the block
    And a stock item for that printing, finish, language and condition gains one unit
    And a movement records +1 with reason PROMOTE and a reference to "MTG-0007"

  Scenario: The block renumbers after promotion
    Given "MTG-0007" held 50 cards and position 14 is promoted
    Then the block holds 49 cards at positions 1 to 49 with no gaps
    And pending pick items on other lists are adjusted, following the P-009 rules

  Scenario: Promotion is atomic
    Given the stock increment fails
    Then the card line is still in the block
    And no movement was written

  Scenario: No double-claiming
    Then the promoted unit is counted exactly once across both modes
    And a global quantity query returns the same total before and after promotion

  Scenario: Promotion carries cost basis
    Given the card line carries an allocated cost of 0.40
    When it is promoted
    Then the stock item's cost basis absorbs 0.40

  Scenario: A sealed block can be promoted from, with a warning
    Given "MTG-0007" is SEALED
    When staff promote a card from it
    Then they are warned that the bag must be opened and resealed
    And the promotion proceeds on confirmation

  Scenario: Promotion is reversible
    Given a card was promoted from "MTG-0007" in error
    When staff reverse the promotion
    Then the stock item decrements
    And the card returns to the block at the next available position
    And both movements remain in the ledger

  Scenario: A liquidated block cannot be promoted from
    Given "MTG-0007" has status LIQUIDATED
    Then promotion is refused

  Scenario: Promote several cards at once
    Given staff select 6 cards from "MTG-0007"
    When they promote the selection
    Then all 6 move in one transaction
    And the block renumbers once
```

---

### SKU-005 — Stock locations and transfers

| | |
|---|---|
| **As a** | staff member pulling a sold single |
| **I want** | each stock item to have a physical location I can walk to |
| **So that** | sorted stock is findable without opening every box |

**Priority:** Should · **Status:** — · **Depends on:** SKU-001

```gherkin
@pending
Feature: SKU-005 Stock locations and transfers

  Scenario: Stock reuses the existing location hierarchy
    Given shelf "A" and bin "A-01" exist
    When a stock item is assigned to "A-01"
    Then its location reads "A / A-01"

  Scenario: A finer address than a bin is supported
    When a stock item is given a row or slot within its bin
    Then the fuller address is shown on pick and search results

  Scenario: Transfer stock between locations
    Given a stock item sits in "A-01"
    When staff transfer it to "C-02"
    Then its location updates
    And a movement records the transfer with both locations

  Scenario: A partial transfer splits the location
    Given a stock item with on-hand 10 in "A-01"
    When staff transfer 4 units to "C-02"
    Then 6 units remain in "A-01" and 4 are in "C-02"
    And the total on-hand for the SKU is still 10

  Scenario: Reserved units cannot be transferred out from under an order
    Given a stock item with on-hand 5 and reserved 3 in "A-01"
    When staff attempt to transfer 4 units
    Then they are warned that 3 units are committed to orders
```

**Schema notes (negotiable):** if a SKU can sit in several locations, on-hand becomes a sum over per-location rows rather than a column. Decide this before **SKU-001** ships — retrofitting it is a migration across every consumer.

---

### SKU-006 — Cost basis and margin on stock

| | |
|---|---|
| **As a** | shop owner |
| **I want** | each stock item to carry what we paid alongside what it is worth |
| **So that** | margin is a fact rather than a guess, and pricing rules can price against real cost |

**Priority:** Must · **Status:** — · **Depends on:** V-005, V-003 · **Prerequisite for:** PRC-004

```gherkin
@pending
Feature: SKU-006 Cost basis and margin on stock

  Scenario: Cost carries in from intake
    Given a trade-in batch cost 180.00 and allocated 0.40 to a card
    When that card enters stock
    Then the stock item records a cost basis of 0.40

  Scenario: Mixed-cost receipts average
    Given a stock item holds 2 units at 0.40 and receives 3 units at 0.90
    Then on-hand reads 5
    And the weighted average cost basis reads 0.70

  Scenario: Margin is derived from cost and market
    Given a stock item with cost 0.70 and market price 2.10
    Then its margin reads 1.40, or 200 percent

  Scenario: A sale records the cost of goods sold
    Given a stock item with cost basis 0.70
    When one unit sells for 2.10
    Then the sale records revenue 2.10 and cost of goods 0.70

  Scenario: Zero-cost stock is distinguishable from unknown-cost stock
    Given one item was received free and another has no cost recorded
    Then the first reads 0.00 and the second reads unknown
    And margin reporting excludes unknown-cost items rather than treating them as free
```

---

### SKU-007 — Internal SKU and barcode

| | |
|---|---|
| **As a** | staff member at the till |
| **I want** | each stock item to have a scannable code |
| **So that** | selling a single is one scan instead of a search |

**Priority:** Should · **Status:** — · **Depends on:** SKU-001 · **Related:** B-007, POS-002

```gherkin
@pending
Feature: SKU-007 Internal SKU and barcode

  Scenario: A SKU code is generated on creation
    When a stock item is created
    Then it is assigned a unique human-readable SKU code
    And the code is stable for the life of the item

  Scenario: The code encodes as a barcode
    When staff print a label for a stock item
    Then it carries the SKU code as text and as a Code 128 or QR symbol

  Scenario: Scanning a code resolves the item
    When a scanner inputs a SKU code
    Then the matching stock item is resolved with its price, condition and location

  Scenario: Codes are not reused
    Given a stock item reached zero and was archived
    Then its SKU code is not issued to a different item

  Scenario: An unknown code is reported clearly
    When an unrecognised code is scanned
    Then the failure names the scanned value rather than failing silently
```

---

### SKU-008 — Sealed product and custom SKUs

| | |
|---|---|
| **As a** | shop owner |
| **I want** | to stock booster boxes, sleeves and shop-defined items alongside singles |
| **So that** | the system covers what the shop actually sells rather than only cards |

**Priority:** Should · **Status:** — · **Depends on:** SKU-001

```gherkin
@pending
Feature: SKU-008 Sealed product and custom SKUs

  Scenario: Create a sealed product
    When staff create a stock item of type SEALED with a name, game, set and cost
    Then it is stocked with a quantity and a location
    And it needs no catalog card reference

  Scenario: Create an accessory
    When staff create a stock item of type ACCESSORY named "matte sleeves, black"
    Then it is stocked and sellable
    And it needs no game or set

  Scenario: Card-only attributes are not demanded
    Given a sealed or accessory item
    Then condition, finish and language are not required

  Scenario: Non-card stock participates everywhere
    Then sealed and accessory items can be reserved, sold, counted, priced and reported like singles

  Scenario: Autopricing skips items with no market feed
    Given an accessory has no market price source
    When pricing rules run
    Then its manually set price is left alone
```

**Schema notes (negotiable):** add `StockItem.itemType` (`SINGLE`, `SEALED`, `ACCESSORY`, `CUSTOM`) and make the catalog reference and card attributes nullable. The identity tuple becomes type-dependent, so validate it per type rather than with one unique index across all columns.

---

### SKU-009 — Stock browser and adjustments

| | |
|---|---|
| **As a** | staff member |
| **I want** | to browse, search and correct sorted stock |
| **So that** | the ledger can be inspected and fixed by a human, not only written to by the system |

**Priority:** Must · **Status:** — · **Depends on:** SKU-001

```gherkin
@pending
Feature: SKU-009 Stock browser and adjustments

  Scenario: Browse stock with the key figures
    When staff open the stock browser
    Then each item shows name, set, finish, language, condition, location, on-hand, reserved, available, cost and price

  Scenario: Search and filter
    When staff search by name and filter by game, set, condition or location
    Then only matching items are listed with a result count

  Scenario: Adjust a quantity with a reason
    Given a stock item with on-hand 5
    When staff adjust it to 4 with reason DAMAGE
    Then on-hand reads 4
    And a movement records -1 with that reason and the acting user

  Scenario: An adjustment cannot be made without a reason
    When staff attempt an adjustment with no reason
    Then it is refused

  Scenario: Inspect the movement history
    When staff open a stock item's history
    Then every movement is listed newest first with delta, reason, actor, reference and time

  Scenario: A zero-quantity item is retained
    Given a stock item reaches on-hand 0
    Then it is retained with its history rather than deleted
    And it is hidden from the default view
```

---

### SKU-010 — Scale to 100,000 stock items

| | |
|---|---|
| **As a** | shop owner with a large catalogue |
| **I want** | the system to stay responsive at a hundred thousand SKUs |
| **So that** | growth does not force a migration to different software |

**Priority:** Should · **Status:** — · **Depends on:** SKU-001, SKU-009

```gherkin
@pending
Feature: SKU-010 Scale to 100,000 stock items

  Scenario: The browser stays responsive at scale
    Given 100000 stock items exist
    When staff open the stock browser
    Then the first page renders in under 2 seconds
    And results are paginated rather than fully materialised

  Scenario: Search stays responsive at scale
    Given 100000 stock items exist
    When staff search by card name
    Then results return in under 2 seconds

  Scenario: A bulk price update completes
    Given 100000 stock items exist
    When a bulk reprice runs across all of them
    Then it completes without exhausting memory or timing out
    And progress is reported while it runs

  Scenario: Movement history does not degrade the ledger
    Given a stock item has 5000 movements
    Then reading its on-hand quantity is not slower than for a new item
```

**Note:** the thresholds above are the acceptance bar, so a seeded performance test belongs with this story. Without measurement, "scales" is not testable and the story fails INVEST.
