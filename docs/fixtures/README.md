# Test fixtures

Repeatable inputs for **automated tests** and **manual smoke** runs. See [TESTING-PLAYBOOK.md](../TESTING-PLAYBOOK.md) for when to use each.

| File | Use for |
|------|---------|
| `smoke-inventory-manabox.csv` | **Setup** — upload at `/staging` to create pickable blocks matching order/pullsheet fixtures |
| `smoke-seed-open-manabox.csv` | **Optional setup** — one OPEN Lightning Bolt block for seed-inventory Step 2a (no Test Cards) |
| `smoke-seed-shelf-b-manabox.csv` | **Setup** — Path to Exile on shelf B when app image has not been rebuilt (Option B) |
| `manapool-order-sample.json` | **Orders** — import at `/orders` → Import test fixture (synthetic Test Cards) |
| `manapool-order-seed-wave.json` | **Orders** — Phase 5 Step 6 waves on a **fresh seeded** DB only (Bolt + Path to Exile) |
| `manapool-order-dev-wave.json` | **Orders** — Step 6 waves using **existing** imported blocks (Leaping Lizard + Homarid Spawning Bed) |
| `tcgplayer-pullsheet-sample.csv` | **Pick** — import at `/pick/import` (synthetic Test Cards) |
| `manapool-order-from-db.json` | **Orders** — 16 lines sampled from current ACTIVE blocks (regenerate after restore) |
| `tcgplayer-pullsheet-from-db.csv` | **Pick** — matching pullsheet for the DB-sourced order |

## Synthetic smoke set (Test Cards)

`smoke-inventory-manabox.csv`, `manapool-order-sample.json`, and `tcgplayer-pullsheet-sample.csv` share card names `Test Card B1-P1`, etc. **Import the ManaBox CSV and formalize + seal blocks before order/pullsheet smoke**, unless your DB already has matching inventory from a prior run.

## Seed inventory set (no Test Cards)

After `docker compose exec app npm run db:seed` on a **fresh** database only — see playbook for the full seed path. On an imported DB, seed will not replace existing blocks.

## Existing inventory golden path (your blocks today)

Use real card names from your ManaBox imports. Reference map: [`golden-path-inventory-map.json`](golden-path-inventory-map.json).

| File | Use for |
|------|---------|
| `golden-path-inventory-map.json` | Which blocks/cards to search, move, and pick for Phase 5 smoke |
| `manapool-order-dev-wave.json` | Step 6 — **DEV-WAVE-001** (Leaping Lizard + Homarid Spawning Bed) |
| `manapool-order-from-db.json` | Optional larger order — regenerate with `npm run fixtures:from-db` |

Regenerate `*-from-db.*` after inventory changes:

```powershell
docker compose run --rm --no-deps --entrypoint sh test -c "export DATABASE_URL=postgresql://tcg:tcg@db:5432/tcg_inventory FIXTURE_OUT_DIR=/app/docs/fixtures && npx tsx scripts/generate-fixtures-from-db.ts"
```

## DB-sourced set (real ACTIVE inventory)

`*-from-db.*` fixtures are generated from whatever ACTIVE card lines are in `tcg_inventory` at generation time. They include exact `condition`, `finish`, `language`, and `scryfallId` so pick allocation can match.

Regenerate after a restore or inventory change:

```powershell
$env:DATABASE_URL = "postgresql://tcg:tcg@localhost:5432/tcg_inventory"
npm run fixtures:from-db
```

Optional: `COUNT=16` (minimum 12), `FIXTURE_OUT_DIR=docs/fixtures`.

Then at `/orders` → Import test fixture → choose `manapool-order-from-db.json` → Generate pick list.
