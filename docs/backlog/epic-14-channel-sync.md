# Epic 14 — Channel Sync & Marketplaces

Prefix `CHN-`. One inventory, many storefronts, without selling the same card twice.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Phase 9.** Today `BlockChannel` is a label with no behaviour, and the only real integration is downloading a Mana Pool CSV and uploading it by hand. Nothing in `src/` makes an outbound marketplace call.

**Order of work is deliberate.** CSV templates first (**CHN-006**), because they cover every marketplace immediately at low risk and keep working when an API breaks. One live API second (**CHN-002**), to prove the sync model. The oversell guard (**CHN-005**) is the point of the whole epic and is a Must.

**Architecture:** availability gatekeeper ([ADR-005](../architecture/adr/005-reservation-and-availability-engine.md)); listing push via transactional outbox ([ADR-007](../architecture/adr/007-transactional-outbox-channel-sync.md)); channel adapters ([ADR-008](../architecture/adr/008-provider-adapter-registry.md)); worker drains outbox ([ADR-006](../architecture/adr/006-background-worker-pg-boss.md)).

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| CHN-001 | Channel registry and configuration | Must | — |
| CHN-006 | Marketplace CSV export templates | Must | — |
| CHN-002 | Listing push to one live channel | Must | — |
| CHN-003 | Per-channel listing selection | Should | — |
| CHN-004 | Quantity reconciliation both directions | Must | — |
| CHN-005 | Oversell guard | Must | — |
| CHN-007 | Order ingestion from channels | Must | — |
| CHN-008 | Additional channels | Should | — |
| CHN-009 | Sync health and failure recovery | Must | — |

---

### CHN-001 — Channel registry and configuration

| | |
|---|---|
| **As a** | seller |
| **I want** | each sales channel configured as a first-class thing with its own credentials and settings |
| **So that** | adding or pausing a marketplace does not mean a code change |

**Priority:** Must · **Status:** — · **Blocks:** the rest of this epic

```gherkin
@pending
Feature: CHN-001 Channel registry

  Scenario: Configure a channel
    When the owner adds a channel with a name, type, credentials and sync mode
    Then it appears in the channel list as enabled

  Scenario: Credentials are not exposed after saving
    When the owner reopens a channel's configuration
    Then secrets are masked
    And they are never rendered into client-side markup

  Scenario: A channel can be paused without losing its configuration
    When the owner pauses a channel
    Then no sync runs for it
    And its listings and configuration are retained

  Scenario Outline: Sync modes are explicit
    Given a channel configured as "<mode>"
    Then its capabilities are limited accordingly

    Examples:
      | mode        |
      | manual CSV  |
      | one-way push|
      | two-way sync|

  Scenario: The legacy block channel label migrates
    Given blocks carry the old channel enum
    When the registry is introduced
    Then those values map to registry channels
    And no block loses its channel attribution
```

---

### CHN-006 — Marketplace CSV export templates

| | |
|---|---|
| **As a** | seller |
| **I want** | inventory exportable in each marketplace's own CSV format |
| **So that** | I can list anywhere today, without waiting for an API integration |

**Priority:** Must · **Status:** — · **Depends on:** CHN-001, SKU-001 · **Build this first**

**Targets:** eBay, TCGplayer, Shopify, CardTrader, BinderPOS, Mana Pool (already built), Square, ManaPool, Walmart, WooCommerce.

```gherkin
@pending
Feature: CHN-006 Marketplace CSV export templates

  Scenario: Export in a marketplace's format
    Given stock exists and a template for the target marketplace is configured
    When staff export for that marketplace
    Then the CSV carries that marketplace's exact column names and order

  Scenario: Vocabularies are translated per marketplace
    Then conditions, finishes and languages are emitted in the target's terms rather than the internal ones

  Scenario: The channel's price is used
    Given per-channel pricing is configured
    Then the export carries that channel's price, not the base price

  Scenario: Only sellable stock is exported
    Then items with zero available quantity are omitted
    And cards inside unsealed chaos blocks are omitted

  Scenario: The export is filterable
    When staff filter by game, set, condition or value before exporting
    Then only matching items are included

  Scenario: The export is recorded
    Then the export is logged with its channel, row count and time
    And what was exported is retrievable later for reconciliation

  Scenario: The existing Mana Pool export is unaffected
    Then the per-block Mana Pool listing CSV continues to work as before
```

**Block-mode vs stock-mode:** Chaos block listing (upload sessions, bin catalogs) is **CHL-*** ([Epic 22](../epic-22-channel-catalogs.md), [ADR-013](../architecture/adr/013-channel-catalogs-block-listing.md)) — aggregate `CardLine` export, no SKU ledger. **CHN-006** stock-mode export targets `StockItem` rows (`@dual`). Both may share CSV formatters later.

---

### CHN-002 — Listing push to one live channel

| | |
|---|---|
| **As a** | seller |
| **I want** | listings created and updated on one marketplace automatically |
| **So that** | the sync model is proven end to end before it is repeated |

**Priority:** Must · **Status:** — · **Depends on:** CHN-001, SKU-003, PRC-006

**Channel choice** is a build-time decision. Prefer whichever of Shopify or Mana Pool has the most workable API and the most of the shop's real volume — the story does not depend on which.

```gherkin
@pending
Feature: CHN-002 Listing push to a live channel

  Scenario: A new stock item is listed
    Given a stock item with available quantity 3 and a channel price
    When the channel sync runs
    Then a listing is created on the channel with quantity 3 and that price
    And the channel's listing identifier is stored against the item

  Scenario: A price change updates the listing
    Given the item is listed and its channel price changes
    When sync runs
    Then the listing's price is updated

  Scenario: A quantity change updates the listing
    Given available quantity drops from 3 to 1
    When sync runs
    Then the listing quantity is updated to 1

  Scenario: Zero available delists rather than listing zero
    Given available quantity reaches 0
    When sync runs
    Then the listing is ended or set unavailable

  Scenario: Sync is idempotent
    Given nothing has changed since the last sync
    When sync runs again
    Then no redundant update is sent

  Scenario: A push failure is retried, not lost
    Given the channel rejects an update with a transient error
    Then the update is queued for retry with backoff
    And it is reported if it keeps failing

  Scenario: Rate limits are respected
    Given the channel imposes a request limit
    Then sync stays within it
    And it does not drop updates to do so
```

---

### CHN-003 — Per-channel listing selection

| | |
|---|---|
| **As a** | seller |
| **I want** | to choose which inventory goes to which channel |
| **So that** | penny commons do not clog a marketplace where they cannot cover their own fees |

**Priority:** Should · **Status:** — · **Depends on:** CHN-001

```gherkin
@pending
Feature: CHN-003 Per-channel listing selection

  Scenario: A value threshold gates a channel
    Given eBay has a minimum listing value of 5.00
    Then only items priced at or above 5.00 are listed there

  Scenario: Rules can gate by game, set or condition
    Given a channel is configured for Magic only
    Then Pokémon stock is not listed there

  Scenario: An item can be excluded by hand
    When staff exclude an item from a channel
    Then it is delisted there and not relisted by rules

  Scenario: The same item can sit on several channels
    Given an item qualifies for three channels
    Then it is listed on all three
    And they draw on one shared available quantity

  Scenario: Becoming ineligible delists
    Given an item's price falls below a channel's threshold
    When sync runs
    Then it is delisted from that channel and remains on the others
```

---

### CHN-004 — Quantity reconciliation both directions

| | |
|---|---|
| **As a** | seller |
| **I want** | periodic reconciliation between our quantities and each channel's |
| **So that** | drift is found by the system rather than by a customer whose order cannot be filled |

**Priority:** Must · **Status:** — · **Depends on:** CHN-002

```gherkin
@pending
Feature: CHN-004 Quantity reconciliation

  Scenario: Reconciliation detects drift
    Given our available quantity is 2 and the channel reports 5
    When reconciliation runs
    Then the discrepancy is recorded and reported

  Scenario: Our ledger is the source of truth for quantity
    Given a drift is detected
    Then the channel is corrected to our figure
    And the correction is logged

  Scenario: An unrecorded channel sale is investigated, not overwritten
    Given the channel's quantity is lower than ours because of a sale we did not ingest
    When reconciliation runs
    Then the sale is ingested as an order rather than the quantity being pushed back up

  Scenario: Reconciliation runs on a schedule and on demand
    Then it runs on its configured schedule
    And staff can trigger it immediately

  Scenario: Results are summarised
    Then each run reports items checked, drifts found and corrections made
```

---

### CHN-005 — Oversell guard

| | |
|---|---|
| **As a** | seller listing one card on four marketplaces |
| **I want** | the last copy withdrawn everywhere the moment it sells anywhere |
| **So that** | I never take money for a card I cannot ship |

**Priority:** Must · **Status:** — · **Depends on:** SKU-003, CHN-002 · **The reason this epic exists**

```gherkin
@pending
Feature: CHN-005 Oversell guard

  Scenario: A sale on one channel withdraws the card from the others
    Given one copy is listed on three channels
    When it sells on channel A
    Then the unit is reserved immediately
    And channels B and C are updated to zero available

  Scenario: Channels are offered available, never on-hand
    Given a stock item with on-hand 5 and reserved 3
    Then every channel is told 2

  Scenario: A near-simultaneous double sale is detected and surfaced
    Given one copy is listed on two channels
    When both sell within the same sync window
    Then the second is flagged as an oversell incident
    And staff are alerted with both order references

  Scenario: An oversell incident has a defined resolution path
    Given an oversell incident is open
    Then staff can fulfil from other stock, promote a copy from a chaos block, or cancel with a refund
    And the resolution is recorded against the incident

  Scenario: A reserve buffer can be configured per channel
    Given a channel is configured to hold back one unit
    And on-hand is 3 with none reserved
    Then that channel is offered 2

  Scenario: Chaos block contents are never offered as available
    Given a printing exists only inside sealed chaos blocks
    Then no channel is offered it as sellable stock
    And it is listed as promotable inventory instead

  Scenario: Oversell rate is measurable
    Then the number of oversell incidents per period is reportable
```

---

### CHN-007 — Order ingestion from channels

| | |
|---|---|
| **As a** | seller |
| **I want** | channel orders pulled into the system automatically |
| **So that** | fulfilment starts from one queue instead of four browser tabs |

**Priority:** Must · **Status:** — · **Depends on:** CHN-002 · **Feeds:** FUL-001

```gherkin
@pending
Feature: CHN-007 Order ingestion from channels

  Scenario: A channel order becomes a local order
    Given a new order exists on a connected channel
    When ingestion runs
    Then a local order is created with its lines, buyer reference and channel identifier

  Scenario: Ingestion reserves stock
    When an order is ingested
    Then its lines reserve the matching stock

  Scenario: Ingestion is idempotent
    Given an order has already been ingested
    When ingestion runs again
    Then no duplicate is created

  Scenario: A cancellation releases the reservation
    Given an ingested order is cancelled on the channel
    When ingestion runs
    Then the local order is marked cancelled and its reservations are released

  Scenario: A line matching no stock is flagged
    Given an ingested line matches nothing in inventory
    Then it is flagged as unmatched for manual resolution
    And the rest of the order still ingests

  Scenario: Statuses are normalised across channels
    Then each channel's own status vocabulary maps to one internal set
```

---

### CHN-008 — Additional channels

| | |
|---|---|
| **As a** | seller |
| **I want** | further marketplaces to be added by configuration and an adapter |
| **So that** | reaching parity's channel list does not mean rewriting sync each time |

**Priority:** Should · **Status:** — · **Depends on:** CHN-002, CHN-004, CHN-007

```gherkin
@pending
Feature: CHN-008 Additional channels

  Scenario: A second channel needs only an adapter
    When a developer adds an adapter and configures the channel
    Then listing push, reconciliation, oversell guard and order ingestion all work for it
    And no changes were needed outside the adapter

  Scenario: Adapters declare their capabilities
    Given a channel supports listing push but not order ingestion
    Then only the supported operations are offered for it

  Scenario: Channels operate independently
    Given one channel is failing
    Then the others continue syncing normally
```

---

### CHN-009 — Sync health and failure recovery

| | |
|---|---|
| **As a** | seller |
| **I want** | to see whether sync is working and to recover when it is not |
| **So that** | a silently broken integration does not become a week of oversells |

**Priority:** Must · **Status:** — · **Depends on:** CHN-002

```gherkin
@pending
Feature: CHN-009 Sync health and failure recovery

  Scenario: A health dashboard shows every channel
    When staff open sync health
    Then each channel shows its last successful sync, pending updates and recent failures

  Scenario: A stalled channel is surfaced
    Given a channel has not synced successfully for longer than its expected interval
    Then it is shown as unhealthy with the time since its last success

  Scenario: Failures are inspectable and retryable
    Given some updates failed
    Then each failure is listed with its item, operation and error
    And staff can retry them individually or in bulk

  Scenario: Authentication failure is distinguished from a transient error
    Given a channel's credentials are rejected
    Then it is marked as needing reauthentication rather than being retried indefinitely

  Scenario: Sync pauses rather than corrupting on repeated failure
    Given a channel has failed repeatedly
    Then sync pauses for it and staff are alerted
    And other channels are unaffected

  Scenario: Sync activity is auditable
    Then every push, reconciliation and ingestion is recorded with its outcome
```
