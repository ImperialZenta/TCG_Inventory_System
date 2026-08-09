# ADR-011: Production/development environment separation

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-09 |
| **First implementer** | **PL-009** (Production store stack separated from development) |

## Context

The owner is starting real store operations (intake, listing on Mana Pool, order picking) while
development continues on the same machine. Until now there was one Docker Compose stack: every
`docker compose up --build` restarted the app with whatever code was in the working tree, and
[`docker-entrypoint.sh`](../../../docker-entrypoint.sh) could fall back to
`prisma db push --accept-data-loss` on migration drift — acceptable for dev, catastrophic for live
inventory. The JSON backup (PL-002/PL-003) covers inventory structure only; it omits orders, pick
history, users, and the event ledger, so it cannot serve as the store's disaster-recovery layer.

Requirements:

1. Dev work, test runs, and mistaken Docker commands must not be able to touch store data.
2. An accidental `docker compose down -v` must not destroy the store.
3. Schema evolution must carry store data forward — never require re-scanning or rebuilding blocks.
4. Full-database backup and one-command restore.

## Decision

### Two compose projects on one machine

| | Production (store) | Development |
|---|---|---|
| Compose file | `docker-compose.prod.yml` (project name pinned: `tcg-prod`) | `docker-compose.yml` (default project) |
| App | `localhost:3000` | `localhost:3010` |
| Postgres | host port `5433` | host port `5432` |
| Volume | `tcg_prod_pgdata` (**external**) | `pgdata` (compose-managed) |
| Built from | clean checkout of a `store-vN` git tag | working tree |

Compose project scoping means dev commands cannot address prod containers or volumes at all.

### External volume for store data

`tcg_prod_pgdata` is created manually (`docker volume create tcg_prod_pgdata`) and declared
`external: true`. Compose never deletes external volumes, so `down -v` against the prod project is
a non-event. Destroying the data requires an explicit `docker volume rm` (refused while referenced)
or a prune while the stack is stopped — both flagged by the guardrail rule.

### Strict migrations in production

`MIGRATE_STRICT=true` (set in `docker-compose.prod.yml`) makes the entrypoint run
`prisma migrate deploy` and exit on failure against a **non-empty** database — never falling
back to `db push --accept-data-loss` when store data exists. The one exception is first boot of
an empty store: the migration history begins with ALTER statements (no baseline CREATE), so the
entrypoint baselines once via `db push` + mark-applied, after which only `migrate deploy` runs.
All subsequent schema changes are authored as migration files on dev (`npm run db:migrate:dev`)
and reach the store by rebuilding from a tag; `migrate deploy` upgrades existing rows in place.

### pg_dump as the disaster-recovery layer

`scripts/backup-store.ps1` writes `pg_dump -Fc` archives (full database: inventory, orders, picks,
users, events, settings) to `backups/store/` with timestamp and git ref in the filename;
`scripts/restore-store.ps1` restores one, gated by an explicit `-ConfirmRestore RESTORE` argument
(destructive-scope rule, ADR-010 §5). The JSON export is demoted to a secondary, human-readable
inventory snapshot. Restoring an old dump after schema changes requires rebuilding the matching
tagged image first — the embedded git ref makes the pairing visible.

### Agent guardrail rule

[`.cursor/rules/prod-guardrail.mdc`](../../../.cursor/rules/prod-guardrail.mdc) (always applied)
requires agents to flag any prod-addressed command for user confirmation, forbids autonomous
destructive prod operations, and embeds the mental model above so any fresh session can explain
the setup to the user on request.

## Consequences

- **Positive:** store data is structurally unreachable from dev; `down -v` is survivable; upgrades
  are deliberate, tagged, and preceded by a backup; recovery is bounded by backup cadence (nightly
  scheduled task + manual dumps around big sessions).
- **Negative:** two stacks to keep running; the store only receives fixes when a tag is cut and
  deployed; docs that assumed the dev app at port 3000 needed a sweep.
- **Neutral:** both stacks build from the same repo and Dockerfile; ADR-010 Stage 1
  (deploy-per-tenant) now has its concrete single-machine topology; the future worker process
  (ADR-006) joins `docker-compose.prod.yml` as another service when built.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| One stack, rely on backups only | Every dev rebuild restarts the store with working-tree code; entrypoint fallback can reshape live data |
| Second Postgres database in the same container | App containers still shared; `down -v` still kills both databases |
| Compose-managed prod volume (non-external) | One `down -v` against the wrong project deletes the store |
| Cloud-hosted prod instance | Cost and scope; single counter-PC deployment is the ADR-010 Stage 1 model |

## Related stories

PL-009, PL-001, PL-002, PL-003, SAS-002 (Stage 1 packaging), SAS-003 (fleet backups, parked).

## References

- [docs/operations/STORE-OPERATIONS.md](../../operations/STORE-OPERATIONS.md) — runbook
- [ADR-010](010-saas-evolution-strategy.md) — staged SaaS evolution
- [ADR-006](006-background-worker-pg-boss.md) — future worker joins the prod compose file
