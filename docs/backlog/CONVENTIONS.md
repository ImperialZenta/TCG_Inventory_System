# Backlog Conventions

How stories are written in this repo. Read before adding or editing any story.

---

## Document layout

| File | Contains |
|------|----------|
| [`docs/architecture/ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) | Runways, ADR index — read before cross-cutting stories |
| [`docs/BACKLOG.md`](../BACKLOG.md) | Index only — epic tables, IDs, priority, status, phase roadmap, build order |
| [`docs/backlog/CONVENTIONS.md`](CONVENTIONS.md) | This file |
| [`docs/backlog/PARITY-SORTSWIFT.md`](PARITY-SORTSWIFT.md) | SortSwift gap matrix and parity phasing |
| [`docs/backlog/INTAKE-STRATEGY.md`](INTAKE-STRATEGY.md) | Intake design context (scan → CSV → staging; dual-model promote path) |
| [`docs/backlog/AUDIT-2026-08.md`](AUDIT-2026-08.md) | Status corrections found by reading the code |
| `docs/backlog/epic-NN-*.md` | One file per epic: INVEST tables + Gherkin for every story in that epic |

Acceptance criteria never live in the index. The index links out.

---

## Priority key

| Priority | Meaning |
|----------|---------|
| **Must** | Required for the phase it sits in; phase is not done without it |
| **Should** | Valuable, ship in phase if capacity allows, otherwise next phase |
| **Could** | Nice to have; first thing cut |
| **Won't** | Explicitly out of scope for the named phase |

## Status key

| Status | Meaning |
|--------|---------|
| **Done** | Usable end-to-end in the app, by a user, through the UI |
| **Partial** | Code exists and runs, but the workflow is incomplete or read-only |
| **Schema** | Database model or helper functions only; no user-reachable workflow |
| **Stub** | Page or route placeholder only; no behaviour |
| **—** | Not started |

A story is only **Done** when every `@done` scenario in its Feature block passes by hand or in Vitest. If any scenario is `@pending`, the story is at most **Partial**. See [TESTING.md](../TESTING.md) for the two-agent workflow and spec compliance skill.

---

## INVEST definition of ready

A story may not move into a build phase until all six hold. Check them explicitly when writing.

| Letter | Test to apply |
|--------|---------------|
| **Independent** | Can this ship without another unbuilt story? If not, either merge the two into one slice (as **I-001 + I-002** are merged) or name the dependency in a **Depends on** line |
| **Negotiable** | Does the story describe an outcome rather than an implementation? Schema and UI choices belong in a **Schema notes** or **Design notes** block marked negotiable |
| **Valuable** | Does the *So that* clause name a real user or business outcome? "So that the data model is cleaner" fails |
| **Estimable** | Is the unknown work bounded? If a spike is needed first, split the spike out as its own story |
| **Small** | Can it land in one working session? If the Gherkin has more than about eight scenarios, split it |
| **Testable** | Every acceptance criterion is a Gherkin scenario with observable Then clauses. "Works well" and "is fast" are not criteria — state the threshold |

---

## Story format

Every story gets an INVEST table, then a Gherkin `Feature` block. Optional blocks follow.

````markdown
### I-023 — Undo formalize import

| | |
|---|---|
| **As a** | staff member who formalized an import too early |
| **I want** | to undo the entire formalize in one action |
| **So that** | I can fix my export file and re-upload without removing blocks one at a time |

**Priority:** Must · **Status:** Done · **Depends on:** I-012, B-010

```gherkin
@done
Feature: I-023 Undo formalize import
  ...
```

**Schema notes (negotiable):** ...

**Out of scope (v1):** ...

**Related:** **I-021**, **I-022**
````

---

## Gherkin house style

Rules, in order of how often they are broken.

1. **One `Feature` per story.** The Feature name is the story ID plus its title, so `Feature: I-023 Undo formalize import`. This makes the file greppable by ID.
2. **Tag every Feature or Scenario with `@done` or `@pending`.** `@done` means the behaviour is shipped and this text is now the regression spec. `@pending` means it is a specification of work not yet built. Tag at Feature level when the whole story is one or the other; tag individual scenarios when a story is partly shipped.
3. **`Given` is state, `When` is one action, `Then` is observable outcome.** If you need two `When` steps, you probably have two scenarios.
4. **Then clauses must be observable by a user or assertable in a test.** Name the UI text, the database row, the event type, the HTTP status. Not "the system handles it correctly".
5. **Write real values, not placeholders.** `Given a block "MTG-0007" with status SEALED`, not `Given a block with some status`.
6. **Cover the guards.** Every rule in a story's old bullet-list acceptance becomes a scenario, including the negative cases. A story with only a happy path is not ready.
7. **Use `Scenario Outline` with an `Examples` table** for the same rule across many values — lifecycle transitions and condition grades are the usual cases.
8. **Use `Background`** for setup shared by every scenario in the Feature, and nothing else.
9. **Never assert on implementation details** such as function names or Prisma calls. Assert on the block status, the event row, the rendered text.

### Tag reference

| Tag | Meaning |
|-----|---------|
| `@done` | Shipped; treat as regression spec |
| `@pending` | Specified, not built |
| `@parked` | Specified at header level only; not scheduled into a phase |
| `@dual` | Behaviour differs between chaos-block mode and sorted-stock mode; the scenario names which mode it covers |

### Worked example

```gherkin
@done
Feature: I-023 Undo formalize import

  Background:
    Given a staging import "trade-in-aug.csv" with status ASSIGNED
    And the import is linked to blocks "MTG-0007", "MTG-0008" and "MTG-0009"

  Scenario: Undo a formalized import whose blocks are all OPEN
    Given every linked block has status OPEN
    And no linked block has pick items
    When staff type "UNDO" in the staging danger zone and confirm
    Then blocks "MTG-0007", "MTG-0008" and "MTG-0009" are deleted
    And the staging import is deleted
    And an inventory event "staging.undo_formalize" is recorded carrying the three MTG IDs

  Scenario: Undo is blocked once any linked block is sealed
    Given block "MTG-0008" has status SEALED
    When staff open the staging review page
    Then the undo action is disabled
    And the page explains that "MTG-0008" is sealed and must use block lifecycle instead

  Scenario: Re-upload after undo allocates fresh IDs
    Given the import has been undone
    When staff upload the corrected CSV and formalize it
    Then the new blocks are numbered from "MTG-0010" onward
    And "MTG-0007" is not reused
```

---

## ID prefix registry

Prefixes are permanent. Never renumber a shipped story; retire it with a **Superseded by** line instead.

### Phase 1–5 core (MTG chaos blocks)

| Prefix | Epic |
|--------|------|
| `PL-` | Epic 0 — Platform & data |
| `B-` | Epic 1 — Block & location foundation |
| `C-` | Epic 2 — MTG catalog & card identity |
| `I-` | Epic 3 — Intake (chaos packing) |
| `P-` | Epic 4 — Picking & fulfillment |
| `A-` | Epic 5 — Block aging & analytics |
| `S-` | Epic 6 — Search & inventory browser |
| `V-` | Epic 7 — Pricing & valuation |
| `O-` | Epic 8 — Operations |

Epic 9 (I-015 QA hardening) has no prefix of its own; it reuses `I-`, `B-` and `PL-` IDs.

### Phase 6+ SortSwift parity

Three letters, so `P-011` and `PRC-011` never read alike.

| Prefix | Epic |
|--------|------|
| `SKU-` | Epic 10 — Sellable stock inventory (dual model) |
| `GAM-` | Epic 11 — Multi-game catalog |
| `SCN-` | Epic 12 — Scan intake parity |
| `PRC-` | Epic 13 — Autopricing & market data |
| `CHN-` | Epic 14 — Channel sync & marketplaces |
| `POS-` | Epic 15 — Point of sale & in-store |
| `BUY-` | Epic 16 — Buylist |
| `FUL-` | Epic 17 — Orders, shipping & fulfillment |
| `CON-` | Epic 18 — Consignment |
| `RPT-` | Epic 19 — Reporting & analytics |
| `ACC-` | Epic 20 — Access control & platform parity |

---

## The dual inventory rule

Two storage modes exist. Every story that touches inventory must say which mode it applies to, using the `@dual` tag where behaviour differs.

| Mode | Model | Address | Sellable individually |
|------|-------|---------|----------------------|
| **Chaos bulk** | `Block` + `CardLine` | `MTG-0007` position 14 | No — sealed brick, picked by position |
| **Sorted stock** | `StockItem` (Epic 10) | Shelf / bin / row | Yes — live quantity, syncs to channels |

A physical card is in exactly one mode. Moving between them is the **promote** path (**SKU-004**) and it is always an explicit, audited action — never implicit.

---

## Schema notes blocks

Where a story implies a database change, record it as a negotiable note rather than a decision:

```markdown
**Schema notes (negotiable):**

- `BlockStatus`: add `NEEDS_REPAIR`, **or** add `Block.pickHoldAt` + `pickHoldReason` without a new enum value
- `PickListStatus`: add `ON_HOLD`
```

No story in the backlog authorises a migration on its own. Migrations happen in the build, against the note, and the note is updated to record what was actually chosen.
