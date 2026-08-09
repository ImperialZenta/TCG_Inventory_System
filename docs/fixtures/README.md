# Test fixtures

Repeatable inputs for **automated tests** and **manual smoke** runs. See [TESTING-PLAYBOOK.md](../TESTING-PLAYBOOK.md) for when to use each.

Every card in here is real. The staging CSVs are verbatim slices of [`source/manabox-dax-250.csv`](source/manabox-dax-250.csv), a 250-row ManaBox export, so `Scryfall ID`, condition, finish, and language all match what the app stores.

## Staging set (upload at `/staging`)

Run these in order — the numbering is the order the playbook uses them, and the slices share no cards.

| File | Rows / units | Formalizes to | Use for |
|------|--------------|---------------|---------|
| [`staging-01-single-block.csv`](staging-01-single-block.csv) | 12 / 12 | 1 block | Baseline intake. Seal it — every pick fixture below draws from this block |
| [`staging-02-two-blocks.csv`](staging-02-two-blocks.csv) | 20 / 20 | 2 blocks at target count **10** | Per-block bin assignment, and leaving a block OPEN to check the pick guard |
| [`staging-03-qty-split.csv`](staging-03-qty-split.csv) | 6 / 24 | 3 blocks at target count **8** | Quantity expansion, and the warning when one CSV row's copies straddle a block boundary |
| [`staging-04-shelf-b.csv`](staging-04-shelf-b.csv) | 6 / 6 | 1 block | Stock on shelf **B** so the wave order splits across two shelves |
| [`staging-05-undo.csv`](staging-05-undo.csv) | 4 / 4 | 1 block | Disposable — undo formalize, discard staging, delete staging |

## Pick set (needs staging-01 and staging-04 formalized and sealed)

| File | Use for |
|------|---------|
| [`manapool-order-staging-01.json`](manapool-order-staging-01.json) | `/orders` → Import test fixture. Order **STAGE-ORDER-001**, 4 lines |
| [`tcgplayer-pullsheet-staging-01.csv`](tcgplayer-pullsheet-staging-01.csv) | `/pick/import` pullsheet (P-007), 4 different cards from the same block |
| [`manapool-order-staging-wave.json`](manapool-order-staging-wave.json) | Order **STAGE-WAVE-001** — wave 1 on shelf A, wave 2 on shelf B |

The order, the pullsheet, and the wave order claim **different** cards. Each staging-01 card is a single copy, so overlapping fixtures would leave the second pick list short. [`golden-path-inventory-map.json`](golden-path-inventory-map.json) records which fixture claims what, plus the three spare cards left for counter picks and ad-hoc searches.

## Regenerating

Edit the slice spec in [`scripts/generate-staging-fixtures.ts`](../../scripts/generate-staging-fixtures.ts), then:

```powershell
docker compose run --rm --no-deps -v "${PWD}:/work" --entrypoint sh test -c "cd /work && /app/node_modules/.bin/tsx scripts/generate-staging-fixtures.ts"
```

Or, with Node on the host: `npm run fixtures:staging`.

Slices name cards by `Name|SET|collector number`. The script fails if a named card is missing from the source or claimed by two slices, so the fixtures cannot silently drift apart.

## DB-sourced set (real ACTIVE inventory)

`*-from-db.*` are generated from whatever ACTIVE card lines are in `tcg_inventory` at generation time, for a larger order than the staging set produces.

| File | Use for |
|------|---------|
| [`manapool-order-from-db.json`](manapool-order-from-db.json) | `/orders` — 16 lines sampled from current ACTIVE blocks |
| [`tcgplayer-pullsheet-from-db.csv`](tcgplayer-pullsheet-from-db.csv) | Matching pullsheet |

Regenerate after a restore or a large inventory change:

```powershell
$env:DATABASE_URL = "postgresql://tcg:tcg@localhost:5432/tcg_inventory"
npm run fixtures:from-db
```

Optional: `COUNT=16` (minimum 12), `FIXTURE_OUT_DIR=docs/fixtures`.
