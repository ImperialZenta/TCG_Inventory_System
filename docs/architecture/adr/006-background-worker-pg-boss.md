# ADR-006: Background worker on pg-boss

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-06 |
| **First implementer** | **PRC-002** (Scheduled market price refresh) |

## Context

Several upcoming stories require work **outside the HTTP request**:

| Story | Need |
|-------|------|
| PRC-002 | Reprice 100k items on a 12h schedule |
| CHN-004 | Periodic quantity reconciliation |
| GAM-005 | Catalog refresh |
| A-007 | Aging alert evaluation |
| BUY-007 | Notification delivery |
| SKU-003 | Reservation expiry sweep |

Running these in Next.js request handlers or `setInterval` in the app process fails on restart, timeout, and retry requirements.

## Decision

Add a **second Node process** in this repo — `src/worker/index.ts` — consuming jobs from **pg-boss**, a Postgres-backed queue.

### Why pg-boss

- Uses existing **PostgreSQL 16** ([docker-compose.yml](../../../docker-compose.yml)) — no Redis or SQS.
- Supports cron schedules, retries with backoff, and job completion tracking.
- Same `DATABASE_URL` as the web app.

### Deployment

```yaml
# docker-compose.yml (future, at PRC-002)
worker:
  build: .
  command: node dist/worker/index.js   # or tsx src/worker/index.ts in dev
  environment:
    DATABASE_URL: ...
  depends_on:
    db:
      condition: service_healthy
```

Web app and worker share Prisma schema and `src/lib/` domain modules. Workers call the same domain functions as actions, with `ctx.actor = "system:<job-name>"`.

### Job organisation

```
src/lib/jobs/
├── register.ts       # pg-boss start, schedule definitions
├── price-refresh.ts  # PRC-002
├── reservation-expiry.ts
├── catalog-refresh.ts
└── channel-reconcile.ts
```

### Rules

1. **Jobs are idempotent** — safe to retry after partial failure.
2. **Long jobs report progress** — update a job status row or log for UI polling where needed (PRC-007 bulk reprice).
3. **Jobs do not call `revalidatePath`** — they mutate data only; UI refreshes on next load.
4. **Failed jobs land in pg-boss dead letter** — surfaced by CHN-009-style health views where applicable.

## Consequences

- **Positive:** No new infrastructure; retries and schedules are first-class; worker scales independently later.
- **Negative:** Two processes to run locally and in Docker; developers must start worker in dev for scheduled tasks.
- **Neutral:** Package `pg-boss` added at PRC-002, not before.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| node-cron in app process | No persistence; dies on deploy; no retry |
| BullMQ + Redis | Extra service; ops burden for single-shop deploy |
| Vercel cron + serverless | Project is self-hosted Docker-first |
| PostgreSQL `pg_cron` | Less visibility; harder local dev |

## Related stories

PRC-002, PRC-007, CHN-004, GAM-005, A-007, BUY-007, SKU-003 (expiry).

## References

- [docker-compose.yml](../../../docker-compose.yml)
- [ADR-002](002-actor-context-propagation.md) — system actor
- [epic-13-autopricing.md](../../backlog/epic-13-autopricing.md)
