# Epic 16 — Buylist

Prefix `BUY-`. Turning "what will you give me for these" into a priced, auditable intake.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Phase 10.** Nothing exists in software today. The trade-in *process* already exists and is documented in [`INTAKE-STRATEGY.md`](INTAKE-STRATEGY.md): staff scan at the counter with an external app, judge condition and authenticity by hand, agree a number, and the system only ever sees the resulting CSV. The offer itself is arithmetic done off-system.

**What this epic adds** is the offer, and the audit trail around it. The physical validation stays human — that decision is not revisited here.

**BUY-002** and **BUY-003** are the detailed slice: they turn the offer into a rule rather than a mental calculation, which is the part that costs money when it is inconsistent. The customer-facing portal (**BUY-001**) is deliberately *not* first — a portal that generates offers the shop then has to renegotiate is worse than no portal.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| BUY-002 | Rule-based offer calculation | Must | — |
| BUY-003 | Counter intake: review, grade, approve | Must | — |
| BUY-004 | Payout in cash or store credit | Must | — |
| BUY-005 | Approved buylist auto-enters inventory | Must | — |
| BUY-001 | Customer submission portal | Should | — |
| BUY-006 | Published buylist with wanted quantities | Should | — |
| BUY-007 | Submission notifications | Should | — |
| BUY-008 | Buylist reporting | Should | — |
| BUY-009 | Multi-language customer surface | Could | Parked |

---

## Detailed slice

### BUY-002 — Rule-based offer calculation

| | |
|---|---|
| **As a** | shop owner |
| **I want** | buy offers computed from rules rather than judged per card |
| **So that** | two staff give the same customer the same number, and margin is a policy instead of a mood |

**Priority:** Must · **Status:** — · **Depends on:** V-005, PRC-003

```gherkin
@pending
Feature: BUY-002 Rule-based offer calculation

  Scenario: A cash offer is a percentage of market
    Given the cash buy rate is 40 percent of market
    And a card with a market price of 10.00
    When the offer is calculated
    Then the cash offer is 4.00

  Scenario: Store credit pays better than cash
    Given the cash rate is 40 percent and the credit rate is 55 percent
    And a card with a market price of 10.00
    Then the cash offer is 4.00 and the credit offer is 5.50

  Scenario Outline: Condition scales the offer
    Given a card with a market price of 10.00 and a cash rate of 40 percent
    When a <condition> copy is offered
    Then the cash offer is <offer>

    Examples:
      | condition | offer |
      | NM        | 4.00  |
      | LP        | 3.40  |
      | MP        | 2.80  |
      | HP        | 2.00  |
      | DMG       | 1.20  |

  Scenario: Rates can vary by price band
    Given cards under 1.00 buy at 20 percent and cards over 20.00 buy at 60 percent
    Then each card's rate is chosen by its band

  Scenario: Per-set and per-game overrides apply
    Given a set is configured with its own buy rate
    Then cards from that set use it in preference to the general rate

  Scenario: Bulk pricing applies below a threshold
    Given cards under 0.25 are bought at a flat rate per hundred
    When 400 such cards are offered
    Then the offer is four times the per-hundred rate rather than a per-card calculation

  Scenario: A card we do not want is offered nothing, with a reason
    Given a card is on the do-not-buy list
    Then its offer is zero
    And the reason is shown to staff

  Scenario: The offer is explainable
    Then each line's offer shows its market price, the rate applied and why that rate was chosen

  Scenario: An unpriced card is flagged for manual pricing
    Given a card has no market price
    Then no offer is generated for it
    And it is flagged for a manual decision
```

---

### BUY-003 — Counter intake: review, grade, approve

| | |
|---|---|
| **As a** | staff member taking a trade at the counter |
| **I want** | to work through a submission line by line, adjusting grades and rejecting cards |
| **So that** | the agreed number reflects the cards actually in front of me |

**Priority:** Must · **Status:** — · **Depends on:** BUY-002

```gherkin
@pending
Feature: BUY-003 Counter intake review

  Scenario: Adjusting a grade recalculates the offer
    Given a submission line graded NM offering 4.00
    When staff regrade it to MP
    Then its offer recalculates to the MP rate
    And the submission total updates

  Scenario: Rejecting a line removes it from the offer
    When staff reject a line as a proxy
    Then it is excluded from the total
    And the rejection reason is recorded

  Scenario: A line can be manually overridden
    When staff override a line's offer with a reason
    Then the override and its reason are recorded against the line

  Scenario: The customer sees a clear total
    Then the submission shows its line count, cash total and store credit total

  Scenario: A submission can be part-accepted
    Given a customer accepts the offer on 30 of 40 lines
    When staff record the partial acceptance
    Then only the accepted lines proceed
    And the declined lines are recorded as declined, not silently dropped

  Scenario: Approval is attributed and locked
    When staff approve the submission
    Then the approving user and time are recorded
    And the approved lines and amounts can no longer be edited

  Scenario: A submission can be abandoned
    When the customer walks away
    Then the submission is closed as abandoned with no payout and no inventory change
```

---

### BUY-004 — Payout in cash or store credit

| | |
|---|---|
| **As a** | staff member completing a trade |
| **I want** | to pay the agreed amount in cash, store credit, or both, with a record |
| **So that** | the money leaving the drawer and the credit issued both reconcile at day close |

**Priority:** Must · **Status:** — · **Depends on:** BUY-003, POS-004

```gherkin
@pending
Feature: BUY-004 Buylist payout

  Scenario: Pay entirely in store credit
    Given an approved submission with a credit total of 55.00
    When staff pay it as store credit
    Then the customer's balance increases by 55.00
    And a credit transaction references the submission

  Scenario: Pay entirely in cash
    Given an approved submission with a cash total of 40.00
    When staff pay cash
    Then a cash payout of 40.00 is recorded against the till

  Scenario: Split the payout
    When staff pay 20.00 cash and the remainder as credit
    Then both records are written and together equal the agreed amount

  Scenario: A payout cannot exceed the approved amount
    When staff attempt to pay more than was approved
    Then it is refused

  Scenario: Payout requires approval first
    Given a submission has not been approved
    Then no payout can be recorded

  Scenario: Payout is attributed
    Then the payout records who made it and when
```

---

### BUY-005 — Approved buylist auto-enters inventory

| | |
|---|---|
| **As a** | staff member who just paid for a stack of cards |
| **I want** | those cards to enter inventory without being re-entered |
| **So that** | the cards we paid for are sellable immediately, in the right mode |

**Priority:** Must · **Status:** — · **Depends on:** BUY-004, SKU-002

```gherkin
@pending
Feature: BUY-005 Approved buylist enters inventory

  Scenario: Paid cards enter inventory
    Given a submission has been approved and paid
    When intake completes
    Then its lines become a staging import
    And they can be sorted to stock or formalized into chaos blocks

  Scenario: The sort decision applies
    Given the sort threshold is 2.00
    Then lines at or above it default to sorted stock and the rest to chaos

  Scenario: Cost basis carries from what we paid
    Given a line was bought for 4.00
    When it enters inventory
    Then its cost basis is 4.00

  Scenario: Rejected lines do not enter inventory
    Given some lines were rejected at review
    Then they are absent from the resulting intake

  Scenario: Inventory is traceable to the trade
    Then the resulting stock and blocks reference the submission
    And the submission shows where its cards ended up
```

---

## Headers

Specified at intent level. Write full Gherkin when scheduled.

### BUY-001 — Customer submission portal
**Should.** A customer-facing page where a customer enters or uploads what they want to sell and receives an indicative offer, subject to physical inspection. Deliberately after **BUY-002** and **BUY-003**: the offer engine has to be trusted internally before it is shown to the public, and every offer must be clearly provisional until staff have the cards in hand.

### BUY-006 — Published buylist with wanted quantities
**Should.** A public list of what the shop is buying, at what rate, with a wanted quantity per card that decrements as submissions are accepted, so the shop stops advertising for cards it now has forty of. Depends on **BUY-001** and **SKU-004**.

### BUY-007 — Submission notifications
**Should.** Email or chat notification to the customer on submission received, offer ready, approved and paid; internal notification to staff on new submissions. Keep the templates in one place — this is the shop's voice.

### BUY-008 — Buylist reporting
**Should.** Volume, spend, average margin against subsequent sale price, acceptance rate, and which sets are being offered most. Answers whether the buy rates are set correctly. Depends on **RPT-001**.

### BUY-009 — Multi-language customer surface
**Could. Parked.** SortSwift offers a multi-language buylist. Only worth building for a shop with a genuinely multilingual customer base — decide from the shop's own customers, not from feature parity.
