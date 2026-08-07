# Epic 5 — Block Aging & Analytics

Prefix `A-`. Which bricks are dead weight, and how much capital they hold.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md)

**Caveat on every value figure in this epic:** card prices are discarded at formalize (**V-005**), so all currency amounts currently render as $0 for real inventory. The counts and date arithmetic are correct; the money is not. Fix **V-005** before trusting or extending anything here.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| A-001 | Block age dashboard | Must | Done |
| A-002 | Aging buckets 0–30, 31–60, 61–90, 90+ | Must | Done |
| A-003 | Stale block list | Must | Done |
| A-004 | Block velocity | Must | — |
| A-005 | Capital tied up per block | Should | — — corrected, see [audit](AUDIT-2026-08.md) |
| A-006 | Location heat map of stale inventory | Should | — |
| A-007 | Aging alerts | Should | — |
| A-008 | Recommended actions on stale blocks | Should | Partial |
| A-009 | Value at pack versus current | Could | — |
| A-010 | Cohort view | Could | — |
| A-011 | Export aging report | Should | — |

---

### A-001 — Block age dashboard

| | |
|---|---|
| **As a** | shop owner |
| **I want** | a dashboard showing how long each block has sat without a pick |
| **So that** | I notice stagnant capital without walking the back room |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: A-001 Block age dashboard

  Scenario: Age is measured from the most recent activity
    Given block "MTG-0007" was packed 100 days ago and last picked 20 days ago
    When the owner views the dashboard
    Then its age reads 20 days

  Scenario: A never-picked block ages from its packed date
    Given block "MTG-0008" was packed 45 days ago and never picked
    Then its age reads 45 days

  Scenario: The dashboard summarises the whole holding
    Then total block count, total card count and an estimated value are shown
    And a preview of the stalest blocks is shown
```

---

### A-002 — Aging buckets

| | |
|---|---|
| **As a** | shop owner |
| **I want** | blocks grouped into 0–30, 31–60, 61–90 and 90+ day buckets |
| **So that** | I can see the shape of the problem rather than a list of dates |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: A-002 Aging buckets

  Scenario Outline: Blocks land in the right bucket
    Given a block whose age is <days> days
    When the owner views the aging breakdown
    Then it is counted in the "<bucket>" bucket

    Examples:
      | days | bucket |
      | 0    | 0-30   |
      | 30   | 0-30   |
      | 31   | 31-60  |
      | 90   | 61-90  |
      | 91   | 90+    |

  Scenario: Buckets account for every block
    Then the sum of the bucket counts equals the total block count
```

---

### A-003 — Stale block list

| | |
|---|---|
| **As a** | shop owner |
| **I want** | a list of every block past the stale threshold |
| **So that** | I have a concrete worklist rather than a chart |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: A-003 Stale block list

  Scenario: Blocks past the threshold are listed
    Given the stale threshold is 90 days
    And blocks aged 95 and 120 days exist alongside a block aged 10 days
    When the owner opens "/analytics"
    Then the two stale blocks are listed with age, location and card count
    And the 10 day old block is not listed

  Scenario: The threshold is configurable
    Given STALE_BLOCK_DAYS is set to 60
    Then blocks older than 60 days are treated as stale

  Scenario: An empty list is stated plainly
    Given no block is past the threshold
    Then the page says so rather than showing an empty table
```

---

### A-004 — Block velocity

| | |
|---|---|
| **As a** | shop owner |
| **I want** | picks per block per period |
| **So that** | I can tell a slow brick from a dead one before I liquidate the wrong thing |

**Priority:** Must · **Status:** — · **Depends on:** P-004, P-010

```gherkin
@pending
Feature: A-004 Block velocity

  Scenario: Picks per period per block
    Given block "MTG-0007" had 12 picks in the last 30 days
    When the owner views velocity
    Then it shows 12 picks over 30 days for that block

  Scenario: Blocks are rankable by velocity
    Then blocks can be sorted from fastest to slowest moving

  Scenario: A never-picked block reads zero rather than blank
    Given block "MTG-0008" has never been picked
    Then its velocity reads 0
```

---

### A-005 — Capital tied up per block

| | |
|---|---|
| **As a** | shop owner |
| **I want** | the money value sitting in each block and in each aging bucket |
| **So that** | I prioritise the expensive stagnant bricks, not merely the old ones |

**Priority:** Should · **Status:** — · **Blocked by:** V-005

```gherkin
@pending
Feature: A-005 Capital tied up per block

  Scenario: Value per block reflects real prices
    Given block "MTG-0007" holds cards whose persisted market prices total 412.50
    When the owner views the block
    Then its value reads 412.50

  Scenario: Capital in stale inventory is a real number
    Given stale blocks hold cards totalling 3200.00
    When the owner opens "/analytics"
    Then capital in stale blocks reads 3200.00 rather than 0.00

  Scenario: Cost basis is shown alongside market value
    Given the shop paid 180.00 for the contents of "MTG-0007"
    Then both cost basis and market value are shown, with the difference
```

**Note:** the current UI already renders these figures. They read $0 because no price is persisted. Fixing **V-005** turns this from broken to Partial; **SKU-006** adds cost basis.

---

### A-006 — Location heat map of stale inventory

| | |
|---|---|
| **As a** | shop owner |
| **I want** | stale inventory shown by shelf and bin |
| **So that** | I can see whether one corner of the room is where product goes to die |

**Priority:** Should · **Status:** — · **Depends on:** A-003

```gherkin
@pending
Feature: A-006 Location heat map of stale inventory

  Scenario: Stale count and value roll up by location
    When the owner views the location heat map
    Then each shelf and bin shows its stale block count and stale value
    And locations are visually ranked by severity

  Scenario: Drill through to the blocks
    When the owner selects a bin on the map
    Then the stale blocks in that bin are listed
```

---

### A-007 — Aging alerts

| | |
|---|---|
| **As a** | shop owner |
| **I want** | to be told when blocks cross 60, 90 and 180 days |
| **So that** | stagnation surfaces on its own instead of when I remember to look |

**Priority:** Should · **Status:** —

```gherkin
@pending
Feature: A-007 Aging alerts

  Scenario Outline: An alert is raised at each threshold
    Given block "MTG-0007" has just crossed <days> days without a pick
    When alerts are evaluated
    Then a <days> day alert is raised for that block

    Examples:
      | days |
      | 60   |
      | 90   |
      | 180  |

  Scenario: An alert fires once per threshold
    Given a 60 day alert has already been raised for "MTG-0007"
    When alerts are evaluated again the next day
    Then no duplicate 60 day alert is raised

  Scenario: Alerts are dismissible
    When the owner dismisses an alert
    Then it does not reappear for that block and threshold
```

---

### A-008 — Recommended actions on stale blocks

| | |
|---|---|
| **As a** | shop owner looking at a stale brick |
| **I want** | a suggested next action |
| **So that** | the analytics page ends in a decision rather than a number |

**Priority:** Should · **Status:** Partial — stale blocks are listed with context, but no action is recommended

```gherkin
@pending
Feature: A-008 Recommended actions on stale blocks

  Scenario Outline: A recommendation follows from age and value
    Given a stale block with value <value> and age <days> days
    When the owner views it
    Then the recommended action is "<action>"

    Examples:
      | value | days | action                         |
      | 15.00 | 120  | liquidate as bulk              |
      | 400.00| 120  | promote high-value cards to stock |
      | 400.00| 95   | reprice and relist             |

  Scenario: Acting on a recommendation is one click
    When the owner accepts a recommendation
    Then they are taken to the action, pre-filled for that block

  Scenario: Recommendations are advisory
    Then the owner can dismiss a recommendation without changing the block
```

---

### A-009 — Value at pack versus current

| | |
|---|---|
| **As a** | shop owner |
| **I want** | to compare what a block was worth when packed against what it is worth now |
| **So that** | I can see whether holding it cost me money |

**Priority:** Could · **Status:** — · **Depends on:** V-005, PRC-005

```gherkin
@pending
Feature: A-009 Value at pack versus current

  Scenario: Drift is shown per block
    Given "MTG-0007" was worth 500.00 when packed and is worth 430.00 now
    Then it shows a drift of -70.00, or -14 percent

  Scenario: Drift aggregates across the holding
    Then total drift across all blocks is shown for the selected period
```

---

### A-010 — Cohort view

| | |
|---|---|
| **As a** | shop owner |
| **I want** | blocks grouped by the week they were packed |
| **So that** | I can compare how different trade-in batches performed |

**Priority:** Could · **Status:** — · **Depends on:** A-004

```gherkin
@pending
Feature: A-010 Cohort view

  Scenario: Blocks group into packing-week cohorts
    When the owner opens the cohort view
    Then blocks are grouped by their packed week
    And each cohort shows block count, card count, value and picks to date

  Scenario: Cohorts are comparable over time
    Then sell-through by cohort is shown across successive weeks
```

---

### A-011 — Export aging report

| | |
|---|---|
| **As a** | shop owner talking to an accountant or an insurer |
| **I want** | to export the aging report |
| **So that** | I can hand over a file rather than a screenshot |

**Priority:** Should · **Status:** — · **Related:** RPT-005

```gherkin
@pending
Feature: A-011 Export aging report

  Scenario: Export the aging report as CSV
    When the owner exports the aging report
    Then a CSV downloads with one row per block carrying ID, location, status, card count, age, bucket, cost basis and market value

  Scenario: The export honours the current filter
    Given the owner has filtered to blocks older than 90 days
    Then the export contains only those blocks

  Scenario: The export states its own basis
    Then the file records the generation timestamp and the stale threshold used
```
