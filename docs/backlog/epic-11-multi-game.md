# Epic 11 — Multi-Game Catalog

Prefix `GAM-`. Supporting games beyond Magic without rewriting intake, pricing or sync.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Phase 7.** SortSwift supports 26+ TCGs. This system supports one, and Scryfall is wired directly into CSV import and the search route. The work is less about adding games than about putting a seam where Scryfall currently sits.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| GAM-001 | Game registry with per-game ID sequences | Must | — |
| GAM-002 | Catalog provider interface with local cache | Must | — |
| GAM-003 | Pokémon support, including Japanese printings | Must | — |
| GAM-004 | Add a further game without code changes to intake | Should | — |
| GAM-005 | New set refresh | Should | — |
| GAM-006 | Per-game condition and finish vocabularies | Should | — |

---

### GAM-001 — Game registry with per-game ID sequences

| | |
|---|---|
| **As a** | shop owner who buys more than Magic |
| **I want** | every block, stock item and import to belong to a named game |
| **So that** | a Pokémon brick is never confused with a Magic one and IDs stay meaningful |

**Priority:** Must · **Status:** — · **Blocks:** every other story in this epic

```gherkin
@pending
Feature: GAM-001 Game registry

  Scenario: Games are configured, not hardcoded
    When the owner opens game settings
    Then the enabled games are listed with their code, name and catalog provider
    And a game can be enabled or disabled

  Scenario: Each game has its own ID sequence
    Given Magic and Pokémon are both enabled
    When a Magic block and a Pokémon block are created
    Then they are named "MTG-0001" and "PKM-0001"

  Scenario: Sequences are independent
    Given Magic blocks run to "MTG-0042"
    When the first Pokémon block is created
    Then it is named "PKM-0001"

  Scenario: Existing Magic data is unaffected
    Given blocks created before this change exist
    When the registry is introduced
    Then they are all attributed to Magic
    And their IDs are unchanged

  Scenario: A disabled game is hidden but not deleted
    Given Pokémon stock exists and Pokémon is disabled
    Then it no longer appears in intake choices
    And existing Pokémon inventory is still visible and sellable

  Scenario: Inventory is filterable by game
    When staff filter blocks or stock by game
    Then only that game's inventory is listed
```

**Schema notes (negotiable):** a `Game` table with code, name, provider key and enabled flag; `gameId` on `Block`, `StagingImport` and `StockItem`; generalise `BlockSequence` to one row per game, which its `prefix` column already anticipates.

---

### GAM-002 — Catalog provider interface with local cache

| | |
|---|---|
| **As a** | developer adding a game |
| **I want** | card lookup to go through one interface backed by a local cache |
| **So that** | adding a game means writing a provider, not editing intake, search and pricing |

**Priority:** Must · **Status:** — · **Depends on:** GAM-001 · **Supersedes:** C-004

```gherkin
@pending
Feature: GAM-002 Catalog provider interface

  Scenario: Intake resolves cards through the interface
    Given a staged row for any enabled game
    When it is enriched
    Then the lookup is routed to that game's provider
    And no intake code refers to Scryfall directly

  Scenario: Scryfall becomes one provider among several
    Given Magic is configured to use the Scryfall provider
    Then Magic lookups behave exactly as before this change

  Scenario: Results are normalised across providers
    Then every provider returns name, set code, collector number, rarity, finishes, languages, image URIs and prices in one shape

  Scenario: Lookups are cached locally
    Given a card has been looked up once
    When it is looked up again
    Then it is served from the cache with no outbound request

  Scenario: A provider outage falls back to the cache
    Given a provider is unreachable and the cache holds the needed cards
    When an import runs
    Then rows are enriched from the cache and no rows are dropped

  Scenario: A cache miss during an outage is reported, not guessed
    Given a provider is unreachable and a card is not cached
    Then the row imports with the data supplied in the CSV
    And it is flagged as unenriched
```

**Schema notes (negotiable):** `CatalogCard` keyed by provider plus provider card ID, holding the normalised fields and a fetched-at timestamp. This is **C-004**'s table, built provider-aware from the start — do not build a Scryfall-only cache first.

---

### GAM-003 — Pokémon support including Japanese printings

| | |
|---|---|
| **As a** | shop owner |
| **I want** | Pokémon to work end to end, Japanese printings included |
| **So that** | the second game proves the abstraction before we add twenty more |

**Priority:** Must · **Status:** — · **Depends on:** GAM-001, GAM-002

**Why Pokémon specifically:** it is the largest non-Magic market, and its Japanese printings stress the language and set-identity handling that a same-shaped second game would not.

```gherkin
@pending
Feature: GAM-003 Pokémon support

  Scenario: A Pokémon CSV imports end to end
    When staff upload a Pokémon scanner export
    Then rows are enriched from the Pokémon provider
    And they can be formalized into "PKM" blocks or sorted to stock

  Scenario: Japanese printings are distinct from English
    Given the same card exists as an English and a Japanese printing
    Then they resolve to different catalog cards
    And they stock as different SKUs

  Scenario: Pokémon-specific attributes are captured
    Then holo, reverse holo and first edition are representable
    And they participate in SKU identity

  Scenario: Mixed-game imports are handled
    Given a CSV containing both Magic and Pokémon rows
    When it is uploaded
    Then each row is routed to its game's provider
    And the resulting blocks are per-game rather than mixed

  Scenario: Pokémon inventory prices and lists
    Then Pokémon stock is priceable by rules and listable to channels like Magic stock
```

---

### GAM-004 — Add a further game without changing intake

| | |
|---|---|
| **As a** | developer |
| **I want** | a third game to require only a provider implementation and a registry row |
| **So that** | the abstraction is proven rather than assumed |

**Priority:** Should · **Status:** — · **Depends on:** GAM-003

**Target games**, in commercial order: Yu-Gi-Oh!, One Piece, Lorcana, Flesh and Blood, Digimon, Star Wars Unlimited.

```gherkin
@pending
Feature: GAM-004 Add a game without changing intake

  Scenario: A new game needs only a provider and a registry row
    When a developer adds a provider for a new game and enables it
    Then intake, staging, formalize, stock, pricing and export all work for it
    And no changes were needed in those modules

  Scenario: The seam is enforced
    Then no module outside the provider layer refers to a specific game or catalog vendor

  Scenario: A new game inherits the whole workflow
    Given a new game is enabled
    Then it gets its own block ID prefix, staging pipeline, stock items and reports without extra work
```

**Note:** this story is a regression test on **GAM-002**'s design as much as a feature. If it needs changes outside the provider, **GAM-002** was not finished.

---

### GAM-005 — New set refresh

| | |
|---|---|
| **As a** | shop owner on release weekend |
| **I want** | cards from a set released this morning to import today |
| **So that** | prerelease intake is not blocked by a stale local catalog |

**Priority:** Should · **Status:** — · **Depends on:** GAM-002

```gherkin
@pending
Feature: GAM-005 New set refresh

  Scenario: New sets appear without a deploy
    Given a new set was published by the provider today
    When the catalog refresh runs
    Then its cards are available for intake

  Scenario: A card missing from the cache is fetched live
    Given a card is not in the local cache
    When it is scanned or imported
    Then it is fetched from the provider and cached

  Scenario: Refresh is scheduled and manually triggerable
    Then the catalog refreshes on a schedule
    And staff can trigger it immediately before a prerelease

  Scenario: Refresh reports what changed
    When a refresh completes
    Then it reports new sets, new cards and updated cards
```

---

### GAM-006 — Per-game condition and finish vocabularies

| | |
|---|---|
| **As a** | staff member grading a non-Magic card |
| **I want** | the condition and finish options to match that game's conventions |
| **So that** | grades mean what buyers on that game's marketplaces expect |

**Priority:** Should · **Status:** — · **Depends on:** GAM-001

```gherkin
@pending
Feature: GAM-006 Per-game condition and finish vocabularies

  Scenario: Finishes differ by game
    Given Magic uses NONFOIL, FOIL and ETCHED
    And Pokémon uses normal, holo, reverse holo
    When staff grade a card
    Then only that game's finishes are offered

  Scenario: Conditions map to a common internal scale
    Given a game whose marketplace uses different grade names
    Then those names are shown to staff
    And they map to the internal NM to DMG scale for reporting

  Scenario: Channel export uses the channel's vocabulary
    When stock is exported to a channel
    Then conditions and finishes are translated into that channel's terms

  Scenario: Existing Magic vocabulary is unchanged
    Then Magic conditions and finishes behave exactly as before
```

**Note:** this generalises **PL-007**'s language mapping into a broader vocabulary mapping. Reuse the pattern rather than inventing a second one. Magic intake already implements the condition slice via **C-007** and [ADR-012](../../architecture/adr/012-condition-vocabulary-import-mapping.md) (`MANABOX_CONDITION_MAP`).
