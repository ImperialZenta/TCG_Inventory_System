# Epic 0 — Platform & Data

Prefix `PL-`. Infrastructure, persistence, backup, and the test harness.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| PL-001 | Docker + PostgreSQL 16 stack | Must | Done |
| PL-002 | JSON backup export | Must | Done |
| PL-003 | Full backup restore | Must | Done |
| PL-004 | Danger zone deletes (4 tiers) | Should | Done |
| PL-005 | Mana Pool listing CSV export per block | Must | Done |
| PL-006 | Settings: shelves, bins, staging target | Must | Done |
| PL-007 | Language mapping (Scryfall ↔ Mana Pool) | Must | Done |
| PL-008 | Automated tests for remove and staging flows | Should | Done |
| PL-009 | Production store stack separated from development | Must | Done |

---

### PL-001 — Docker + PostgreSQL 16 stack

| | |
|---|---|
| **As a** | shop owner running this on a counter PC |
| **I want** | the whole system to start from one command with its database included |
| **So that** | I can run inventory without hiring someone to administer a server |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: PL-001 Docker + PostgreSQL 16 stack

  Scenario: First run brings up app and database together
    Given Docker Desktop is running and ".env" exists
    When the owner runs "docker compose up --build"
    Then the dev app is reachable at "http://localhost:3010"
    And a PostgreSQL 16 container is running with the schema applied
    # Port moved from 3000 to 3010 by PL-009: the production store owns 3000.

  Scenario: Inventory survives a restart
    Given blocks exist in the database
    When the owner runs "docker compose down" and then "docker compose up"
    Then all blocks are still present
    And the data was preserved in the "pgdata" volume

  Scenario: Explicit volume removal wipes data
    When the owner runs "docker compose down -v"
    Then the "pgdata" volume is removed
    And the next start has an empty database
```

---

### PL-002 — JSON backup export

| | |
|---|---|
| **As a** | shop owner about to make an irreversible change |
| **I want** | to download the entire inventory as one JSON file |
| **So that** | a mistake costs me minutes instead of a re-count |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: PL-002 JSON backup export

  Scenario: Download a full backup from Settings
    Given the database holds shelves, bins, blocks, card lines, languages, settings and staging imports
    When the owner requests "/api/backup/export"
    Then a JSON file downloads
    And it contains every shelf, bin, block, card line, language, setting and staging import
    And it carries a backup version field

  Scenario: Backup of an empty system is still valid
    Given the database has been fully reset
    When the owner downloads a backup
    Then the file is valid JSON with empty collections and a version field
```

---

### PL-003 — Full backup restore

| | |
|---|---|
| **As a** | shop owner who has just lost or corrupted data |
| **I want** | to restore a backup file over the current database |
| **So that** | I can get back to a known-good state without manual re-entry |

**Priority:** Must · **Status:** Done · **Depends on:** PL-002

```gherkin
@done
Feature: PL-003 Full backup restore

  Scenario: Restore replaces current data
    Given a valid backup file and existing inventory in the database
    When the owner uploads the file in Settings and types "RESTORE"
    Then the existing data is wiped
    And every record from the backup is recreated
    And a summary of restored counts is shown

  Scenario: Position-indexed blocks restore without foreign key errors
    Given a backup containing blocks whose card lines are position-indexed
    When the owner restores it
    Then all card lines are recreated against their parent block
    And no foreign key violation occurs

  Scenario: Confirmation is required
    Given a valid backup file is selected
    When the owner submits without typing "RESTORE"
    Then no data is changed
    And the form explains the confirmation requirement

  Scenario: An invalid file is rejected before any wipe
    When the owner uploads a file that is not a valid backup
    Then the upload is rejected with a parse error
    And existing inventory is untouched
```

---

### PL-004 — Danger zone deletes

| | |
|---|---|
| **As a** | shop owner resetting after a test run or a season |
| **I want** | tiered delete options with an explicit confirmation |
| **So that** | I can clear the right amount of data without dropping the whole database by accident |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: PL-004 Danger zone deletes

  Scenario Outline: Each tier deletes only its own scope
    Given inventory, staging imports and location configuration all exist
    When the owner selects the "<tier>" delete and types "DELETE"
    Then <removed> is removed
    And <kept> is kept

    Examples:
      | tier                  | removed                              | kept                          |
      | staging only          | staging imports and staging cards    | blocks, shelves and bins      |
      | operational inventory | blocks, card lines and staging       | shelves, bins and settings    |
      | full reset            | all inventory, locations and settings| nothing                       |

  Scenario: Deletes require typed confirmation
    When the owner triggers any danger zone delete without typing "DELETE"
    Then nothing is deleted
    And the confirmation requirement is shown

  Scenario: Sequences reset with a full reset
    Given blocks up to "MTG-0042" have been created
    When the owner performs a full reset
    Then the next block created is "MTG-0001"
```

---

### PL-005 — Mana Pool listing CSV export per block

| | |
|---|---|
| **As a** | seller listing a sealed brick |
| **I want** | to download that block's contents as a Mana Pool listing CSV |
| **So that** | I can price and upload the listing without retyping card data |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: PL-005 Mana Pool listing CSV export per block

  Scenario: Download a listing CSV for one block
    Given block "MTG-0007" holds 50 card lines
    When the seller requests "/api/blocks/MTG-0007/export-csv"
    Then a CSV downloads with Mana Pool listing columns
    And identical card, set, finish, language and condition combinations are aggregated into one row with a summed quantity

  Scenario: Languages are mapped to Mana Pool codes
    Given a card line with Scryfall language "ja"
    When the block is exported
    Then the CSV carries the Mana Pool language code for Japanese

  Scenario: Preview matches the download
    When the seller views the CSV preview on block detail
    Then the preview rows match the downloaded file
```

---

### PL-006 — Settings: shelves, bins, staging target

| | |
|---|---|
| **As a** | staff member configuring the shop's physical layout |
| **I want** | to create shelves and bins and set the default staging target count |
| **So that** | intake breaks bricks into the size we actually pack and assigns them to real locations |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: PL-006 Settings shelves, bins and staging target

  Scenario: Create a shelf and a bin
    When staff add shelf "A" and bin "A-01" under it in Settings
    Then both appear in the location list
    And bin "A-01" is selectable as a formalize destination

  Scenario: Suggested identifiers are offered
    Given shelves up to "A" and bins up to "A-01" exist
    When staff open the new shelf or bin form
    Then the next shelf code and bin ID are pre-suggested

  Scenario: Saving gives explicit feedback
    When staff save any settings change
    Then a save confirmation is shown
    And the new value is reflected on reload

  Scenario: Staging target count drives block size
    Given the default staging target count is set to 50
    When an import of 120 cards is broken down
    Then blocks are capped at 50 cards each
```

---

### PL-007 — Language mapping (Scryfall ↔ Mana Pool)

| | |
|---|---|
| **As a** | seller listing non-English cards |
| **I want** | Scryfall language codes translated to Mana Pool codes on export |
| **So that** | Japanese and other foreign printings list correctly instead of being rejected |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: PL-007 Language mapping

  Scenario Outline: Scryfall codes map to Mana Pool codes
    Given a card line with Scryfall language "<scryfall>"
    When the block is exported to a Mana Pool listing CSV
    Then the language column reads "<manapool>"

    Examples:
      | scryfall | manapool |
      | en       | EN       |
      | ja       | JA       |
      | de       | DE       |

  Scenario: Local-only languages are flagged rather than exported wrong
    Given a language marked local-only with no Mana Pool equivalent
    When the block is exported
    Then the row is not given a false language code
```

---

### PL-008 — Automated tests for remove and staging flows

| | |
|---|---|
| **As a** | developer shipping lifecycle changes |
| **I want** | integration tests for the full-redo and partial-removal staging paths |
| **So that** | regressions in remove, formalize and delete are caught before deploy |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: PL-008 Automated tests for remove and staging flows

  Scenario: The suite refuses to run against a non-test database
    Given DATABASE_URL does not contain "test"
    When "npm test" is run
    Then the suite aborts before touching the database

  Scenario: Coverage of the destructive paths
    When the suite runs against "tcg_inventory_test"
    Then undo formalize is covered including its sealed and pick-history guards
    And block removal is covered including partial remove, import unlock and re-formalize
    And block lifecycle transitions and their invalid cases are covered
    And the inventory event log is covered including payload retention after block delete
    And the atomic pick guard is covered
```

**Known gaps (tracked, not blocking Done):** Scryfall client, CSV parsing, backup restore, Mana Pool export format and analytics pages have no automated coverage.

---

### PL-009 — Production store stack separated from development

| | |
|---|---|
| **As a** | shop owner selling real cards while development continues on the same machine |
| **I want** | the store to run as its own production stack with an undeletable data volume, full-database backups, and migration-only upgrades |
| **So that** | dev work, test runs, and fat-fingered Docker commands can never dirty or destroy live store data |

**Priority:** Must · **Status:** Done · **Refs:** ADR-011, [docs/operations/STORE-OPERATIONS.md](../operations/STORE-OPERATIONS.md), `tests/pl009-prod-separation.test.ts`

```gherkin
@done
Feature: PL-009 Production store stack separated from development

  Scenario: Production and development stacks run side by side
    Given the external volume "tcg_prod_pgdata" exists
    When the owner runs "docker compose -f docker-compose.prod.yml up -d --build"
    Then the store is reachable at "http://localhost:3000" under compose project "tcg-prod"
    And the dev stack at "http://localhost:3010" uses a different project and volume
    And no dev compose command can address the store's database

  Scenario: Volume removal cannot delete store data
    Given the store stack is running with inventory in the database
    When the owner runs "docker compose -f docker-compose.prod.yml down -v"
    Then the "tcg_prod_pgdata" volume survives because it is external
    And the next start finds all store data intact

  Scenario: Strict migrations refuse the data-loss fallback on a non-empty store
    Given "MIGRATE_STRICT" is "true" in the production stack
    And the store database already holds application tables
    When "prisma migrate deploy" fails at container start
    Then the container exits with an error
    And "prisma db push --accept-data-loss" is never executed

  Scenario: Empty first boot is baselined once
    Given a brand-new external volume with no application tables
    When the production stack starts with "MIGRATE_STRICT" true
    Then the entrypoint baselines the schema once and marks existing migrations applied
    And subsequent starts apply only "prisma migrate deploy"

  Scenario: Backup script produces a restorable archive
    Given the store database holds inventory, orders, picks, users and events
    When the owner runs "scripts/backup-store.ps1"
    Then a pg_dump archive is written to "backups/store" with the timestamp and git ref in its name
    And restoring it with "scripts/restore-store.ps1" reproduces the full database including orders and users

  Scenario: Restore requires explicit confirmation
    When the owner runs "scripts/restore-store.ps1" without "-ConfirmRestore RESTORE"
    Then nothing is restored
    And the script explains the confirmation requirement
```

**Operational drill (one deferred And, not blocking Done):** Before the first `store-vN` prod upgrade, run a full `pg_restore` roundtrip (backup → restore → verify orders/users survive) on a post-backup drill and append a row to [SMOKE-LOG.md](../operations/SMOKE-LOG.md). See [STORE-OPERATIONS.md](../operations/STORE-OPERATIONS.md) upgrade runbook.
