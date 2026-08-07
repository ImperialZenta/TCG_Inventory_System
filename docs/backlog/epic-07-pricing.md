# Epic 7 — Pricing & Valuation

Prefix `V-`. What a card is worth, and what we paid for it.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md)

This epic is the foundation Epic 13 (**PRC-**) builds on. **V-005 must ship first** — an autopricing engine has nothing to price against while prices are discarded at formalize.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| V-005 | Persist market price through formalize | Must | — — **defect**, blocks Epic 13 |
| V-001 | Market prices from Scryfall | Should | Partial |
| V-002 | Block total value on seal and refresh | Should | — — corrected, see [audit](AUDIT-2026-08.md) |
| V-003 | Cost basis per block or batch | Could | — |
| V-004 | Chaos versus sort labor calculator | Could | — |

---

### V-005 — Persist market price through formalize

| | |
|---|---|
| **As a** | shop owner |
| **I want** | the market price fetched during intake to survive into the card line |
| **So that** | every value figure in the app stops reading zero |

**Priority:** Must · **Status:** — · **Type:** Defect

**The defect.** Prices are fetched during CSV parse in [`src/lib/manabox/csv-import.ts`](../../src/lib/manabox/csv-import.ts) and then lost twice: `StagingCard` has no `priceUsd` column, so the value is dropped at persist, and [`src/lib/staging/formalize.ts`](../../src/lib/staging/formalize.ts) hardcodes `priceUsd: null` and `imageUri: null` on every card line it creates.

**Consequence.** Every block created through the primary intake path has no price. The dashboard estimated value, the analytics capital-in-stale-blocks figure and the block detail total all sum to $0 against real inventory. Only backup-restored data carries prices. This makes **A-005**, **A-009**, **I-008**, **SKU-006** and all of Epic 13 unbuildable.

```gherkin
@pending
Feature: V-005 Persist market price through formalize

  Scenario: A fetched price survives into the card line
    Given a CSV row that Scryfall prices at 12.50
    When the import is parsed
    Then the staging card records 12.50
    When the import is formalized
    Then the resulting card line records 12.50

  Scenario: The image URI survives too
    Given a CSV row enriched with a card image URI
    When the import is formalized
    Then the card line carries that image URI

  Scenario: The price is finish-aware
    Given a printing priced at 4.00 non-foil and 22.00 foil
    And the CSV row is FOIL
    Then the persisted price is 22.00

  Scenario: A missing price is null, not zero
    Given Scryfall returns no price for a printing
    Then the card line's price is null
    And value totals exclude it rather than counting it as 0.00

  Scenario: Block value is the sum of its lines
    Given block "MTG-0007" holds lines totalling 412.50
    When the owner views the block
    Then its value reads 412.50

  Scenario: The dashboard shows a non-zero holding
    Given priced inventory exists
    When the owner opens the dashboard
    Then estimated value is greater than zero

  Scenario: Existing unpriced inventory can be backfilled
    Given blocks created before this fix hold card lines with null prices
    When staff run a price backfill
    Then those lines are priced from the catalog
    And lines that cannot be resolved are reported rather than silently skipped
```

**Schema notes (negotiable):** add `priceUsd` and `imageUri` to `StagingCard` so the parse-time fetch has somewhere to land, then carry both through formalize. An alternative is to re-fetch at formalize, but that repeats thousands of lookups per import and makes the price reflect formalize time rather than intake time. The first option is preferred, and **C-004**'s catalog cache would make either cheap.

**Related:** **C-001** (where the fetch happens), **A-005**, **A-009**, **I-008**, **SKU-006**, all of **PRC-**.

---

### V-001 — Market prices from Scryfall

| | |
|---|---|
| **As a** | seller |
| **I want** | current market prices attached to the cards I hold |
| **So that** | valuation and listing prices start from a real number |

**Priority:** Should · **Status:** Partial — fetched at intake only, then discarded (**V-005**), and never refreshed

```gherkin
@done
Feature: V-001 Market prices from Scryfall

  Scenario: A price is fetched during intake
    Given a CSV row is enriched from Scryfall
    Then a USD price for the row's finish is retrieved

  Scenario: Unpriced printings do not fail the import
    Given Scryfall returns no price
    Then the row still imports
```

```gherkin
@pending
Feature: V-001 Price freshness

  Scenario: Prices can be refreshed after intake
    Given block "MTG-0007" was priced 40 days ago
    When staff refresh prices for the block
    Then every resolvable card line is repriced from the current market
    And the refresh time is recorded

  Scenario: Price age is visible
    Then each price shows how old it is, so a stale valuation is obvious
```

**Note:** scheduled refresh across the whole holding is **PRC-002**. This story only covers on-demand refresh of what is in front of the user.

---

### V-002 — Block total value on seal and refresh

| | |
|---|---|
| **As a** | shop owner |
| **I want** | a block's total value recorded when it is sealed and refreshable afterwards |
| **So that** | I know what a brick was worth when it was packed and what it is worth now |

**Priority:** Should · **Status:** — · **Blocked by:** V-005

```gherkin
@pending
Feature: V-002 Block total value

  Scenario: Value is snapshotted at seal
    Given block "MTG-0007" holds cards totalling 412.50
    When it is sealed
    Then a sealed-value snapshot of 412.50 is recorded against the block

  Scenario: Current value is computed live
    Then the block's current value is the sum of its lines' current prices

  Scenario: Both figures are shown together
    When the owner views the block
    Then sealed value, current value and the difference are shown

  Scenario: A refresh updates current but not the snapshot
    When prices are refreshed
    Then current value changes
    And the sealed-value snapshot is unchanged
```

**Schema notes (negotiable):** `Block.sealedValueCents` plus `Block.valueRefreshedAt`. Store money as integer cents, not floats — `CardLine.priceUsd` is currently a float, which is a rounding hazard the pricing engine will magnify. Consider migrating to cents as part of **V-005**.

---

### V-003 — Cost basis per block or batch

| | |
|---|---|
| **As a** | shop owner |
| **I want** | to record what we paid for a trade-in batch and carry it through to blocks |
| **So that** | margin is a real calculation rather than a guess |

**Priority:** Could · **Status:** — · **Related:** SKU-006

```gherkin
@pending
Feature: V-003 Cost basis per block or batch

  Scenario: Record what a batch cost
    When staff enter a total cost of 180.00 for an import at formalize
    Then the cost is recorded against the import

  Scenario: Cost allocates across the batch's cards
    Given the batch cost 180.00 and produced 320 cards
    When cost is allocated by market value
    Then each card line carries a share of the cost proportional to its price
    And the allocated shares sum to 180.00

  Scenario: Margin is derived
    Given a card with a cost share of 0.40 and a market price of 1.20
    Then its margin reads 0.80, or 200 percent

  Scenario: Bulk-purchased cards default to a flat per-card cost
    Given the batch has no per-card price data
    When cost is allocated evenly
    Then each card carries the same share
```

**Schema notes (negotiable):** cost belongs on the import and on the card line, so it survives promotion into sorted stock (**SKU-004**). Money in integer cents.

---

### V-004 — Chaos versus sort labor calculator

| | |
|---|---|
| **As a** | shop owner deciding how to handle a trade-in |
| **I want** | a comparison of chaos-packing cost against sorting cost for a given batch |
| **So that** | the sort-or-chaos decision is arithmetic rather than instinct |

**Priority:** Could · **Status:** — · **Related:** the sort decision in [`INTAKE-STRATEGY.md`](INTAKE-STRATEGY.md)

```gherkin
@pending
Feature: V-004 Chaos versus sort labor calculator

  Scenario: Compare the two approaches for a batch
    Given a batch of 5000 cards with a total market value of 1200.00
    And a labour rate and per-card handling times are configured
    When the owner runs the calculator
    Then it shows estimated labour cost for chaos packing and for full sorting
    And it shows the value recovery difference between the two

  Scenario: A recommendation follows
    Then the calculator states which approach nets more, and by how much

  Scenario: Assumptions are visible and adjustable
    Then the labour rate, handling times and expected sell-through are shown and editable
```
