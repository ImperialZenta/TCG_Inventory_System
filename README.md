# TCG Chaos Inventory System

**Forxia Industries Corp.**

Block-based chaos inventory for **Magic: The Gathering**. Stage cards via ManaBox CSV, formalize into blocks on shelves and bins, export Mana Pool listings, import orders, and pick by location.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Prisma** + **PostgreSQL 16** (Docker)
- **Tailwind CSS 4**
- **Scryfall API** for MTG card catalog

## Prerequisites

- [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/) running
- Verify: `docker run hello-world`

## Quick Start (Docker)

```powershell
cd C:\AI\TCG_Inventory_System

# Copy environment file
copy .env.example .env

# Build and start (first run takes several minutes)
docker compose up --build

# In a second terminal — seed sample shelves, bins, and blocks
docker compose exec app npm run db:seed
```

Open [http://localhost:3000](http://localhost:3000).

**First visit:** open `/setup` and create the owner account (or set `SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` in `.env` before seeding for a dev login).

### Day-to-day commands

| Task | Command |
|------|---------|
| Start | `docker compose up` |
| Start (background) | `docker compose up -d` |
| Stop | `docker compose down` |
| Rebuild after code changes | `docker compose up --build` |
| Apply schema after pull/rebuild | `docker compose exec app npm run db:migrate` (uses deploy, falls back to push) |
| View logs | `docker compose logs -f app` |
| Seed / re-seed | `docker compose exec app npm run db:seed` |
| Run tests | `docker compose --profile test run --rm test` (or `npm run test:docker` if npm is on PATH) |
| Prisma Studio | `docker compose exec app npx prisma studio` |
| Backup JSON | Settings → Download backup (requires sign-in), or `/api/backup/export` |
| Restore backup | Settings → Backup section → upload JSON, type `RESTORE` |

**Data persistence:** Inventory lives in the `pgdata` Docker volume. `docker compose down` keeps data. `docker compose down -v` wipes it.

**Dependencies:** Installs use the committed `package-lock.json` with `npm ci --ignore-scripts` (blocks malicious `preinstall` hooks). Prisma client generation runs explicitly after install. Pin overrides in `package.json` block known ChainDrop cache package versions.

## Local development (without Docker)

Requires Node.js 20+ and a PostgreSQL instance.

```bash
npm ci
# Or, to skip all install lifecycle scripts: npm ci --ignore-scripts && npx prisma generate
npm run db:push
npm run db:seed
npm run dev
```

When adding or upgrading packages locally, commit the updated `package-lock.json`:

```bash
npm install <package>
git add package.json package-lock.json
```

## Workflow overview

1. **Settings** — Configure shelves and bins, staging target count (e.g. 50)
2. **Staging** — Upload ManaBox CSV; expand quantities to positions; pack brick to match sheet order
3. **Blocks** — Formalized position-indexed inventory (Scryfall ID + condition + finish + language)
4. **Block detail** — Download Mana Pool listing CSV (edit prices, import at manapool.com)
5. **Orders** — Import Mana Pool orders via API (Phase 4)
6. **Pick lists** — Position-aware picking (Phase 4)

## Environment variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `STALE_BLOCK_DAYS` | Days without pick before block is stale (default 90) |
| `MANAPOOL_EMAIL` | Mana Pool seller email (optional, for API) |
| `MANAPOOL_API_TOKEN` | Mana Pool API token (optional) |
| `MANAPOOL_WEBHOOK_SECRET` | HMAC secret for inbound order webhooks (**required in production**; routes return 503 if unset) |
| `CRON_SECRET` | Bearer token for `POST /api/cron/sync-manapool-orders` (**required in production**) |
| `ALLOW_INSECURE_INBOUND` | Set `true` for local dev only to allow webhook/cron without secrets |
| `RUN_SEED` | Set `true` on container start to auto-seed |

## Supply-chain hygiene

This repo pins dependencies via `package-lock.json` and `overrides` for cache packages commonly targeted in npm worm campaigns (e.g. ChainDrop, Aug 2026).

After `npm ci` or `npm install`, you can spot-check the lockfile for known bad versions:

```powershell
Select-String -Path package-lock.json -Pattern 'keyv@6\.0\.0|flat-cache@6\.1\.24|file-entry-cache@11\.1\.6'
```

If you installed packages during an active npm incident window, rotate npm tokens, GitHub credentials, and cloud secrets from that machine.

## Project structure

```
src/
├── app/
│   ├── staging/          # ManaBox CSV intake (Phase 2)
│   ├── blocks/           # Block list + detail + CSV export
│   ├── orders/           # Mana Pool order import (Phase 4)
│   ├── pick/             # Pick lists (Phase 4)
│   ├── settings/         # Shelves, bins, backup
│   └── api/backup/       # JSON export
├── lib/
│   ├── blocks.ts         # Block stats, pick routing
│   ├── location.ts       # Shelf/bin helpers
│   ├── languages.ts      # Scryfall ↔ Mana Pool mapping
│   └── manapool/         # CSV export, API client (Phase 4)
prisma/
├── schema.prisma         # PostgreSQL schema
└── seed.ts               # Sample data
docker-compose.yml
Dockerfile
```

## Roadmap

[docs/BACKLOG.md](docs/BACKLOG.md) is the index. Story detail, INVEST framing and Gherkin acceptance criteria live in [docs/backlog/](docs/backlog/), one file per epic.

| Document | Contents |
|----------|----------|
| [Architecture](docs/architecture/ARCHITECTURE.md) | Runways, target shape, ADR index |
| [Conventions](docs/backlog/CONVENTIONS.md) | INVEST definition of ready, Gherkin house style, ID prefix registry |
| [Testing](docs/TESTING.md) | Vitest, Docker test service, two-agent workflow, spec compliance |
| [Testing playbook](docs/TESTING-PLAYBOOK.md) | When to test, golden paths, smoke log, Cursor hooks |
| [SortSwift parity matrix](docs/backlog/PARITY-SORTSWIFT.md) | Gap analysis, dual inventory rationale, parity phasing |
| [Intake strategy](docs/backlog/INTAKE-STRATEGY.md) | Scan → CSV → staging, the sort decision, recovery paths |
| [Status audit, Aug 2026](docs/backlog/AUDIT-2026-08.md) | Status corrections found by reading the code |
| [Sales literature](docs/sales/README.md) | **Forxia Industries Corp.** — [1-pager](docs/sales/PRODUCT-OVERVIEW.pdf), [2-pager roadmap](docs/sales/ROADMAP-AND-FEATURES.pdf), [6-pager strategy](docs/sales/AMAZON-6-PAGER.pdf) |

**Implemented:** Docker stack, Shelf/Bin/Block model, settings, backup export/restore, Mana Pool CSV export, ManaBox position-indexed staging and formalize, block lifecycle and seal, guarded block removal and undo formalize, inventory event log with Activity feed, aging analytics, **Phase 4 orders and picking**, **Phase 5 polish** (card search, global quantity, bulk block transfer, pick waves, webhook/cron auth), **V-005 price persistence**.

**Next (Phase 6):** Staff login (**ACC-***), sellable stock ledger (**SKU-***).

### Dual inventory direction

Phases 6+ pursue feature parity with SortSwift by adding a **second inventory mode** beside chaos blocks: sorted sellable stock with a live per-SKU quantity that can be priced by rules and synced to marketplaces without overselling.

| | Chaos bulk mode | Sorted stock mode |
|---|---|---|
| Model | `Block` + `CardLine` | `StockItem` + `StockMovement` (planned) |
| Address | `MTG-0007` position 14 | Shelf / bin / row |
| Sellable individually | No — sealed brick, picked by position | Yes — quantity syncs to channels |

A physical card lives in exactly one mode; moving between them is an explicit, audited promote action. Chaos blocks are not being replaced — they remain the right answer for bulk that is not worth sorting.
