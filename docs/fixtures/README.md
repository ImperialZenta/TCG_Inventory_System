# Test fixtures

Repeatable inputs for **automated tests** and **manual smoke** runs. See [TESTING-PLAYBOOK.md](../TESTING-PLAYBOOK.md) for when to use each.

| File | Use for |
|------|---------|
| `smoke-inventory-manabox.csv` | **Setup** — upload at `/staging` to create pickable blocks matching order/pullsheet fixtures |
| `manapool-order-sample.json` | **Orders** — import at `/orders` → Import test fixture (synthetic Test Cards) |
| `tcgplayer-pullsheet-sample.csv` | **Pick** — import at `/pick/import` (synthetic Test Cards) |
| `manapool-order-from-db.json` | **Orders** — 16 lines sampled from current ACTIVE blocks (regenerate after restore) |
| `tcgplayer-pullsheet-from-db.csv` | **Pick** — matching pullsheet for the DB-sourced order |

## Synthetic smoke set (Test Cards)

`smoke-inventory-manabox.csv`, `manapool-order-sample.json`, and `tcgplayer-pullsheet-sample.csv` share card names `Test Card B1-P1`, etc. **Import the ManaBox CSV and formalize + seal blocks before order/pullsheet smoke**, unless your DB already has matching inventory from a prior run.

## DB-sourced set (real ACTIVE inventory)

`*-from-db.*` fixtures are generated from whatever ACTIVE card lines are in `tcg_inventory` at generation time. They include exact `condition`, `finish`, `language`, and `scryfallId` so pick allocation can match.

Regenerate after a restore or inventory change:

```powershell
$env:DATABASE_URL = "postgresql://tcg:tcg@localhost:5432/tcg_inventory"
npm run fixtures:from-db
```

Optional: `COUNT=16` (minimum 12), `FIXTURE_OUT_DIR=docs/fixtures`.

Then at `/orders` → Import test fixture → choose `manapool-order-from-db.json` → Generate pick list.
