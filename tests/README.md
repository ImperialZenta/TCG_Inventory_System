# Integration tests (PL-008)

Vitest integration tests for block remove, staging undo/redo, pick guard, and lifecycle.

## Prerequisites

Postgres via Docker Compose:

```powershell
docker compose up -d db
```

The first `prisma db push` against `tcg_inventory_test` creates that database if it is missing.

## Run via Docker (no local Node/npm required)

From the repo root:

```powershell
docker compose up -d db

docker run --rm --network tcg_inventory_system_default `
  -v "${PWD}:/app" -w /app `
  -e DATABASE_URL=postgresql://tcg:tcg@db:5432/tcg_inventory_test `
  node:20-alpine sh -c "npm ci --ignore-scripts && npx prisma generate && npx prisma db push --skip-generate && npm run test"
```

If `node_modules` is already present (e.g. after a prior install), you can skip install:

```powershell
docker run --rm --network tcg_inventory_system_default `
  -v "${PWD}:/app" -w /app `
  -e DATABASE_URL=postgresql://tcg:tcg@db:5432/tcg_inventory_test `
  node:20-alpine sh -c "npx prisma db push --skip-generate && npm run test"
```

## Run with local Node (optional)

If Node.js is installed and on your PATH:

```powershell
$env:DATABASE_URL="postgresql://tcg:tcg@localhost:5432/tcg_inventory_test"
npm run db:push
npm run test
```

Watch mode:

```powershell
$env:DATABASE_URL="postgresql://tcg:tcg@localhost:5432/tcg_inventory_test"
npm run test:watch
```

## Safety

`tests/setup.ts` refuses to run if `DATABASE_URL` does not contain `test`. Do not point tests at the production or primary development database.

## Coverage (acceptance)

| Suite | Stories |
|-------|---------|
| `undo-formalize.test.ts` | I-023 |
| `block-remove.test.ts` | I-015, I-021 current behavior, B-010 |
| `block-lifecycle.test.ts` | B-002 |
| `pick-guard.test.ts` | B-010 helpers |
