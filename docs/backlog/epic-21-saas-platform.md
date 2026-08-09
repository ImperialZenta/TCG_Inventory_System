# Epic 21 — SaaS Platform & Tenancy

Prefix `SAS-`. Turning the shop tool into a product other stores run — without slowing down the shop that runs it today.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md) · [ADR-010](../architecture/adr/010-saas-evolution-strategy.md)

**This epic is a trigger-gated parking lot.** Read [ADR-010](../architecture/adr/010-saas-evolution-strategy.md) before scheduling anything here. Every story except **SAS-001** stays **Parked** until its named business trigger fires; scheduling one early is a scope violation, not initiative. The Stage-0 tenancy seams are not stories — they are conventions enforced by `.cursor/rules/tenancy-seams.mdc` and ESLint, applied during normal feature work.

| Trigger | Fires when | Unparks |
|---------|-----------|---------|
| **T1 — Auth build** | ACC-001 enters development | Nothing here; tenancy seam notes in [epic-20](epic-20-access-platform.md) apply |
| **T2 — First external store** | A store other than the owner's commits as a design partner | SAS-002, SAS-003, SAS-004 |
| **T3 — Fleet pain** | Deploy-per-tenant ops burden exceeds migration cost (typically 5–20 tenants) | SAS-005 through SAS-009 |

| ID | Story | Priority | Status |
|----|-------|----------|--------|
| SAS-001 | Mandatory webhook and cron authentication | Must | — |
| SAS-002 | Tenant provisioning: one command, one new store stack | Must at T2 | Parked |
| SAS-003 | Central monitoring and backup across tenant stacks | Must at T2 | Parked |
| SAS-004 | Manual billing for design partners | Should at T2 | Parked |
| SAS-005 | Tenant model and scoped schema migration | Must at T3 | Parked |
| SAS-006 | Per-tenant encrypted channel credentials | Must at T3 | Parked |
| SAS-007 | Tenant-routed webhooks | Must at T3 | Parked |
| SAS-008 | Tenant-scoped backup, restore and danger zone | Must at T3 | Parked |
| SAS-009 | Tenant onboarding and automated billing | Should at T3 | Parked |

---

### SAS-001 — Mandatory webhook and cron authentication

| | |
|---|---|
| **As a** | store owner whose app receives marketplace webhooks over the internet |
| **I want** | inbound mutation endpoints to refuse every request they cannot verify |
| **So that** | nobody can inject orders into my inventory by finding a URL |

**Priority:** Must · **Status:** Done · **Depends on:** nothing

**Why now.** Today [`/api/webhooks/manapool`](../../src/app/api/webhooks/manapool/route.ts) skips signature verification entirely when `MANAPOOL_WEBHOOK_SECRET` is unset, and [`/api/cron/sync-manapool-orders`](../../src/app/api/cron/sync-manapool-orders/route.ts) skips its bearer check when `CRON_SECRET` is unset. Both mutate inventory. Chartered as "harden now" in ADR-010 (decision 3) because the webhook endpoint is internet-reachable in any deployment that actually receives webhooks. Schedule in the next hardening window; do not wait for Stage 2.

```gherkin
@done
Feature: SAS-001 Mandatory webhook and cron authentication

  Scenario: Webhook is refused when no secret is configured
    Given MANAPOOL_WEBHOOK_SECRET is not set
    When a POST arrives at "/api/webhooks/manapool" with a well-formed order payload
    Then the response status is 503
    And no ExternalOrder row is created
    And no inventory event is recorded

  Scenario: Webhook with a valid signature is accepted
    Given MANAPOOL_WEBHOOK_SECRET is set
    And the request body is signed with that secret
    When the webhook delivers order "MP-12345"
    Then the response status is 200
    And an ExternalOrder with manapoolOrderId "MP-12345" exists

  Scenario: Webhook with an invalid signature is refused
    Given MANAPOOL_WEBHOOK_SECRET is set
    When a POST arrives at "/api/webhooks/manapool" with a signature that does not match the body
    Then the response status is 401
    And no ExternalOrder row is created

  Scenario: Cron sync is refused when no secret is configured
    Given CRON_SECRET is not set
    When a POST arrives at "/api/cron/sync-manapool-orders"
    Then the response status is 503
    And no orders are imported

  Scenario: Cron sync requires the bearer token
    Given CRON_SECRET is set
    When a POST arrives at "/api/cron/sync-manapool-orders" without the matching Authorization bearer
    Then the response status is 401
    And no orders are imported
```

**Design notes (negotiable):** 503 for "misconfigured, fail closed" versus 401 for "configured, bad credential" is a suggestion, not a contract — any distinct, logged refusal satisfies the story. A development-only escape hatch (explicit env flag that logs loudly) is acceptable if docker-compose local flows need it; silence is not.

---

## Parked — Stage 2, trigger T2 (first external store commits)

Stage 2 ships SaaS as **one deployment per tenant** — one container, one database, one env file per store, exactly today's Docker shape (ADR-010). No schema changes.

### SAS-002 — Tenant provisioning: one command, one new store stack
**Must at T2. Parked.** As the operator, I want a scripted "new tenant" action that provisions the container, database, subdomain, TLS and env secrets for a store, so that onboarding a design partner takes an hour, not a weekend. Includes teardown. Nothing may require hand-editing another tenant's stack.

### SAS-003 — Central monitoring and backup across tenant stacks
**Must at T2. Parked.** As the operator, I want uptime, error and backup status for every tenant stack visible in one place, so that a dead store or a failed backup is noticed before the store owner calls. Per-tenant scheduled backups replace "the owner remembers to export JSON" (PL-002/PL-003 remain the in-app mechanism).

### SAS-004 — Manual billing for design partners
**Should at T2. Parked.** As the operator, I want each tenant invoiced on a simple recurring basis (Stripe invoice or equivalent), so that early revenue exists without building billing infrastructure. No self-serve, no metering.

---

## Parked — Stage 3, trigger T3 (fleet pain at 5–20 tenants)

Stage 3 is the shared-schema migration. It is bounded work **only if** the Stage-0 seams held; audit them before scheduling.

### SAS-005 — Tenant model and scoped schema migration
**Must at T3. Parked.** As the operator, I want all tenants in one shared database scoped by a `Tenant` key, so that upgrades, backups and monitoring happen once instead of per stack. Adds `tenantId` to business tables, composite uniques (`(tenantId, blockId)` and kin), per-tenant sequence and `AppSetting` rows, and scope injection via the domain layer (Prisma client extension preferred). Depends on ACC-001/ACC-002 in their tenant-shaped form.

### SAS-006 — Per-tenant encrypted channel credentials
**Must at T3. Parked.** As a store owner on the shared platform, I want my Mana Pool (and future channel) credentials stored encrypted against my tenant and editable in settings, so that my account is mine alone. Replaces env credentials behind the `getChannelConfig(ctx, channel)` seam from ADR-010 convention 3.

### SAS-007 — Tenant-routed webhooks
**Must at T3. Parked.** As a store owner, I want marketplace webhooks delivered to a URL that identifies my store and verified with my store's secret, so that another tenant's orders can never land in my inventory. Route shape `/api/webhooks/[tenant]/[channel]` per ADR-009 layer 2.

### SAS-008 — Tenant-scoped backup, restore and danger zone
**Must at T3. Parked.** As a store owner, I want export, restore and danger-zone deletes to touch exactly my tenant's data, so that platform-wide operations are impossible from my settings page. Extends the explicit-scope convention (ADR-010 convention 5) from signature shape to enforced behaviour.

### SAS-009 — Tenant onboarding and automated billing
**Should at T3. Parked.** As the operator, I want self-serve store signup, plan selection and automated recurring billing, so that sales does not require me. Supersedes SAS-004.
