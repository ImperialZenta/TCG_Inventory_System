# Epic 19 — Reporting & Analytics

Prefix `RPT-`. Answering the owner's questions about money, not just about counts.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Mostly parked.** Epic 5 already covers block aging well. What is missing is everything about money and sales, and none of it can be built before there is money and sales data to report on.

**Two hard prerequisites.** **V-005** must ship, or every currency figure reads zero. And sales data must exist, which means **POS-** or **FUL-** must be in real use — a sales report over an empty table is not worth building.

**RPT-005** is the exception and the only story here scheduled early: exporting what already exists costs little and is asked for constantly.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| RPT-005 | CSV export for any report | Should | — |
| RPT-001 | Sales report | Should | Parked |
| RPT-002 | Inventory valuation report | Should | Parked |
| RPT-003 | Margin report | Should | Parked |
| RPT-004 | Channel contribution report | Should | Parked |
| RPT-006 | SKU aging and dead stock | Should | Parked |
| RPT-007 | Scheduled report delivery | Could | Parked |
| RPT-008 | Owner dashboard | Could | Parked |

---

## Scheduled

### RPT-005 — CSV export for any report

| | |
|---|---|
| **As a** | shop owner talking to an accountant, an insurer or a tax authority |
| **I want** | to export any on-screen report as CSV |
| **So that** | I hand over a file instead of a screenshot, and I can work the numbers elsewhere |

**Priority:** Should · **Status:** — · **Related:** A-011

```gherkin
@pending
Feature: RPT-005 CSV export for any report

  Scenario: Export the report currently on screen
    Given the owner is viewing any report
    When they export it
    Then a CSV downloads containing the same rows and columns

  Scenario: The export honours the active filters
    Given filters are applied to the report
    Then the export contains only the filtered rows

  Scenario: The export records its own basis
    Then the file states the report name, the generation time and the filters used

  Scenario: A large report exports without timing out
    Given the report covers 100000 rows
    When it is exported
    Then the file is produced and streamed rather than assembled in memory

  Scenario: Money and dates are unambiguous
    Then currency amounts are plain decimal numbers with no symbols
    And dates are ISO 8601
```

---

## Parked

Specified at intent level so the parity matrix has somewhere to point. Each becomes buildable when its data source exists.

### RPT-001 — Sales report
**Blocked on:** sales data (**POS-** or **FUL-** in use). Units and revenue by period, game, set, condition and channel, with comparison against the previous period. The report the owner will actually open every morning.

### RPT-002 — Inventory valuation report
**Blocked on:** **V-005**, **SKU-006**. Total holding at cost and at market, split by storage mode, game, location and aging bucket. The insurance and year-end number. Note that chaos blocks and sorted stock must be valued on the same basis, or the total means nothing.

### RPT-003 — Margin report
**Blocked on:** **SKU-006**, sales data. Realised margin on what sold, and unrealised margin on what is held, by game, set and price band. Answers whether the buy rates in **BUY-002** are set correctly, which makes it the report that pays for itself.

### RPT-004 — Channel contribution report
**Blocked on:** **CHN-**, sales data. Revenue, units, fees and net contribution per channel, so a marketplace that generates volume at negative net margin becomes visible rather than flattering the top line.

### RPT-006 — SKU aging and dead stock
**Blocked on:** **SKU-001**. Epic 5's aging analysis applied to sorted stock: days since received, days since last sold, and capital in stock that has not moved. The sorted-mode counterpart to **A-003**.

### RPT-007 — Scheduled report delivery
**Blocked on:** at least one report worth receiving. Email a chosen report on a schedule, so the owner is informed without logging in.

### RPT-008 — Owner dashboard
**Blocked on:** **RPT-001** through **RPT-004**. One screen combining today's sales, holding value, margin trend and the things needing attention. Build it last, from reports that already exist and are trusted — a dashboard assembled before its underlying reports are trusted just multiplies doubt.

---

## Not pursued

Deck-building tools, inventory-aware deck lists, leaderboards and a public store locator are all listed under SortSwift's reporting and community tooling. They are customer-facing marketing surface with no inventory value, and they are not in this backlog. See the exclusions table in [`PARITY-SORTSWIFT.md`](PARITY-SORTSWIFT.md).
