# TCG Chaos Inventory System

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

### Day-to-day commands

| Task | Command |
|------|---------|
| Start | `docker compose up` |
| Start (background) | `docker compose up -d` |
| Stop | `docker compose down` |
| Rebuild after code changes | `docker compose up --build` |
| View logs | `docker compose logs -f app` |
| Seed / re-seed | `docker compose exec app npm run db:seed` |
| Prisma Studio | `docker compose exec app npx prisma studio` |
| Backup JSON | Settings → Download backup, or `/api/backup/export` |
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

See [docs/BACKLOG.md](docs/BACKLOG.md) for the full prioritized backlog.

**Implemented:** Docker stack, Shelf/Bin/Block model, settings, backup export/restore, Mana Pool CSV export, **ManaBox position-indexed staging and formalize**

**Next:** Block activation (seal / remove-by-ID), Mana Pool order import, position pick lists
