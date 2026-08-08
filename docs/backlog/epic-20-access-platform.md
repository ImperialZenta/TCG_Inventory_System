# Epic 20 — Access Control & Platform Parity

Prefix `ACC-`. Knowing who did what.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [parity matrix](PARITY-SORTSWIFT.md)

**Phase 6, first.** This epic goes before everything else in the parity programme, and the reason is narrow and concrete: `InventoryEvent.actor` is nullable and has never been written, because there is no identity to write. Every parity feature that follows moves money. A till that cannot say which cashier opened it, a buylist payout with no approver, and a price override with no author are all unauditable, and no amount of later work retrofits the missing history.

**Supersedes:** **O-006**, which framed role-based access as a Could. At the scale of the parity programme it is a Must.

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| ACC-001 | User accounts and authentication | Must | — |
| ACC-002 | Roles and permissions | Must | — |
| ACC-003 | Actor on every event and movement | Must | — |
| ACC-004 | Session management and device sign-out | Should | — |
| ACC-005 | Feature modules | Could | Parked |
| ACC-006 | External inventory API | Could | Parked |
| ACC-007 | Native mobile app | Could | Parked |

---

### ACC-001 — User accounts and authentication

| | |
|---|---|
| **As a** | shop owner |
| **I want** | staff to sign in as themselves |
| **So that** | every action in the system has a name attached to it |

**Priority:** Must · **Status:** — · **Blocks:** the entire parity programme

**Scope discipline.** This is a shop tool on a shop network, not a public SaaS. One organisation, a handful of staff accounts, no self-registration, no tenancy. Building for multi-tenancy here would be the single easiest way to turn a two-week story into a two-month one.

```gherkin
@pending
Feature: ACC-001 User accounts and authentication

  Scenario: Sign in and reach the app
    Given a user account exists
    When the user signs in with correct credentials
    Then they reach the application
    And their name is shown in the interface

  Scenario: Unauthenticated access is refused
    Given no session exists
    When any application page is requested
    Then the user is redirected to sign in
    And no inventory data is rendered

  Scenario: API routes are protected too
    Given no session exists
    When "/api/backup/export" is requested
    Then it is refused
    And no data is returned

  Scenario: Bad credentials fail without leaking
    When a user signs in with a wrong password
    Then the failure does not reveal whether the account exists

  Scenario: The owner manages accounts
    When the owner creates, disables or resets a staff account
    Then the change takes effect immediately
    And a disabled account cannot sign in

  Scenario: Passwords are stored hashed
    Then no password is recoverable from the database

  Scenario: The first run bootstraps an owner
    Given a fresh installation with no accounts
    When the system starts
    Then a first-run flow creates the owner account
    And the app is not left open to the network in the meantime

  Scenario: Existing single-user data survives
    Given inventory created before authentication existed
    When authentication is introduced
    Then all of it remains accessible
    And its historical events keep a null actor rather than being falsely attributed
```

**Schema notes (negotiable):** a `User` table with email, hashed password, display name, role and an enabled flag. Prefer a maintained library for session handling over hand-rolled cookies. The last scenario matters — do not backfill `actor` with a guess. Protected surface per [ADR-009](../../architecture/adr/009-protected-api-surface.md); actor threading per [ADR-002](../../architecture/adr/002-actor-context-propagation.md).

---

### ACC-002 — Roles and permissions

| | |
|---|---|
| **As a** | shop owner |
| **I want** | staff limited to what their job requires |
| **So that** | a weekend hire cannot wipe the database or approve their own trade |

**Priority:** Must · **Status:** — · **Depends on:** ACC-001 · **Supersedes:** O-006

**Roles v1**, kept few on purpose:

| Role | Can |
|------|-----|
| **Owner** | Everything, including settings, danger zone, users and pricing rules |
| **Manager** | Everything operational: intake, blocks, stock, pricing, buylist approval, refunds. No danger zone, no user management |
| **Staff** | Intake, picking, POS sales, stock lookup. No deletion, no buylist approval, no price rules |
| **Read-only** | View inventory and reports. No mutations |

```gherkin
@pending
Feature: ACC-002 Roles and permissions

  Scenario Outline: Destructive actions are restricted to the owner
    Given a signed-in user with role <role>
    When they attempt to use the Settings danger zone
    Then the action is <outcome>

    Examples:
      | role      | outcome  |
      | Owner     | allowed  |
      | Manager   | refused  |
      | Staff     | refused  |
      | Read-only | refused  |

  Scenario Outline: Block removal follows role
    Given a signed-in user with role <role>
    When they attempt to remove a block
    Then the action is <outcome>

    Examples:
      | role      | outcome  |
      | Owner     | allowed  |
      | Manager   | allowed  |
      | Staff     | refused  |
      | Read-only | refused  |

  Scenario: Staff can do their own job
    Given a signed-in user with role Staff
    Then they can upload imports, formalize, seal, pick and sell at the counter

  Scenario: Read-only cannot mutate anything
    Given a signed-in user with role Read-only
    When they attempt any state-changing action
    Then it is refused

  Scenario: Permissions are enforced on the server
    Given a Staff user crafts a request for an owner-only action directly
    Then the server refuses it
    And the refusal does not depend on the interface having hidden the control

  Scenario: Unavailable actions are hidden as well as refused
    Then controls a user's role does not permit are not shown to them

  Scenario: A refused action is recorded
    Then permission refusals are recorded with the user, the action and the time
```

---

### ACC-003 — Actor on every event and movement

| | |
|---|---|
| **As an** | owner investigating a discrepancy |
| **I want** | every recorded change to name the person who made it |
| **So that** | the audit trail answers "who", not only "what" |

**Priority:** Must · **Status:** — · **Depends on:** ACC-001

**This is the story the epic exists for.** The event log already works; it is missing one column's worth of truth.

```gherkin
@pending
Feature: ACC-003 Actor on every event and movement

  Scenario: Inventory events carry their actor
    Given a signed-in user seals block "MTG-0007"
    Then the seal event records that user as its actor

  Scenario: The activity feed shows who
    When the owner opens "/activity"
    Then each event shows the acting user alongside what happened and when

  Scenario: The feed is filterable by user
    When the owner filters by a user
    Then only that user's actions are listed

  Scenario: Stock movements carry their actor
    Given a signed-in user adjusts a stock quantity
    Then the movement records that user

  Scenario: System actions are attributed to the system
    Given a scheduled price refresh changes prices
    Then the resulting records are attributed to the system rather than to a person

  Scenario: Historical events are honestly unattributed
    Given events recorded before authentication existed
    Then their actor remains null
    And the feed shows them as unattributed rather than guessing

  Scenario: Actor cannot be spoofed by the client
    Then the actor is taken from the server session
    And a client-supplied actor value is ignored
```

---

### ACC-004 — Session management and device sign-out

| | |
|---|---|
| **As a** | shop owner |
| **I want** | control over active sessions on shop devices |
| **So that** | a counter terminal left signed in overnight is not an open door |

**Priority:** Should · **Status:** — · **Depends on:** ACC-001

```gherkin
@pending
Feature: ACC-004 Session management

  Scenario: Sessions expire after inactivity
    Given the inactivity timeout is 12 hours
    When a session has been idle longer than that
    Then it is invalidated and the next request requires signing in

  Scenario: A user can sign out
    When a user signs out
    Then their session is invalidated immediately

  Scenario: The owner can see and revoke sessions
    When the owner views active sessions
    Then each is listed with its user, device and last activity
    And any of them can be revoked

  Scenario: Disabling an account ends its sessions
    When the owner disables an account
    Then its active sessions are invalidated at once

  Scenario: A shared counter terminal can use a short timeout
    Given a device is configured as a shared terminal
    Then it uses a shorter inactivity timeout than a personal device
```

---

## Parked

### ACC-005 — Feature modules
**Could. Parked.** SortSwift sells à-la-carte modules, which is a pricing model rather than a capability. A self-hosted single-shop deployment has nothing to gain from hiding features it already paid nothing extra for. The one genuine benefit is a simpler interface: a shop not using POS or consignment should not see those pages. Revisit as a navigation preference, not as licensing.

### ACC-006 — External inventory API
**Could. Parked.** A documented, authenticated API for external integrations, so the shop's website or a third-party tool can read stock and place orders. Sensible only once **SKU-001** is the settled source of truth — publishing an API over a model still in flux locks in the wrong shape. Needs API keys scoped by permission, which extends **ACC-002**.

### ACC-007 — Native mobile app
**Could. Parked.** The web app is responsive and works on a phone at the counter and at the shelf. The only thing a native app clearly buys is better camera access for **SCN-002**. Revisit only if in-browser scanning proves unusable in practice, and treat that as evidence rather than assumption.
