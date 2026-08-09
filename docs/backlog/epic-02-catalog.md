# Epic 2 — MTG Catalog & Card Identity

Prefix `C-`. What makes one card distinguishable from another: Scryfall lookup, finish, language, condition.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md)

Epic 11 (**GAM-**) generalises this epic beyond MTG. Nothing here is thrown away — Scryfall becomes one provider behind an interface.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| C-001 | Scryfall integration | Must | Partial |
| C-002 | Finishes and languages | Must | Done |
| C-003 | Conditions NM–DMG | Must | Done |
| C-004 | Cache Scryfall data locally | Should | — |
| C-005 | Bulk line entry | Should | Done |
| C-006 | Set-level shortcuts | Could | — |
| C-007 | ManaBox condition grades map to TCGplayer-aligned internal scale | Must | Partial |

---

### C-001 — Scryfall integration

| | |
|---|---|
| **As a** | staff member intaking cards |
| **I want** | card name, set, collector number, image and price resolved from Scryfall |
| **So that** | a CSV row of minimal data becomes a fully identified printing without manual lookup |

**Priority:** Must · **Status:** Partial — enrichment and a search endpoint exist; there is no in-app picker UI (**I-002**), no cache (**C-004**)

```gherkin
@done
Feature: C-001 Scryfall integration

  Scenario: Enrich a CSV row by set and collector number
    Given a CSV row with set "neo" and collector number "0123" and no Scryfall ID
    When the import is parsed
    Then the row gains the Scryfall ID, canonical name and set code from Scryfall

  Scenario: Search cards by name through the API route
    When a client requests "/api/cards/search" with a query of at least 2 characters
    Then up to 20 matching printings are returned

  Scenario: A query shorter than 2 characters is rejected
    When a client requests "/api/cards/search" with a 1 character query
    Then no search is performed and an error is returned

  Scenario: A lookup failure does not fail the import
    Given Scryfall is unreachable
    When a CSV row is enriched
    Then the row is kept with the data supplied in the CSV
    And the import continues
```

```gherkin
@done
Scenario: The fetched price is persisted
  Given a row is enriched with a market price
  When the import is formalized
  Then the resulting card line carries that price
```

**Note:** price persistence is **V-005** (Done). Remaining C-001 gaps are picker UI (**I-002**) and cache (**C-004**).

---

### C-002 — Finishes and languages

| | |
|---|---|
| **As a** | seller |
| **I want** | foil, etched and non-foil printings and card language tracked separately |
| **So that** | a foil Japanese copy is never listed or picked as the English non-foil |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: C-002 Finishes and languages

  Scenario Outline: Every finish is representable
    When a card line is created with finish "<finish>"
    Then the finish is stored and displayed distinctly

    Examples:
      | finish  |
      | NONFOIL |
      | FOIL    |
      | ETCHED  |

  Scenario: Language defaults to English
    When a card line is created without a language
    Then its language is "en"

  Scenario: Finish and language separate otherwise identical cards
    Given two card lines for the same printing, one FOIL "en" and one NONFOIL "ja"
    When the block is exported
    Then they appear as two distinct listing rows
```

---

### C-003 — Conditions NM to DMG

| | |
|---|---|
| **As a** | staff member grading a trade-in |
| **I want** | the five standard condition grades available on every card |
| **So that** | what we list matches what the customer receives |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: C-003 Card conditions

  Scenario Outline: Every grade is representable
    When a card line is created with condition "<condition>"
    Then the condition is stored and displayed

    Examples:
      | condition |
      | NM        |
      | LP        |
      | MP        |
      | HP        |
      | DMG       |

  Scenario: Condition defaults to NM
    When a card line is created without a condition
    Then its condition is NM

  Scenario: Condition is carried from staging to the block
    Given a staged card graded LP
    When the import is formalized
    Then the resulting card line is LP
```

---

### C-004 — Cache Scryfall data locally

| | |
|---|---|
| **As a** | staff member importing a 5,000 card trade-in |
| **I want** | card data served from a local cache instead of one API call per row |
| **So that** | large imports finish quickly and keep working when Scryfall is slow or down |

**Priority:** Should · **Status:** — · **Depends on:** C-001

```gherkin
@pending
Feature: C-004 Local Scryfall cache

  Scenario: A repeated lookup is served from cache
    Given printing "neo/0123" has been looked up once
    When it is looked up again
    Then the result comes from the local cache with no outbound request

  Scenario: A large import mostly hits the cache
    Given a CSV of 5000 rows covering 800 distinct printings
    When it is imported after the cache is warm
    Then no more than 800 outbound lookups occur

  Scenario: Import continues when Scryfall is unreachable
    Given Scryfall is unreachable and the cache holds the needed printings
    When an import is parsed
    Then rows are enriched from the cache
    And no rows are dropped

  Scenario: Cached entries can go stale and refresh
    Given a cached printing older than the configured freshness window
    When it is looked up
    Then it is refetched and the cache is updated
```

**Schema notes (negotiable):** a `CatalogCard` table keyed by provider plus provider card ID, holding name, set, collector number, image URIs and a fetched-at timestamp. Epic 11 (**GAM-**) needs this same table, so build it provider-aware from the start.

---

### C-005 — Bulk line entry

| | |
|---|---|
| **As a** | packer bagging a brick of mixed commons |
| **I want** | to record a quantity of unidentified bulk as one line |
| **So that** | I do not scan 400 cards that are collectively worth a few dollars |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: C-005 Bulk line entry

  Scenario: A bulk line represents many cards without identification
    Given a card line flagged as a bulk line with a description and a quantity of 400
    When staff view the block
    Then the description is shown in place of a card name
    And the block's card count includes all 400

  Scenario: Bulk lines are excluded from listing export
    Given a block contains a bulk line
    When the Mana Pool listing CSV is exported
    Then the bulk line is not emitted as a sellable listing row
```

---

### C-006 — Set-level shortcuts

| | |
|---|---|
| **As a** | staff member intaking a sealed-set break or a full playset |
| **I want** | to add many cards from one set in a single action |
| **So that** | I am not repeating the same set selection dozens of times |

**Priority:** Could · **Status:** —

```gherkin
@pending
Feature: C-006 Set-level shortcuts

  Scenario: Pin a set for repeated entry
    Given staff are adding cards to an OPEN block
    When they pin set "neo"
    Then subsequent quick-adds resolve collector numbers against "neo" without reselecting the set

  Scenario: Add a range of collector numbers
    When staff enter collector numbers "1-10" for the pinned set
    Then 10 card lines are created for that set
    And any number that does not resolve is reported rather than silently skipped
```

**Depends on:** **I-005** (set + collector quick-add) — build that first; this is its bulk form.

---

### C-007 — ManaBox condition grades map to TCGplayer-aligned internal scale

| | |
|---|---|
| **As a** | staff member grading cards in ManaBox before CSV export |
| **I want** | `near_mint` and the other ManaBox grades to import as the TCGplayer-aligned internal codes |
| **So that** | staging, block detail, and Mana Pool listing export show the grade I set at the counter |

**Priority:** Must · **Status:** Partial — map + integration tests (upload, formalize, label); prod re-import pending before `@done`

**Architecture:** [ADR-012](../../architecture/adr/012-condition-vocabulary-import-mapping.md)

```gherkin
@pending
Feature: C-007 ManaBox condition import mapping

  Scenario: near_mint imports as Near Mint
    Given a ManaBox CSV row with Condition "near_mint"
    When the CSV is uploaded to staging
    Then the staged card has condition NM
    And the UI label is "Near Mint"

  Scenario: All seven ManaBox grades map per ADR-012
    Given CSV rows with mint, near_mint, excellent, good, light_played, played and poor
    When the CSV is parsed
    Then conditions are NM, NM, LP, MP, HP, HP and DMG respectively

  Scenario: Empty condition defaults to NM
    Given a CSV row with an empty Condition column
    Then the staged card has condition NM

  Scenario: Condition is unchanged through formalize
    Given a staged card with condition NM from near_mint
    When the import is formalized
    Then the block card line has condition NM
```

**Cross-ref:** **C-003** (internal enum), **I-009** (ManaBox upload), **GAM-006** (future multi-game vocab). Recovery on prod: re-upload CSV after deploy — no schema migration.
