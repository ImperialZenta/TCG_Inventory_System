# Epic 15 — Point of Sale & In-Store

Prefix `POS-`. Selling across the counter against the same inventory the marketplaces see.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Phase 10.** Nothing exists today. **POS-001** through **POS-003** are specified in full as the first shippable slice — a till that can take money and decrement stock correctly. The rest are headers: real enough to plan around, deliberately not detailed until the first slice is in use.

**Gated behind Epic 20.** A till without a cashier identity is not auditable, and a cash drawer without roles is not controllable. **ACC-001** and **ACC-002** are hard prerequisites.

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

---

## Detailed slice

### POS-001 — Cart and checkout against live stock

| | |
|---|---|
| **As a** | staff member serving a customer at the counter |
| **I want** | to build a cart and complete a sale that decrements the same inventory the marketplaces see |
| **So that** | an in-store sale cannot cause an online oversell |

**Priority:** Must · **Status:** — · **Depends on:** SKU-003, ACC-001

```gherkin
@pending
Feature: POS-001 Cart and checkout against live stock

  Scenario: Add an item and complete a sale
    Given a stock item with available quantity 3 priced at 4.25
    When the cashier adds one to the cart and completes the sale
    Then the cart total is 4.25
    And the stock item's on-hand drops to 2
    And a movement records -1 with reason SALE and the cashier as actor

  Scenario: Adding to the cart reserves the unit
    When an item is added to the cart
    Then it is reserved
    And channels are immediately offered one fewer

  Scenario: Abandoning the cart releases the reservation
    When the cashier voids the cart
    Then all reservations are released
    And no movement is written

  Scenario: An unavailable item cannot be added
    Given a stock item with available quantity 0
    When the cashier attempts to add it
    Then it is refused with an out-of-stock message

  Scenario: The cart price can be overridden with a reason
    Given the listed price is 4.25
    When the cashier sells it for 3.00 with reason "damaged corner"
    Then the sale records 3.00, the override and the reason

  Scenario: A completed sale becomes an order
    When a sale completes
    Then an order is created on the in-store channel
    And it appears in the unified order queue

  Scenario: Sale and decrement are atomic
    Given the payment fails
    Then no stock is decremented
    And the reservation is retained so the cashier can retry
```

---

### POS-002 — Barcode and card scan to cart

| | |
|---|---|
| **As a** | cashier with a queue forming |
| **I want** | to add items by scanning rather than searching |
| **So that** | a five-card sale takes seconds |

**Priority:** Must · **Status:** — · **Depends on:** POS-001, SKU-007

```gherkin
@pending
Feature: POS-002 Barcode and card scan to cart

  Scenario: Scanning a SKU barcode adds the item
    Given a stock item carries a printed SKU barcode
    When the cashier scans it
    Then that exact item is added to the cart at its current price

  Scenario: Scanning the same code again increments the line
    When the cashier scans the same code twice
    Then the line quantity reads 2 rather than two separate lines appearing

  Scenario: An unknown code is reported
    When an unrecognised code is scanned
    Then the scanned value is shown with a not-found message
    And the cart is unchanged

  Scenario: A code for out-of-stock inventory is refused clearly
    Given the scanned item has zero available
    Then the refusal names the item rather than only the code

  Scenario: Manual search remains available
    Then the cashier can still find and add items by name
```

---

### POS-003 — Split tender and payment recording

| | |
|---|---|
| **As a** | cashier |
| **I want** | to take one sale across cash, card and store credit |
| **So that** | a customer can part-pay with a trade-in credit, which is how most trades actually settle |

**Priority:** Must · **Status:** — · **Depends on:** POS-001, POS-004

```gherkin
@pending
Feature: POS-003 Split tender

  Scenario: Split a sale across three tenders
    Given a sale totalling 50.00
    When the cashier takes 20.00 store credit, 20.00 card and 10.00 cash
    Then the sale completes
    And three payment records are written totalling 50.00

  Scenario: An underpaid sale cannot complete
    Given a sale totalling 50.00 and tenders of 40.00
    When the cashier attempts to complete
    Then it is refused with the 10.00 shortfall shown

  Scenario: Cash overpayment computes change
    Given a sale totalling 47.50 and 50.00 cash tendered
    Then change due reads 2.50
    And the recorded payment is 47.50 with 2.50 change

  Scenario: Store credit cannot exceed the balance
    Given a customer's credit balance is 15.00
    When the cashier applies 20.00 of credit
    Then it is refused and the available balance is shown

  Scenario: Tenders are auditable
    Then each payment records its method, amount, cashier and time
```

---

## Headers

Specified at intent level only. Write full Gherkin when each is scheduled — the detailed slice above will have changed what these should say.

### POS-004 — Store credit issuance and redemption
**Must.** A customer credit balance that buylist payouts (**BUY-004**) write to and checkout (**POS-003**) draws from, with a full transaction history per customer and no way to alter a balance except through a recorded transaction. Needs a minimal customer record. Prerequisite for **BUY-004**.

### POS-005 — Multiple concurrent carts
**Should.** Several carts open at once so one customer fetching another card does not block the queue, with reservations held per cart and released on abandonment or timeout.

### POS-006 — Tax handling and exemptions
**Must.** Configurable rates, per-item taxability, exempt customers with a recorded exemption reference, and tax shown as a separate line on the sale and the receipt. Legally load-bearing — get the rules from the shop's accountant, not from this document.

### POS-007 — Receipts
**Should.** Printed and emailed receipts carrying line items, tender breakdown, tax, store credit balance after the sale, and the return policy. Reprintable from the order.

### POS-008 — Custom and non-catalog line items
**Should.** Ad-hoc lines for services, supplies and one-off items priced at point of sale, without requiring a stock item. Overlaps **SKU-008**; decide whether a custom line is a transient sale line or a real SKU before building either.

### POS-009 — Returns and refunds at the counter
**Must.** Return against an original order, restock to sellable or to a damaged location, refund to the original tender or to store credit, with partial returns supported. Must reconcile with **FUL-006** so channel returns and counter returns share one model.

### POS-010 — Till reconciliation and day close
**Should.** Opening float, expected against counted cash by tender type, variance recorded and attributed, day-close report by cashier.

### POS-011 — Self-service customer kiosk
**Could. Parked.** Customer-facing browse and search of live stock with in-store order placement. Revisit once **POS-001** through **POS-009** are in daily use.

### POS-012 — Event and tournament support
**Could. Parked.** Registration, check-in, entry fees through the till, prize pools paid in store credit. A distinct product area; do not start it inside this epic.
