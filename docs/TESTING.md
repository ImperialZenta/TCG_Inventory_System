# Testing Guide

How automated and manual testing work in this repo, and how to verify stories without agent drift.

**Operator cheat sheet:** [TESTING-PLAYBOOK.md](TESTING-PLAYBOOK.md) — when to test, golden paths, smoke log.

Related: [backlog conventions](backlog/CONVENTIONS.md) (Gherkin tags), [PL-008](backlog/epic-00-platform.md#pl-008--automated-tests-for-remove-and-staging-flows), [spec compliance skill](../.cursor/skills/spec-compliance-review/SKILL.md).

---

## Stack

| Piece | Location |
|-------|----------|
| Runner | [Vitest](https://vitest.dev/) 3.x — `npm test` |
| Config | [`vitest.config.ts`](../vitest.config.ts) — `tests/**/*.test.ts` only |
| DB guard | [`tests/setup.ts`](../tests/setup.ts) — aborts unless `DATABASE_URL` contains `test` |
| Helpers | [`tests/helpers/db.ts`](../tests/helpers/db.ts), [`tests/helpers/fixtures.ts`](../tests/helpers/fixtures.ts) |
| Spec source | Gherkin in `docs/backlog/epic-*.md` — **not** auto-generated from `.feature` files |

Most tests are **integration tests**: real Prisma + PostgreSQL, database truncated per test via `resetTestDb()`.

A few are **unit tests** (no DB): e.g. `tests/pick-sort.test.ts`, `tests/tcgplayer-pullsheet.test.ts`.

---

## Running tests

### Docker (recommended — no local Node required)

The production `app` container does **not** include tests. Use the dedicated `test` service:

```powershell
docker compose up -d db
docker compose --profile test build test
docker compose --profile test run --rm test
```

The test entrypoint creates `tcg_inventory_test` if needed, runs `prisma db push`, then `vitest run`.

**Do not use** `docker compose exec app npm test` — the prod image has no `tests/` directory.

### Local (requires Node 20+ and PostgreSQL)

```powershell
$env:DATABASE_URL = "postgresql://tcg:tcg@localhost:5432/tcg_inventory_test"
npm run db:push
npm test
```

---

## What “Done” means

From [CONVENTIONS.md](backlog/CONVENTIONS.md):

> A story is only **Done** when every `@done` scenario in its Feature block passes by hand or in Vitest.

| Gherkin tag | Meaning |
|-------------|---------|
| `@done` | Shipped — treat as **regression spec** |
| `@pending` | Specified, not built |
| `@dual` | Chaos-block vs sorted-stock variant — scenario names which mode |

**Then** clauses must be observable (UI text, DB row, event type, HTTP status) — not function names or Prisma calls.

---

## Current test suites

| File | Protects |
|------|----------|
| `block-lifecycle.test.ts` | Block status transitions |
| `block-remove.test.ts` | Removal, partial remove, import unlock |
| `undo-formalize.test.ts` | Undo formalize + guards |
| `inventory-events.test.ts` | Append-only event log |
| `pick-guard.test.ts` | Atomic pick guard on block remove |
| `pick-allocate.test.ts` | Allocation rules (position, reservations) |
| `pick-renumber.test.ts` | Position compaction after pick |
| `pick-integrity.test.ts` | Quarantine, hold, re-allocate |
| `pick-hold.test.ts` | ON_HOLD blocks completion |
| `pick-counter.test.ts` | Counter pick |
| `order-import.test.ts` | Mana Pool import idempotency |
| `correction-import.test.ts` | Correction staging intake |
| `pick-sort.test.ts` | Pick route ordering |
| `tcgplayer-pullsheet.test.ts` | Pullsheet CSV parser |
| `manapool-webhook.test.ts` | Webhook route (mocked import) |
| `pl009-prod-separation.test.ts` | PL-009 prod/dev compose contracts, MIGRATE_STRICT entrypoint, backup/restore guard |

**Known gaps** (tracked in PL-008, not blocking current Done claims): Scryfall client, ManaBox CSV parse, JSON backup restore UI roundtrip, Mana Pool export format, analytics UI. **PL-009 drill:** full `pg_restore` roundtrip logged before first `store-vN` upgrade ([SMOKE-LOG](../operations/SMOKE-LOG.md)).

---

## Two-agent workflow (implement vs verify)

Avoid **drift** — when the same agent writes code and tests, tests often mirror bugs instead of the spec.

### Agent A — implement

- Implements the story in `src/`
- Adds or updates Vitest in `tests/` when behavior is assertable
- Does **not** flip Gherkin to `@done` without verification

### Agent B — spec compliance (review only)

Use a **fresh Cursor chat** or invoke the project skill:

```text
/spec-compliance-review P-009
```

Or: *“Read `.cursor/skills/spec-compliance-review/SKILL.md` and review story P-009.”*

Agent B:

1. Reads the epic Gherkin Feature block
2. Maps each **Then** clause → test assertion or manual step
3. Runs `docker compose --profile test run --rm test`
4. Reports gaps; recommends `@done` only when spec is covered

Agent B should **not** implement features. It may propose test additions only when gaps are clear.

### Optional: Bugbot with Gherkin

In Agent mode, Bugbot can supplement Agent B with `Custom Instructions` citing the epic file and story ID. Bugbot finds bugs; it does not replace the Gherkin traceability matrix.

---

## Pass bar before merge

1. `docker compose --profile test run --rm test` — all tests green
2. Spec compliance review for Must stories (skill or manual checklist)
3. Manual smoke for UI-heavy Must stories (backlog allows “by hand or Vitest”)
4. Epic Gherkin tags updated: `@pending` → `@done` only when scenarios are covered

---

## Writing good tests here

**Do:**

- Assert outcomes: `PickItem.status`, `InventoryEvent.eventType`, block counts, positions
- Use [`tests/helpers/fixtures.ts`](../tests/helpers/fixtures.ts) for setup; extend fixtures when real shapes differ
- Prefer real fixtures under `docs/fixtures/` for import tests when adding new channel parsers
- Test guards and negative paths (OPEN block excluded, ON_HOLD refused, quarantine cascade)

**Don’t:**

- Assert implementation details (`createPickListForOrder` was called)
- Weaken assertions to match a bug — fix code or flag spec conflict
- Run against `tcg_inventory` (non-test DB) — setup will refuse, and should
- Add tests that only duplicate another suite without new **Then** coverage

---

## CI (future)

No GitHub Actions workflow exists yet. When added, it should:

1. Build the `test` Docker target
2. Start PostgreSQL
3. Run `docker compose --profile test run --rm test`
4. Fail the PR if any test fails

---

## Prompt template for Agent B

```text
You are Agent B — spec compliance only. Do not implement features.

Story: <ID> from docs/backlog/epic-NN-*.md
Read the Feature block (all scenarios).

Tasks:
1. List every Then/And as a checklist.
2. For each, cite tests/*.test.ts line(s) or say GAP.
3. Flag tests that don't map to any Then (possible drift).
4. Run: docker compose --profile test run --rm test
5. Say whether @done is justified for this Feature.

Do not weaken assertions to match bugs. If code fails spec, report spec failure.
```

This template is encoded in [`.cursor/skills/spec-compliance-review/SKILL.md`](../.cursor/skills/spec-compliance-review/SKILL.md).
