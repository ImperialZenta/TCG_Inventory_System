# Epic 3 — Intake (Chaos Packing)

Prefix `I-`. Getting cards from a customer's pile into addressable inventory.

Read [`INTAKE-STRATEGY.md`](INTAKE-STRATEGY.md) before implementing **I-001**, **I-002**, **I-006** or **I-014**.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md)

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| I-001 | Manual OPEN block creation | Should | Stub — bundle with I-002 |
| I-002 | Add cards to OPEN block via Scryfall search | Should | — — bundle with I-001 |
| I-003 | Seal block | Must | Done |
| I-004 | Intake session summary | Should | — |
| I-005 | Quick-add by set code + collector number | Should | — |
| I-006 | Camera card recognition in-app | Could | — — superseded by SCN-002 |
| I-007 | Alternate CSV sources | Could | Partial |
| I-008 | Duplicate detection for high-value cards | Should | — |
| I-009 | ManaBox CSV upload to staging | Must | Done |
| I-010 | Block breakdown by target count | Must | Done |
| I-011 | Review suggested blocks before commit | Must | Done |
| I-012 | Formalize staging into blocks | Must | Done |
| I-013 | Position-indexed intake | Must | Done |
| I-014 | Live in-app sequential intake | Could | — — superseded by SCN-002 |
| I-015 | Remove block by block ID | Must | Partial |
| I-016 | Pending staging queue | Should | Done |
| I-017 | Upload activity log + batched large import | Should | Done |
| I-018 | Formalize UX: default bin + compact table | Should | Done |
| I-019 | Bulk line add on OPEN block | Should | — |
| I-020 | Bulk seal blocks | Should | Done |
| I-021 | Safe partial block removal | Should | — |
| I-022 | Staging review reflects assignment state | Must | Done |
| I-023 | Undo formalize import | Must | Done |
| I-024 | Staging list status badges | Should | Done |
| I-025 | Upload success without auto-redirect | Should | Done |
| I-026 | Optional batch condition override on CSV upload | Could | — |
| I-027 | Staging pack order editor | Should | Done |

---

### I-001 + I-002 — Manual block creation with card add

Shipped as **one slice**. An empty OPEN block on its own cannot be sealed, exported or picked, so it has no standalone value and fails INVEST as two stories.

| | |
|---|---|
| **As a** | staff member handling a small batch with no scanner to hand |
| **I want** | to create a block and add identified cards to it directly in the app |
| **So that** | one-off batches and post-formalize corrections do not require a CSV round trip |

**Priority:** Should · **Status:** Stub · **Phase:** 3b, deferred until a concrete non-CSV need appears

```gherkin
@pending
Feature: I-001 and I-002 Manual block creation with card add

  Scenario: Create a block, fill it, seal it and export it
    When staff create a block with a label, bin and target count
    Then a new OPEN block is created with the next MTG ID
    When they search Scryfall for "Lightning Bolt" and add 4 copies in NM
    Then 4 card lines exist at consecutive positions
    When they seal the block
    Then it can be exported as a Mana Pool listing CSV

  Scenario: Positions are assigned automatically
    Given an OPEN block holding 10 cards
    When staff add a card with quantity 3
    Then card lines are created at positions 11, 12 and 13

  Scenario: Cards cannot be added to a sealed block
    Given block "MTG-0007" has status SEALED
    When staff attempt to add a card
    Then the action is rejected because the block is sealed

  Scenario: A picked printing can be chosen from several candidates
    Given "Lightning Bolt" has printings in multiple sets
    When staff search for it
    Then each printing is listed with its set, collector number and finish
    And the chosen printing's Scryfall ID is stored on the card line
```

**Acceptance framing:** done means create → add → seal → export, not "create empty block".

---

### I-003 — Seal block

| | |
|---|---|
| **As a** | packer who has finished filling a team bag |
| **I want** | to seal the block so its contents freeze |
| **So that** | the digital record cannot drift from a bag that is now physically taped shut |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: I-003 Seal block

  Scenario: Seal an OPEN block
    Given block "MTG-0007" has status OPEN and holds 50 cards
    When staff seal it
    Then its status becomes SEALED
    And its sealed date is set
    And a seal event is written

  Scenario: Unsealed blocks are visibly marked
    Given block "MTG-0008" has status OPEN
    When staff view the blocks list
    Then it carries an "Unsealed" label

  Scenario: Sealing is not offered twice
    Given block "MTG-0007" has status SEALED
    When staff view block detail
    Then no seal action is offered
```

---

### I-004 — Intake session summary

| | |
|---|---|
| **As a** | staff member finishing a trade-in |
| **I want** | a summary of what the session brought in |
| **So that** | I can reconcile against the customer's expectation before they leave |

**Priority:** Should · **Status:** —

```gherkin
@pending
Feature: I-004 Intake session summary

  Scenario: Summary after formalize
    Given an import of 320 cards was formalized into 7 blocks
    When staff view the session summary
    Then it shows total cards, block count, MTG ID range and the destination bins
    And it breaks the total down by condition and by set

  Scenario: Summary is retrievable later
    When staff reopen the import a week afterwards
    Then the same summary is available
```

---

### I-005 — Quick-add by set code and collector number

| | |
|---|---|
| **As a** | staff member fixing one mis-scanned card |
| **I want** | to add a card by typing its set code and collector number |
| **So that** | a single correction does not need a full search UI or a re-import |

**Priority:** Should · **Status:** — · **Depends on:** C-001

```gherkin
@pending
Feature: I-005 Quick-add by set and collector number

  Scenario: Add a card by set and number
    Given an OPEN block is open for editing
    When staff enter set "neo" and collector number "0123"
    Then the printing is resolved from Scryfall
    And a card line is added at the next position

  Scenario: An unresolvable combination is reported
    When staff enter set "zzz" and collector number "9999"
    Then no card line is created
    And the failure is explained without discarding the typed values

  Scenario: Condition and finish can be set at entry
    When staff quick-add a card and choose LP and FOIL
    Then the card line records LP and FOIL
```

---

### I-006 — Camera card recognition in-app

**Superseded by SCN-002.** Retained so the ID resolves. See [`epic-12-scan-intake.md`](epic-12-scan-intake.md).

**Priority:** Could · **Status:** — · **Superseded by:** SCN-002

---

### I-007 — Alternate CSV sources

| | |
|---|---|
| **As a** | staff member whose scanner app is not ManaBox |
| **I want** | exports from other scanner apps to import without conversion |
| **So that** | the choice of scanner app is not locked to one vendor |

**Priority:** Could · **Status:** Partial — any CSV carrying a Scryfall ID, or name plus set and collector number, already imports; there is no Delver Lens native format handler

```gherkin
@done
Feature: I-007 Generic CSV import

  Scenario: A generic CSV with Scryfall IDs imports
    Given a CSV with a Scryfall ID column and a quantity column
    When it is uploaded to staging
    Then every row is staged without conversion

  Scenario: A CSV with name, set and collector number imports
    Given a CSV without Scryfall IDs but with set and collector number
    When it is uploaded
    Then rows are enriched by lookup and staged
```

```gherkin
@pending
Feature: I-007 Named scanner app formats

  Scenario: A Delver Lens export imports directly
    Given a CSV in Delver Lens native export format
    When it is uploaded
    Then the columns are recognised without the user renaming headers

  Scenario: An unrecognised format explains what is missing
    Given a CSV with none of the recognised column sets
    When it is uploaded
    Then the error names which columns are required
```

---

### I-008 — Duplicate detection for high-value cards

| | |
|---|---|
| **As a** | staff member intaking a trade-in |
| **I want** | to be warned when the same high-value printing appears several times in one import |
| **So that** | I catch a double-scan or a counterfeit run before it enters inventory |

**Priority:** Should · **Status:** — · **Depends on:** V-005 (needs a persisted price to know what is high value)

```gherkin
@pending
Feature: I-008 Duplicate detection for high-value cards

  Scenario: Repeated high-value printings are flagged at review
    Given the high-value threshold is 50.00
    And an import contains 4 copies of a printing priced at 120.00
    When staff review the breakdown
    Then those rows are flagged as a high-value duplicate cluster

  Scenario: Ordinary duplicates are not flagged
    Given an import contains 40 copies of a printing priced at 0.10
    When staff review the breakdown
    Then no duplicate warning is raised

  Scenario: The flag is advisory
    When staff acknowledge the warning
    Then formalize proceeds unchanged
```

---

### I-009 — ManaBox CSV upload to staging

| | |
|---|---|
| **As a** | staff member who has scanned a trade-in |
| **I want** | to upload the scanner's CSV export into a staging area |
| **So that** | cards are captured for review before they touch live inventory |

**Priority:** Must · **Status:** Done — the primary intake path

```gherkin
@done
Feature: I-009 ManaBox CSV upload to staging

  Scenario: Upload creates a staging import
    When staff upload a ManaBox CSV of 320 rows
    Then a staging import is created with status PARSED
    And staging cards are created for the parsed rows
    And nothing has entered live inventory

  Scenario: Row errors are reported without failing the upload
    Given a CSV where 3 rows are malformed
    When it is uploaded
    Then the valid rows are staged
    And the 3 failures are listed with their row numbers

  Scenario: A file with only a header is rejected
    When staff upload a CSV with a header row and no data rows
    Then no staging import is created
    And the error explains that data rows are required
```

---

### I-010 — Block breakdown by target count

| | |
|---|---|
| **As a** | packer |
| **I want** | a staged import split into blocks of the configured target size |
| **So that** | each suggested block matches a bag I can physically fill |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: I-010 Block breakdown by target count

  Scenario: Cards split into capped blocks
    Given the staging target count is 50
    And an import holds 120 card units
    When the breakdown runs
    Then 3 suggested blocks are produced holding 50, 50 and 20 units

  Scenario: The cap is hard
    Given the staging target count is 50
    When the breakdown runs
    Then no suggested block holds more than 50 units

  Scenario: The target can be overridden per import
    When staff set a target of 100 for one import
    Then that import breaks into blocks of up to 100
    And the global default is unchanged
```

---

### I-011 — Review suggested blocks before commit

| | |
|---|---|
| **As a** | packer |
| **I want** | to see the proposed blocks and their contents before anything is created |
| **So that** | I catch a bad scan while it is still free to fix |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: I-011 Review suggested blocks before commit

  Scenario: Review shows the proposed breakdown
    Given an import with status PARSED
    When staff open the import review page
    Then each suggested block is listed with its card count and contents in position order

  Scenario: Nothing exists in inventory until formalize
    Given an import is under review
    Then no blocks appear on the blocks list
    And no card lines exist

  Scenario: Split warnings are surfaced
    Given a quantity group is split across two suggested blocks
    When staff review the breakdown
    Then the split is flagged so the packer can decide whether to re-pack
```

---

### I-012 — Formalize staging into blocks

| | |
|---|---|
| **As a** | packer who trusts the review |
| **I want** | one action that turns the suggested blocks into real blocks with IDs and bins |
| **So that** | the commit point is explicit and everything before it is reversible for free |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: I-012 Formalize staging into blocks

  Scenario: Formalize creates blocks and card lines
    Given an import with status PARSED breaking into 3 suggested blocks
    When staff formalize with a destination bin
    Then 3 OPEN blocks are created with sequential MTG IDs
    And card lines are created in position order
    And each staging card records the block it was assigned to
    And the import status becomes ASSIGNED

  Scenario: Formalize is atomic
    Given formalize fails partway through
    Then no blocks and no card lines remain from the attempt
    And the import status is still PARSED

  Scenario: An already formalized import cannot be formalized again
    Given an import with status ASSIGNED
    When staff attempt to formalize it
    Then the action is rejected

  Scenario: A formalize event is recorded
    When an import is formalized
    Then an inventory event records the import, the block count and the card total
```

---

### I-013 — Position-indexed intake

| | |
|---|---|
| **As a** | picker who will later pull a card from a sealed bag |
| **I want** | every physical card to occupy one numbered position in its block |
| **So that** | "position 14" locates a card in an unsorted brick without searching it |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: I-013 Position-indexed intake

  Scenario: Quantities expand to one unit per card
    Given a CSV row with quantity 4
    When the import is parsed
    Then 4 staging card units are created, each with quantity 1

  Scenario: Positions are unique and sequential within a block
    When an import is formalized
    Then each block's card lines occupy positions 1 to N with no gaps and no duplicates

  Scenario: Position 1 is the front card
    Given a block was packed from the review sheet in order
    Then the card at position 1 is the front card of the physical brick

  Scenario: CSV row order is preserved through expansion
    Given a CSV where row 5 has quantity 3
    When rows are expanded
    Then those 3 units stay adjacent and in row order
```

---

### I-014 — Live in-app sequential intake

**Superseded by SCN-002 and SCN-005.** Retained so the ID resolves. See [`epic-12-scan-intake.md`](epic-12-scan-intake.md).

**Priority:** Could · **Status:** — · **Superseded by:** SCN-002

---

### I-015 — Remove block by block ID

| | |
|---|---|
| **As a** | staff member who packed a brick wrongly |
| **I want** | to remove one block by typing its ID |
| **So that** | a single physical mistake can be undone without touching the rest of the import |

**Priority:** Must · **Status:** Partial — per-block delete works; what happens to the removed block's staging cards is unresolved (**I-021**)

```gherkin
@done
Feature: I-015 Remove block by block ID

  Scenario: Remove an eligible block
    Given block "MTG-0007" has status OPEN and no pick items
    When staff type "MTG-0007" into the confirmation field and submit
    Then the block and its card lines are deleted
    And a removal event carrying "MTG-0007" is written

  Scenario: A mismatched confirmation does nothing
    When staff type "MTG-0008" while removing "MTG-0007"
    Then nothing is deleted

  Scenario: Removing the last block of an import unlocks the staging import
    Given "MTG-0007" is the only remaining block of a formalized import
    When it is removed
    Then the staging import becomes deletable again
```

```gherkin
@pending
Scenario: The removed block's staging cards have a defined destiny
  Given a formalized import produced 3 blocks
  When one block is removed
  Then its staging cards are either re-formalizable, moved to a new block, or the removal is refused with a pointer to undo formalize
  And no cards are silently lost
```

**Related:** **I-021** resolves the pending scenario; **I-023** covers whole-scan redo.

---

### I-016 — Pending staging queue

| | |
|---|---|
| **As a** | staff member returning to the app |
| **I want** | a list of imports still waiting to be formalized, with review and delete on each |
| **So that** | half-finished trade-ins are not forgotten in a staging table nobody looks at |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: I-016 Pending staging queue

  Scenario: Pending imports are listed
    Given two imports have status PARSED
    When staff open "/staging"
    Then both are listed with filename, row count and upload time
    And each offers review and delete

  Scenario: Delete a pending import
    When staff delete a PARSED import
    Then the import and its staging cards are removed
    And a staging delete event is written

  Scenario: A formalized import cannot be deleted from the queue
    Given an import has status ASSIGNED with live blocks
    When staff attempt to delete it
    Then the action is refused with a pointer to undo formalize
```

---

### I-017 — Upload activity log and batched large import

| | |
|---|---|
| **As a** | staff member uploading a 5,000 card export |
| **I want** | progress detail during the upload and writes that do not time out |
| **So that** | a large trade-in completes and I can see what happened to every row |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: I-017 Upload activity log and batched import

  Scenario: A large import completes
    When staff upload a CSV of 5000 rows
    Then all valid rows are staged
    And database writes are batched rather than one statement per row

  Scenario: The activity log explains what happened
    When an upload finishes
    Then the log shows file name and size, rows parsed, rows staged, units expanded and any errors

  Scenario: Errors are attributable to rows
    Given some rows failed to parse
    Then the log names the failing source row numbers
```

---

### I-018 — Formalize UX: default bin and compact table

| | |
|---|---|
| **As a** | staff member formalizing a 40-block import |
| **I want** | one default bin applied to every block with per-block override |
| **So that** | I am not choosing a bin 40 times for cards going to the same shelf |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: I-018 Formalize default bin and compact table

  Scenario: The configured default bin is pre-selected
    Given a default formalize bin is set in Settings
    When staff open the formalize step
    Then every block is pre-assigned to that bin

  Scenario: Apply one bin to all blocks
    When staff choose a bin and select "apply to all"
    Then every block's destination changes to that bin

  Scenario: Override one block
    Given all blocks default to bin "A-01"
    When staff change block 3 to bin "B-02"
    Then only block 3 changes

  Scenario: Large imports render compactly
    Given an import breaking into 40 blocks
    When staff open the formalize step
    Then a compact summary is shown rather than 40 expanded panels

  Scenario: An invalid bin assignment is rejected
    When staff submit formalize with a bin that does not exist
    Then formalize is refused and nothing is created
```

---

### I-019 — Bulk line add on OPEN block

| | |
|---|---|
| **As a** | packer bagging mixed commons |
| **I want** | to add a bulk quantity to an OPEN block without identifying each card |
| **So that** | low-value cards get recorded and stored without scanning cost |

**Priority:** Should · **Status:** — · **Depends on:** I-001 + I-002 · **Phase:** 3b

```gherkin
@pending
Feature: I-019 Bulk line add on OPEN block

  Scenario: Add a bulk line
    Given an OPEN block is open for editing
    When staff add a bulk line described "mixed commons, 2015-2020" with quantity 400
    Then a card line flagged as bulk is created with that description and quantity
    And no Scryfall lookup is performed

  Scenario: Bulk lines are excluded from listing export
    Given a block holds a bulk line and 20 identified cards
    When the Mana Pool listing CSV is exported
    Then only the 20 identified cards are emitted

  Scenario: Bulk lines count toward block totals
    Then the block's card count includes the bulk quantity
```

---

### I-020 — Bulk seal blocks

| | |
|---|---|
| **As a** | packer who has just bagged 12 bricks |
| **I want** | to seal every block from one import or one bin at once |
| **So that** | I am not clicking seal twelve times |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: I-020 Bulk seal blocks

  Scenario: Seal every block from an import
    Given a formalized import produced 12 OPEN blocks
    When staff bulk seal by import
    Then all 12 become SEALED
    And a seal event is written for each

  Scenario: Seal every block in a bin
    Given bin "A-01" holds 5 OPEN blocks and 2 SEALED blocks
    When staff bulk seal by bin
    Then the 5 OPEN blocks become SEALED
    And the already-sealed blocks are untouched

  Scenario: Eligibility is shown before the action
    When staff open the bulk seal control
    Then it states how many blocks are eligible
    And it is disabled when none are
```

---

### I-021 — Safe partial block removal

| | |
|---|---|
| **As a** | packer who trusts the scan but packed one brick wrong |
| **I want** | to remove or repair one block without redoing the whole import |
| **So that** | I fix a physical mistake without re-scanning 5,000 cards |

**Priority:** Should · **Status:** — · **Decision needed:** which of the three outcomes below is the product behaviour

```gherkin
@pending
Feature: I-021 Safe partial block removal

  Scenario: Removing one block leaves the others intact
    Given a formalized import produced blocks "MTG-0007", "MTG-0008" and "MTG-0009"
    When "MTG-0008" is removed
    Then "MTG-0007" and "MTG-0009" are unchanged
    And their card lines are unchanged

  Scenario: The orphaned cards are visible
    When "MTG-0008" is removed
    Then the staging review shows its cards as unassigned
    And the unassigned count equals the removed block's card count

  Scenario: The orphaned cards can be re-formalized into a new block
    Given "MTG-0008" was removed leaving 50 unassigned staging cards
    When staff re-formalize the unassigned cards
    Then one new block is created holding those 50 cards
    And it receives the next MTG ID rather than reusing "MTG-0008"

  Scenario: No silent loss
    Then at every point, assigned card count plus unassigned card count equals the import total
```

**Related:** **I-022** already makes the orphan state visible; **I-023** is the whole-scan path.

---

### I-022 — Staging review reflects assignment state

| | |
|---|---|
| **As a** | staff member reviewing a formalized staging import |
| **I want** | to see which cards are in blocks and which are unassigned |
| **So that** | I trust the counts after a formalize, an undo or a partial remove |

**Priority:** Must · **Status:** Done

```gherkin
@done
Feature: I-022 Assignment visibility on formalized review

  Scenario: Per-block in-inventory counts
    Given a formalized import produced 3 blocks
    When staff open the review page
    Then each MTG block shows its in-inventory count against its card line count
    And each links to block detail

  Scenario: Unassigned cards are grouped and warned about
    Given one block of the import was removed
    When staff open the review page
    Then the orphaned cards are grouped by their suggested block
    And an orphan warning is shown because the unassigned count is above zero

  Scenario: Totals reconcile
    Then assigned plus unassigned equals the import total
    And the sum of card lines equals the assigned staging units
```

---

### I-023 — Undo formalize import

| | |
|---|---|
| **As a** | staff member who formalized an import too early |
| **I want** | to undo the entire formalize from the staging review page in one action |
| **So that** | I can fix my export file and re-upload without removing blocks one at a time |

**Priority:** Must · **Status:** Done — v1 is discard-only

**Eligibility:** import status is ASSIGNED; every linked block is OPEN; no linked block has pick items; at least one block is linked.

```gherkin
@done
Feature: I-023 Undo formalize import

  Background:
    Given a staging import with status ASSIGNED
    And the import is linked to blocks "MTG-0007", "MTG-0008" and "MTG-0009"

  Scenario: Undo a formalized import whose blocks are all OPEN
    Given every linked block has status OPEN and no pick items
    When staff type "UNDO" in the staging danger zone and confirm
    Then all three blocks are deleted
    And the staging import is deleted
    And an inventory event "staging.undo_formalize" is recorded carrying the three MTG IDs

  Scenario: Undo is blocked once any linked block is sealed
    Given block "MTG-0008" has status SEALED
    When staff open the staging review page
    Then the undo action is disabled with a reason naming the sealed block

  Scenario: Undo is blocked when pick history exists
    Given block "MTG-0008" has at least one pick item
    Then the undo action is disabled with a pick-history reason

  Scenario: Undo is not offered before formalize
    Given the import has status PARSED
    Then no undo action is shown, because delete is the correct action

  Scenario: Re-upload after undo allocates fresh IDs
    Given the import has been undone
    When staff upload the corrected CSV and formalize it
    Then the new blocks are numbered from "MTG-0010" onward
    And "MTG-0007" is not reused

  Scenario: The danger zone offers a backup first
    When staff view the undo section
    Then it links to "/api/backup/export"
```

**Out of scope (v1):** resetting the import to PARSED without deleting it; pick-time errors, which are **P-011**–**P-014**.

---

### I-024 — Staging list status badges

| | |
|---|---|
| **As a** | staff member on the Staging page |
| **I want** | each import to show its status before I open it |
| **So that** | I know what needs formalizing, what is committed, and whether undo is still available |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: I-024 Staging list status badges

  Scenario: A pending import is badged
    Given an import has status PARSED
    When staff view "/staging"
    Then it shows an "Awaiting formalize" badge
    And helper text notes it is not in inventory yet

  Scenario: A formalized import is badged with its blocks
    Given an import has status ASSIGNED with 3 linked blocks
    Then it shows a "Formalized" badge with the block count and MTG ID summary

  Scenario: Undo availability is shown on the list
    Given every linked block is OPEN and undo-eligible
    Then the row shows "Undo available"

  Scenario: A blocked undo shows its reason
    Given a linked block is sealed
    Then the row shows "Undo blocked" with the reason from the undo summary

  Scenario: The formalized section is not hidden
    Given at least one formalized import exists
    Then that section is expanded by default
```

---

### I-025 — Upload success without auto-redirect

| | |
|---|---|
| **As a** | staff member uploading a ManaBox CSV |
| **I want** | to stay on the Staging page after breakdown until I choose to continue |
| **So that** | I can read the activity log and confirm counts before the next step |

**Priority:** Should · **Status:** Done

```gherkin
@done
Feature: I-025 Manual navigation after upload

  Scenario: No timed redirect after upload
    When an upload succeeds
    Then the page does not navigate away on its own
    And a success banner shows the breakdown summary

  Scenario: Continue is the only way forward
    Then "Continue to review" is the only navigation offered to the import
    When staff choose it
    Then they land on the import review page

  Scenario: The pending list refreshes in place
    Then the new import appears in the pending list without leaving the page
```

---

### I-026 — Optional batch condition override on CSV upload

| | |
|---|---|
| **As a** | staff member uploading a CSV where every card is the same grade |
| **I want** | to override or set one condition for the whole import before formalize |
| **So that** | I am not re-exporting from ManaBox when the file omitted or mis-set condition |

**Priority:** Could · **Status:** — · **Deferred:** not part of **C-007**; per-row ManaBox map is sufficient for the primary path

```gherkin
@pending
Feature: I-026 Batch condition override on upload

  Scenario: Apply one condition to all staged rows
    Given a CSV has been parsed to staging
    When staff choose "All Near Mint" before formalize
    Then every staged card has condition NM

  Scenario: Override does not change finish or identity
    When staff apply a batch condition override
    Then scryfall ID, set, collector number and finish are unchanged
```

**Cross-ref:** **C-007** / ADR-012 (per-row map); **I-009** (upload entry point).

---

### I-027 — Staging pack order editor

| | |
|---|---|
| **As a** | packer reviewing a staging import |
| **I want** | to see every card in a suggested block and drag them into the order I will physically stack |
| **So that** | I can fix pack order without re-exporting the CSV or manually sorting after formalize |

**Priority:** Should · **Status:** Done · **Depends on:** I-010, I-011, I-013

```gherkin
@done
Feature: I-027 Staging pack order editor

  Scenario: Each suggested block shows an expandable pack-order list
    Given an import with status PARSED breaking into 2 suggested blocks
    When staff open the import review page
    Then each block lists its cards in position order with name, set, condition and finish

  Scenario: Save order persists positions within a block
    Given block 1 lists cards A at position 1, B at position 2 and C at position 3
    When staff move C to the top and save order for block 1
    Then C has position 1, A has position 2 and B has position 3

  Scenario: Formalize uses the saved pack order
    Given staff saved a custom pack order for block 1
    When they formalize the import
    Then the created block's card lines occupy positions 1 to N in that saved order

  Scenario: Reorder is refused after formalize
    Given an import with status ASSIGNED
    When staff attempt to save a new pack order
    Then the action is rejected

  Scenario: Recalculate resets pack order to CSV breakdown
    Given staff saved a custom pack order
    When they recalculate the breakdown and confirm
    Then positions revert to CSV row order for every block

  Scenario: Duplicate placement warnings reflect saved positions
    Given a quantity group spans positions 5 to 7 in block 1
    When staff reorder those copies and save
    Then the duplicate placement warning shows the updated position range
```

**Out of scope (v1):** reorder after formalize on OPEN blocks; move cards between suggested blocks; qty-group drag-as-clump.

**Smoke (2026-08-15):** PASS on dev (`localhost:3010`) — CSV upload, expand **Pack order**, drag/reorder, **Save order** during staging review.

**UI polish:** Nudge arrows removed; drag auto-scrolls the page; right-click or the position number jumps to an integer slot 1…N.

**Related:** **I-011**, **I-013**, **I-018**
