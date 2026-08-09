# Epic 13 — Autopricing & Market Data

Prefix `PRC-`. Turning a market price into the price we actually charge, per channel, without hand-editing thousands of rows.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Phase 8.** Card lines now carry persisted market prices (**V-005**). Epic 13 adds scheduled refresh, rules, and per-channel pricing on top.

**Design stance.** SortSwift advertises 20+ rule steps. Step count is not the goal; a deterministic, explainable pipeline is. Every rule run must be able to answer "why is this card priced at 4.25" with the chain that produced it — that is **PRC-008**, and it is a Must, not polish.

**Architecture:** money in cents ([ADR-003](../architecture/adr/003-money-as-integer-cents.md)); scheduled refresh via worker ([ADR-006](../architecture/adr/006-background-worker-pg-boss.md)); price sources via registry ([ADR-008](../architecture/adr/008-provider-adapter-registry.md)).

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| PRC-001 | Multiple market price sources | Should | — |
| PRC-002 | Scheduled market price refresh | Must | — |
| PRC-003 | Rule engine with ordered steps | Must | — |
| PRC-004 | Cost-aware floors and margin rules | Must | — |
| PRC-005 | Price history | Must | — |
| PRC-006 | Per-channel pricing configuration | Must | — |
| PRC-007 | Bulk reprice | Must | — |
| PRC-008 | Rule tester and price explanation | Must | — |
| PRC-009 | Manual price override with protection | Should | — |

---

### PRC-001 — Multiple market price sources

| | |
|---|---|
| **As a** | seller |
| **I want** | market prices from more than one source with a defined precedence |
| **So that** | one provider's gap or outage does not leave inventory unpriced |

**Priority:** Should · **Status:** — · **Depends on:** V-005, GAM-002

```gherkin
@pending
Feature: PRC-001 Multiple market price sources

  Scenario: Sources are tried in configured precedence
    Given sources are ordered as primary then secondary
    When a card is priced
    Then the primary source is used if it has a price
    And the secondary is used only when the primary does not

  Scenario: The source is recorded with the price
    Then each price records which source produced it and when

  Scenario: An outage falls through rather than failing
    Given the primary source is unreachable
    When a refresh runs
    Then prices come from the secondary
    And the fallback is reported in the refresh summary

  Scenario: No source leaves the price unknown
    Given no source has a price for a card
    Then its market price is null rather than zero
    And it is listed in an unpriced report
```

---

### PRC-002 — Scheduled market price refresh

| | |
|---|---|
| **As a** | seller |
| **I want** | market prices refreshed automatically on a schedule |
| **So that** | listings track the market instead of freezing at the moment of intake |

**Priority:** Must · **Status:** — · **Depends on:** V-005, PRC-001

**Target:** the full holding refreshed at least daily; SortSwift's stated cadence is every 12 hours.

```gherkin
@pending
Feature: PRC-002 Scheduled market price refresh

  Scenario: The holding refreshes on schedule
    Given the refresh interval is 12 hours
    When the scheduled refresh runs
    Then every stock item and card line with a resolvable card is repriced
    And each records its new refresh timestamp

  Scenario: A refresh can be triggered manually
    When staff trigger a refresh
    Then it runs immediately without waiting for the schedule

  Scenario: A large refresh completes within its window
    Given 100000 priced items exist
    When a refresh runs
    Then it completes inside the refresh interval
    And it reports progress while running

  Scenario: A partial failure does not abort the run
    Given some lookups fail
    Then the successful items are updated
    And the failures are reported with their reasons

  Scenario: Repricing follows a market refresh
    Given autopricing rules are active
    When market prices change
    Then sell prices are recalculated from the new market values

  Scenario: Price age is visible
    Then each item shows when its market price was last refreshed
```

---

### PRC-003 — Rule engine with ordered steps

| | |
|---|---|
| **As a** | seller |
| **I want** | sell prices produced by an ordered chain of rules from the market price |
| **So that** | pricing policy is written once and applied consistently to everything |

**Priority:** Must · **Status:** — · **Depends on:** PRC-002 · **Core of this epic**

**Step types v1:** multiplier, fixed adjustment, condition multiplier, rarity or set override, floor, ceiling, rounding, and a fallback for unpriced cards.

```gherkin
@pending
Feature: PRC-003 Pricing rule engine

  Scenario: Steps apply in order
    Given a rule set of "multiply by 0.9" then "round up to 0.25"
    And a card with a market price of 10.00
    When pricing runs
    Then the sell price is 9.00

  Scenario: Order changes the result and the engine respects it
    Given a rule set of "round up to 0.25" then "multiply by 0.9"
    And a card with a market price of 10.10
    When pricing runs
    Then the sell price is 9.225 before final rounding, not 9.09
    And the engine applies the steps in the order written

  Scenario Outline: Condition multipliers apply per grade
    Given a condition multiplier step and a market price of 10.00
    When a <condition> card is priced
    Then its sell price is <price>

    Examples:
      | condition | price |
      | NM        | 10.00 |
      | LP        | 8.50  |
      | MP        | 7.00  |
      | HP        | 5.00  |
      | DMG       | 3.00  |

  Scenario: A set or rarity override takes precedence
    Given an override pricing set "neo" mythics at 1.1 times market
    When a mythic from "neo" is priced
    Then the override applies instead of the general multiplier

  Scenario: Rules are scoped by game
    Given separate rule sets for Magic and Pokémon
    Then each game's stock is priced by its own rule set

  Scenario: Rules can be reordered, disabled and versioned
    When staff reorder or disable a step
    Then subsequent runs reflect the change
    And the previous rule set version is retained

  Scenario: Pricing is deterministic
    Given the same inputs and the same rule set
    Then repeated runs produce the same price
```

---

### PRC-004 — Cost-aware floors and margin rules

| | |
|---|---|
| **As a** | shop owner |
| **I want** | prices floored at cost plus a minimum margin |
| **So that** | an automated rule cannot sell inventory at a loss while I am not watching |

**Priority:** Must · **Status:** — · **Depends on:** PRC-003, SKU-006

```gherkin
@pending
Feature: PRC-004 Cost-aware floors and margin rules

  Scenario: A price is lifted to the cost floor
    Given a card cost 2.00 and the minimum margin is 20 percent
    And the rule chain would produce 1.80
    When pricing runs
    Then the sell price is 2.40

  Scenario: An absolute floor applies
    Given the absolute minimum price is 0.25
    And the rule chain would produce 0.03
    Then the sell price is 0.25

  Scenario: A ceiling caps runaway prices
    Given a ceiling of 3 times market
    And the chain would produce 5 times market
    Then the price is capped at 3 times market

  Scenario: The floor is reported when it binds
    Given the floor raised a price above what the market suggests
    Then the item is flagged as priced above market
    And it appears in a report of floor-bound items

  Scenario: Unknown cost does not silently disable the floor
    Given a card has no recorded cost
    When the margin floor would apply
    Then the absolute floor applies instead
    And the item is flagged as unknown cost
```

---

### PRC-005 — Price history

| | |
|---|---|
| **As a** | shop owner |
| **I want** | every price change retained with its cause |
| **So that** | I can explain a price to a customer and see whether a rule change helped |

**Priority:** Must · **Status:** — · **Depends on:** PRC-003

```gherkin
@pending
Feature: PRC-005 Price history

  Scenario: Every change is recorded
    When an item's sell price changes
    Then a history row records the old price, the new price, the cause and the time

  Scenario Outline: The cause is attributed
    When a price changes because of <cause>
    Then the history row records that cause

    Examples:
      | cause              |
      | market refresh     |
      | rule set change    |
      | manual override    |
      | bulk reprice       |

  Scenario: History is charted over time
    When staff view an item's price history
    Then market price and sell price are shown over the selected range

  Scenario: History survives the item reaching zero
    Given a stock item's quantity reached zero
    Then its price history is retained

  Scenario: A no-op run writes no history
    Given a reprice produces the same price
    Then no history row is written
```

---

### PRC-006 — Per-channel pricing configuration

| | |
|---|---|
| **As a** | seller on several marketplaces |
| **I want** | a different price rule set per channel |
| **So that** | each channel's fees and competition are priced in rather than averaged away |

**Priority:** Must · **Status:** — · **Depends on:** PRC-003, CHN-001

```gherkin
@pending
Feature: PRC-006 Per-channel pricing configuration

  Scenario: Each channel prices independently
    Given eBay adds a 13 percent fee uplift and the in-store channel does not
    And a card with a base sell price of 10.00
    When channel prices are computed
    Then eBay reads 11.30 and in-store reads 10.00

  Scenario: A channel inherits the base rule set by default
    Given a channel has no rules of its own
    Then it uses the base sell price

  Scenario: Channel rules layer onto the base
    Then a channel rule set applies after the base chain rather than replacing it

  Scenario: Each channel price is recorded separately
    Then price history is kept per channel

  Scenario: Channel floors apply
    Given a channel's minimum listing price is 1.00
    And the computed price is 0.40
    Then the channel price is 1.00
    Or the item is withheld from that channel, per configuration
```

---

### PRC-007 — Bulk reprice

| | |
|---|---|
| **As a** | seller |
| **I want** | to reprice a selection of inventory in one operation, previewing before committing |
| **So that** | a policy change reaches thousands of items without thousands of edits or a nasty surprise |

**Priority:** Must · **Status:** — · **Depends on:** PRC-003

```gherkin
@pending
Feature: PRC-007 Bulk reprice

  Scenario: Reprice a filtered selection
    Given staff have filtered to all Magic NM stock in set "neo"
    When they run a bulk reprice
    Then only those items are repriced

  Scenario: Preview before committing
    When staff request a bulk reprice
    Then a preview shows how many items change, the total value change and the largest movers
    And nothing changes until they confirm

  Scenario: A large reprice completes with progress
    Given 50000 items are selected
    When the reprice runs
    Then it completes without timing out
    And progress is reported

  Scenario: A completed reprice can be rolled back
    Given a bulk reprice completed 10 minutes ago
    When staff roll it back
    Then every affected item returns to its previous price
    And the rollback is itself recorded in history

  Scenario: Manual overrides are respected
    Given some selected items carry protected manual overrides
    Then those items are skipped
    And the count of skipped items is reported
```

---

### PRC-008 — Rule tester and price explanation

| | |
|---|---|
| **As a** | seller writing a pricing rule |
| **I want** | to test it on sample cards and see the step-by-step derivation of any price |
| **So that** | I find out what a rule does before it reaches my whole catalogue |

**Priority:** Must · **Status:** — · **Depends on:** PRC-003 · **Not polish — this is how the engine stays trustworthy**

```gherkin
@pending
Feature: PRC-008 Rule tester and price explanation

  Scenario: Test a rule set against samples
    Given a draft rule set and 10 sample cards
    When staff run the tester
    Then each sample shows its market price, each step's effect and the final price
    And nothing in live inventory changed

  Scenario: Explain a live price
    Given a stock item priced at 4.25
    When staff open its price explanation
    Then it shows the market price, the rule set version and each step with its effect

  Scenario: A binding floor or ceiling is called out
    Given a floor determined the final price
    Then the explanation names the floor as the binding constraint

  Scenario: Compare a draft against the live rule set
    Given a draft rule set and the live one
    When staff compare them across a sample
    Then the differences are shown side by side with the aggregate value impact

  Scenario: An unpriceable card explains why
    Given a card cannot be priced
    Then the explanation names the reason, such as no market price or no matching rule
```

---

### PRC-009 — Manual price override with protection

| | |
|---|---|
| **As a** | seller who knows something the rules do not |
| **I want** | to set a price by hand and stop automation from undoing it |
| **So that** | a signed card or a local shortage is not repriced to a generic market figure overnight |

**Priority:** Should · **Status:** — · **Depends on:** PRC-003

```gherkin
@pending
Feature: PRC-009 Manual price override

  Scenario: An override survives automated repricing
    Given a stock item has a protected manual price of 25.00
    When a scheduled reprice runs
    Then its price remains 25.00
    And it is reported as skipped because it is protected

  Scenario: Overrides are attributed
    Then the override records who set it, when and any note

  Scenario: An override can expire
    Given an override was set with a 30 day expiry
    When 30 days pass
    Then the item returns to rule-based pricing
    And the expiry is recorded in history

  Scenario: Removing an override reprices immediately
    When staff remove an override
    Then the item is repriced by the current rules

  Scenario: Overrides are listed for review
    Then all protected items are listable, with how long each has been protected
```
