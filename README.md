# TCG Chaos Inventory System

Block-based chaos inventory for **Magic: The Gathering**. Pack mixed cards into numbered blocks, track physical locations, generate pick lists, and monitor aging inventory.

## Stack

- **Next.js 15** (App Router) + TypeScript
- **Prisma** + SQLite (dev) — swap to PostgreSQL for production
- **Tailwind CSS 4**
- **Scryfall API** for MTG card catalog

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Create database and generate Prisma client
npm run db:push

# Seed sample blocks and locations
npm run db:seed

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:push` | Sync Prisma schema to database |
| `npm run db:migrate` | Create migration (production) |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |

## Project Structure

```
src/
├── app/                  # Next.js routes
│   ├── page.tsx          # Dashboard
│   ├── blocks/           # Block list + detail
│   ├── intake/           # Pack new blocks (stub)
│   ├── inventory/        # Card search (stub)
│   ├── pick/             # Pick lists (stub)
│   ├── analytics/        # Aging analytics
│   └── api/cards/search/ # Scryfall proxy
├── components/           # UI components
├── lib/                  # DB, Scryfall, block helpers
└── types/                # Shared TypeScript types

prisma/
├── schema.prisma         # Data model
└── seed.ts               # Sample data
```

## Core Concepts

### Chaos Blocks

Cards are stored in mixed physical containers (blocks) without sorting by set or name. Each block gets a human-readable ID (`MTG-0001`), a shelf location, and lifecycle status (`OPEN` → `SEALED` → `ACTIVE`).

### Block Aging

Analytics track **days since last pick** per block. Blocks idle past the threshold (default 90 days) surface on the dashboard and analytics page for review — sort, bundle, or liquidate.

### Data Model

| Entity | Purpose |
|--------|---------|
| `Block` | Physical chaos container |
| `Location` | Shelf/zone/slot address |
| `CardLine` | Card or bulk line inside a block |
| `PickList` / `PickItem` | Order fulfillment |
| `AuditLog` | Change history |

See `prisma/schema.prisma` for the full schema.

## Phase 1 Roadmap

See [docs/BACKLOG.md](docs/BACKLOG.md) for the full prioritized backlog.

**MVP (scaffolded):**
- Block + location data model
- Dashboard with aging stats
- Block list and detail views
- Analytics page (stale blocks, aging buckets)
- Scryfall search API route

**Next up:**
- Intake workflow (pack + seal blocks)
- Card search across blocks
- Pick list generation
- QR label printing

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | Prisma database connection |
| `STALE_BLOCK_DAYS` | `90` | Days without pick before block is stale |

## License

Private — all rights reserved.
