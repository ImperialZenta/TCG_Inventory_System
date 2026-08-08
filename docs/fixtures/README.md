# Test fixtures

Repeatable inputs for **automated tests** and **manual smoke** runs. See [TESTING-PLAYBOOK.md](../TESTING-PLAYBOOK.md) for when to use each.

| File | Use for |
|------|---------|
| `smoke-inventory-manabox.csv` | **Setup** — upload at `/staging` to create pickable blocks matching order/pullsheet fixtures |
| `manapool-order-sample.json` | **Orders** — import at `/orders` → Import test fixture |
| `tcgplayer-pullsheet-sample.csv` | **Pick** — import at `/pick` → Import pullsheet |

All three share card names `Test Card B1-P1`, etc. **Import the ManaBox CSV and formalize + seal blocks before order/pullsheet smoke**, unless your DB already has matching inventory from a prior run.
