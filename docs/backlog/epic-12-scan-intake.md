# Epic 12 — Scan Intake Parity

Prefix `SCN-`. Bringing identification into the app: camera capture, candidate resolution, price at the point of scan.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Phase 7.** Read [`INTAKE-STRATEGY.md`](INTAKE-STRATEGY.md) first. The CSV bridge stays supported — a dedicated scanner app on a phone will keep beating an in-browser camera on throughput, and this epic does not remove that path.

**Supersedes:** **I-006** (camera recognition) and **I-014** (live sequential intake).

What this epic actually buys, in order of value: correcting a bad match without editing a CSV (**SCN-001**), seeing the price while deciding whether to take the trade (**SCN-004**), and only then scanning without a second app (**SCN-002**).

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| SCN-001 | Alternate printing picker on staged rows | Must | — |
| SCN-002 | Camera capture and recognition | Should | — |
| SCN-003 | Foil, language and anomaly flagging | Must | — |
| SCN-004 | Price overlay during review | Must | — |
| SCN-005 | Sequential in-app intake with positions | Could | — |
| SCN-006 | Card images on intake | Should | — |

---

### SCN-001 — Alternate printing picker on staged rows

| | |
|---|---|
| **As a** | staff member who spotted a wrong match in a staged import |
| **I want** | to pick the correct printing from a candidate list on that row |
| **So that** | one bad match costs a click instead of a CSV edit and re-upload |

**Priority:** Must · **Status:** — · **Depends on:** GAM-002 · **Highest value story in this epic**

```gherkin
@pending
Feature: SCN-001 Alternate printing picker

  Scenario: Correct a row from candidates
    Given a staged row matched to "Lightning Bolt" from set "2ed"
    When staff open the alternates for that row
    Then all printings of that card are listed with set, collector number, finish and price
    When they choose the "m10" printing
    Then the row's catalog reference, set and collector number update
    And the row is marked as manually corrected

  Scenario: Low-confidence matches are surfaced
    Given some rows matched with low confidence
    When staff open the review page
    Then those rows are flagged for attention
    And they can be filtered to on their own

  Scenario: Correction before formalize costs nothing
    Given the import has status PARSED
    When a row is corrected
    Then no inventory has changed, because nothing has been formalized

  Scenario: Correcting after formalize is refused with a pointer
    Given the import has status ASSIGNED
    When staff attempt to correct a row
    Then they are directed to block-level repair or undo formalize

  Scenario: Corrections are audited
    Then an event records the row, the original match and the chosen match

  Scenario: An unmatched row can be resolved by search
    Given a row that matched nothing
    When staff search by name from that row
    Then they can attach a printing and the row becomes enriched
```

---

### SCN-002 — Camera capture and recognition

| | |
|---|---|
| **As a** | staff member with no scanner app to hand |
| **I want** | to identify cards with the device camera in the app |
| **So that** | a small batch does not need a second tool and a file transfer |

**Priority:** Should · **Status:** — · **Depends on:** SCN-001, GAM-002 · **Supersedes:** I-006

**Scope discipline.** This is an intake convenience for small batches, not a replacement for the CSV path. It writes into the same staging pipeline, so review, breakdown, formalize and undo all work unchanged.

```gherkin
@pending
Feature: SCN-002 Camera capture and recognition

  Scenario: A scanned card becomes a staged row
    Given staff have opened the in-app scanner and granted camera access
    When a card is held to the camera and recognised
    Then a staged row is created with its printing, set and collector number
    And it enters the same staging import as any CSV row

  Scenario: Scanning continues without confirmation between cards
    When staff scan several cards in succession
    Then each is added without a per-card confirmation step
    And a running count is shown

  Scenario: A mixed pile scans without pre-sorting
    Given a pile mixing sets, conditions and, where enabled, games
    When it is scanned
    Then each card is identified independently
    And no pre-sorting was required

  Scenario: An uncertain match is queued rather than guessed
    Given recognition confidence is below the threshold
    Then the card is staged as low-confidence with candidates attached
    And it is resolved through SCN-001

  Scenario: An unrecognised card is not silently dropped
    When a card cannot be recognised at all
    Then a placeholder row is created carrying the captured image
    And staff can resolve it by search

  Scenario: Camera denial degrades gracefully
    Given camera access is denied
    Then the scanner explains what is needed
    And the CSV upload path is offered instead

  Scenario: Condition is not guessed from the image
    Then every scanned row takes the session's default condition
    And staff set the real grade, because condition remains a human judgement
```

**Note on the last scenario.** SortSwift claims automatic condition detection. Treat that as out of scope: mis-grading is a refund, and [`INTAKE-STRATEGY.md`](INTAKE-STRATEGY.md) already fixes condition as the human's job. Revisit only with evidence.

---

### SCN-003 — Foil, language and anomaly flagging

| | |
|---|---|
| **As a** | staff member reviewing an import |
| **I want** | foils, non-English cards and suspicious rows flagged for a second look |
| **So that** | the expensive mistakes get human attention and the routine ones do not |

**Priority:** Must · **Status:** — · **Depends on:** SCN-001, V-005

```gherkin
@pending
Feature: SCN-003 Foil, language and anomaly flagging

  Scenario: Foil rows are flagged for confirmation
    Given a staged row is marked FOIL
    When staff review the import
    Then it is flagged for confirmation, because foil status changes the price materially

  Scenario: Non-English rows are flagged
    Given a staged row has a language other than "en"
    Then it is flagged with its detected language

  Scenario: High-value rows are flagged
    Given the high-value threshold is 50.00
    And a row is priced at 240.00
    Then it is flagged for authentication and condition review

  Scenario: A price far outside the norm is flagged as an anomaly
    Given an import of mostly sub-dollar commons
    And one row prices at 900.00
    Then it is flagged as an anomaly for a second look

  Scenario: Flags can be filtered and cleared in bulk
    When staff filter to flagged rows
    Then only those rows are shown
    And staff can confirm them individually or in bulk

  Scenario: Flags are advisory
    When staff formalize with flags outstanding
    Then formalize proceeds
    And the count of unconfirmed flags is recorded on the import
```

**Note:** counterfeit detection is explicitly not attempted. Software cannot see a proxy; the flags exist to route the right cards to a human who can.

---

### SCN-004 — Price overlay during review

| | |
|---|---|
| **As a** | staff member deciding what to offer for a trade-in |
| **I want** | the market value visible while I review the scan |
| **So that** | I make the offer with the number in front of me instead of guessing |

**Priority:** Must · **Status:** — · **Depends on:** V-005

```gherkin
@pending
Feature: SCN-004 Price overlay during review

  Scenario: Each row shows its price
    Given a staged import with resolved prices
    When staff open the review page
    Then each row shows its market price for its finish and condition

  Scenario: The import total is shown
    Then the total market value of the import is shown
    And it updates as rows are corrected or removed

  Scenario: The suggested buy offer is shown alongside
    Given the buy rate is 50 percent of market for cash
    Then the suggested cash offer is shown next to the market total

  Scenario: The top rows by value are surfaced
    Then the highest-value rows are listed separately, so the offer conversation starts with them

  Scenario: Unpriced rows are counted, not hidden
    Given some rows have no price
    Then the total notes how many rows are unpriced
    And they are excluded rather than treated as zero

  Scenario: Prices are timestamped
    Then the review states how fresh the prices are
```

---

### SCN-005 — Sequential in-app intake with positions

| | |
|---|---|
| **As a** | packer building a chaos brick by hand |
| **I want** | to scan cards one by one and have positions assigned as I go |
| **So that** | the digital order matches the physical stack without a CSV round trip |

**Priority:** Could · **Status:** — · **Depends on:** SCN-002 · **Supersedes:** I-014

```gherkin
@pending
Feature: SCN-005 Sequential in-app intake

  Scenario: Positions follow scan order
    Given a sequential intake session is open against a target block size of 50
    When staff scan 3 cards
    Then they occupy positions 1, 2 and 3 in scan order

  Scenario: The session rolls to a new block at the cap
    Given the session has reached 50 cards
    When the next card is scanned
    Then a new block begins at position 1
    And staff are prompted to close the current bag

  Scenario: The last scan can be undone
    When staff undo the last scan
    Then that card is removed and the next scan reuses its position

  Scenario: An interrupted session resumes
    Given a session is abandoned partway
    When staff return to it
    Then it resumes at the next position with its cards intact

  Scenario: The session commits through the normal pipeline
    When staff finish the session
    Then it becomes a staging import that reviews, formalizes and undoes like any other
```

---

### SCN-006 — Card images on intake

| | |
|---|---|
| **As a** | staff member resolving a dispute or preparing a listing |
| **I want** | the card's catalog image, and any captured image, retained on the row |
| **So that** | I can see what was scanned rather than reading a name and hoping, and sorted stock can show buyers the actual copy when a scan exists |

**Priority:** Should · **Status:** — · **Depends on:** V-005, GAM-002 · **Related:** **SKU-011** (listing-image resolution and catalog fallback on stock)

```gherkin
@pending
Feature: SCN-006 Card images on intake

  Scenario: The catalog image survives into inventory
    Given a row is enriched with a catalog image URI
    When the import is formalized
    Then the card line carries that image URI

  Scenario: Images are shown where cards are listed
    Then card images appear on the staging review, block detail and stock browser

  Scenario: A captured image is retained for scanned cards
    Given a card was captured by camera
    Then the captured image is retained on the row alongside the catalog image

  Scenario: A captured scan becomes the stock scan when sorted or promoted
    Given a staged row with a captured scan image destined for stock
    When staff sort the row to stock or promote it from a block
    Then the resulting stock item's scan image is the captured image
    And the stock item's catalog image is the row's catalog image

  Scenario: A missing image does not break the layout
    Given a card has no image
    Then a placeholder is shown

  Scenario: Images do not slow the list
    Given a block of 50 cards is opened
    Then images load lazily and do not delay the card list
```

**Note:** `imageUri` persists through formalize (**V-005**, Done). Remaining work is scan/review UI and wiring captured images into **SKU-011** on the stock path (**SKU-002**, **SKU-004**).
