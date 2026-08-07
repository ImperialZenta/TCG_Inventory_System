# Epic 17 — Orders, Shipping & Fulfillment

Prefix `FUL-`. One queue for every order, however it arrived, through to a tracked parcel.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Phase 11.** Today `ExternalOrder` and `ExternalOrderLine` exist in the schema, `/orders` is a stub page, and nothing imports or ships anything.

**Hard prerequisite: Phase 4 picking.** A unified order queue whose orders cannot be picked is a list. **P-001**, **P-003**, **P-004** and **P-009** must land before this epic starts. **CHN-007** supplies the channel orders, and **POS-001** supplies the counter ones.

**FUL-001** and **FUL-003** are the detailed slice — the queue itself, and the guarantee that shipping decrements stock exactly once.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| FUL-001 | Unified order queue | Must | — |
| FUL-003 | Fulfilment and stock deduction | Must | — |
| FUL-002 | Mana Pool order import | Must | — |
| FUL-004 | Shipping label purchase and printing | Must | — |
| FUL-005 | Tracking and status writeback | Must | — |
| FUL-006 | Returns handling | Must | — |
| FUL-007 | Packing slips and picklist integration | Should | — |
| FUL-008 | Multi-order batch fulfilment | Should | — |
| FUL-009 | Shipping cost and carrier reporting | Could | Parked |
| FUL-010 | Prepaid shipping wallet | Could | Parked |

---

## Detailed slice

### FUL-001 — Unified order queue

| | |
|---|---|
| **As a** | fulfilment lead |
| **I want** | every order from every source in one queue with a normalised status |
| **So that** | nothing is missed because it arrived on a channel nobody checked today |

**Priority:** Must · **Status:** — · **Depends on:** CHN-007, POS-001, P-001

```gherkin
@pending
Feature: FUL-001 Unified order queue

  Scenario: Orders from every source appear together
    Given orders exist from two marketplaces, the counter and a buylist payout
    When the lead opens the order queue
    Then all of them are listed with their source, reference, line count, value and status

  Scenario Outline: Channel statuses normalise to one vocabulary
    Given a channel reports an order as "<channelStatus>"
    Then the local order status reads <localStatus>

    Examples:
      | channelStatus     | localStatus |
      | awaiting shipment | READY       |
      | in progress       | PICKING     |
      | shipped           | SHIPPED     |
      | cancelled         | CANCELLED   |

  Scenario: The queue can be filtered and sorted
    When the lead filters by source, status or age
    Then only matching orders are listed
    And they can be sorted oldest first for prioritisation

  Scenario: Duplicate orders are merged rather than double-picked
    Given the same channel order was ingested twice
    Then it appears once
    And the duplicate is recorded as merged

  Scenario: An order that cannot be fulfilled is flagged
    Given an order line matches no available stock
    Then the order is flagged as unfulfillable with the offending line named

  Scenario: A cancellation releases everything it held
    Given an order with reserved stock is cancelled
    Then its reservations are released
    And any open pick list for it is cancelled

  Scenario: The queue shows what needs attention first
    Then unfulfillable, oversold and ageing orders are surfaced above routine ones
```

---

### FUL-003 — Fulfilment and stock deduction

| | |
|---|---|
| **As a** | shop owner |
| **I want** | stock to decrement exactly once when an order actually ships |
| **So that** | inventory is neither double-counted nor quietly lost between the shelf and the parcel |

**Priority:** Must · **Status:** — · **Depends on:** FUL-001, SKU-003, P-004

**The rule:** reserve at order, decrement at ship. Never both, never neither.

```gherkin
@pending
Feature: FUL-003 Fulfilment and stock deduction

  Scenario: Shipping converts a reservation into a decrement
    Given an order reserving 2 units of a stock item with on-hand 5
    When the order is marked shipped
    Then on-hand reads 3, reserved reads 0
    And a movement records -2 with reason SALE and a reference to the order

  Scenario: Deduction happens once
    Given an order has already been marked shipped
    When it is marked shipped again
    Then no further deduction occurs

  Scenario: A partial shipment deducts only what shipped
    Given an order of 3 units of which 2 ship
    Then 2 units are deducted
    And 1 remains reserved against the outstanding line

  Scenario: A short line releases rather than deducts
    Given a line is resolved SHORT
    Then its reservation is released
    And no deduction occurs

  Scenario: Chaos-picked cards deduct from their block
    Given a line was picked from block "MTG-0007"
    When the order ships
    Then the card line is consumed and the block renumbers per P-009
    And no stock item is affected

  Scenario: Deduction is atomic with the status change
    Given the deduction fails
    Then the order is not marked shipped

  Scenario: Channels are updated after deduction
    When stock is deducted
    Then the affected items' channel quantities are updated in the next sync
```

---

## Headers

Specified at intent level. Write full Gherkin when scheduled.

### FUL-002 — Mana Pool order import
**Must.** The long-promised Phase 4 integration: pull orders from Mana Pool via the API into the unified queue, using the `MANAPOOL_EMAIL` and `MANAPOOL_API_TOKEN` variables already documented in Settings and the `ExternalOrder` models already in the schema. Effectively **CHN-007** for a specific channel; build it as an adapter, not as a special case.

### FUL-004 — Shipping label purchase and printing
**Must.** Buy and print labels from within the order, with tracked letter and parcel services, discounted rates where available, address validation, and customs declarations for international shipments. Needs a carrier integration decision before it can be estimated — that decision is its own spike.

### FUL-005 — Tracking and status writeback
**Must.** Store the tracking number on the order, push it and the shipped status back to the originating channel, and email it to the customer. Without writeback, marketplaces penalise the seller's metrics regardless of how fast the parcel actually moved.

### FUL-006 — Returns handling
**Must.** Accept a return against an order, restock to sellable or to a damaged location, refund to the original tender or to store credit, and write the outcome back to the channel. Must share one model with **POS-009**, so a card bought online and returned in store behaves the same as any other return.

### FUL-007 — Packing slips and picklist integration
**Should.** Generate a packing slip per order, and generate pick lists directly from the queue for one order or many, using the routing and position rules from **P-002**, **P-006** and **P-009**.

### FUL-008 — Multi-order batch fulfilment
**Should.** Pick several orders in one pass with the walk route computed across all of them, then sort into per-order piles at the packing bench. The main throughput win for an online-heavy shop, and the reason **P-002** routing exists.

### FUL-009 — Shipping cost and carrier reporting
**Could. Parked.** Shipping spend by carrier, service and destination, against revenue, to find where postage is eating the margin.

### FUL-010 — Prepaid shipping wallet
**Could. Parked.** A prepaid balance for label purchases. Only useful once **FUL-004** picks a carrier that offers it.
