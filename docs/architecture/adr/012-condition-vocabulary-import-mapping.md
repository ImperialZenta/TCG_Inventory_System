# ADR-012: Condition vocabulary and import mapping

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-09 · amended 2026-08-12 (**CHL-016** listing outward map) |
| **First implementer** | **C-007** (ManaBox CSV condition import aligned to TCGplayer scale) |

## Context

The app stores card condition as the Prisma enum `NM | LP | MP | HP | DMG` with TCGplayer display
labels ([`CONDITION_LABELS`](../../../src/lib/constants.ts)). **C-003** established the internal
scale and default-empty → `NM` behaviour.

ManaBox CSV exports use **seven** snake_case grades (`mint`, `near_mint`, `excellent`, …). The
import map in [`MANABOX_CONDITION_MAP`](../../../prisma/languages-data.ts) had copied Mana Pool's
[ManaBox roundtrip collapse](https://support.manapool.com/hc/en-us/articles/26131255560855)
(`near_mint` → LP), which is correct for **re-importing Mana Pool listing CSVs back into ManaBox**,
not for **intake** where staff grade in ManaBox and expect TCGplayer-aligned storage.

Production impact: cards graded `near_mint` in ManaBox displayed as "Lightly Played" after staging
formalize. No raw import value is persisted today, so correction is by **CSV re-import**, not DB
backfill.

## Decision

### Internal scale = TCGplayer NM–DMG

One internal enum for reporting, listing export, and order normalization. Display uses TCGplayer
names. Channel-specific outward translation (e.g. Mana Pool ManaBox roundtrip) belongs under
listing/channel export, not intake. **CHL-016** is the Mana Pool listing map; **CHN-006** still
owns other marketplace templates.

### ManaBox 7 → internal 5 at import only

[`mapManaboxCondition`](../../../prisma/languages-data.ts) normalizes CSV text (trim, lower case,
spaces → underscores) and looks up [`MANABOX_CONDITION_MAP`](../../../prisma/languages-data.ts):

| ManaBox CSV | Internal | TCGplayer label |
|---|---|---|
| `mint` | NM | Near Mint |
| `near_mint` | NM | Near Mint |
| `excellent` | LP | Lightly Played |
| `good` | MP | Moderately Played |
| `light_played` | HP | Heavily Played |
| `played` | HP | Heavily Played |
| `poor` | DMG | Damaged |

Also unchanged on import: literal abbreviations `NM`/`LP`/… and empty/missing → `NM`
([`mapCondition`](../../../src/lib/manabox/csv-import.ts)).

Formalize and seal copy **internal** codes unchanged. Mana Pool listing CSV does **not** emit
those codes: [`toManaPoolCsv`](../../../src/lib/manapool/csv-export.ts) translates via
[`INTERNAL_TO_MANAPOOL_CONDITION`](../../../prisma/languages-data.ts) (**CHL-016**), the inverse
of Mana Pool's ManaBox import table — not the inverse of `MANABOX_CONDITION_MAP`.

| Internal | Listing CSV | Mana Pool lists as |
|---|---|---|
| NM | `mint` | NM |
| LP | `near_mint` | LP |
| MP | `good` | MP |
| HP | `light_played` | HP |
| DMG | `poor` | DMG |

Unknown / missing condition falls back to `mint`. Intake is unchanged: ManaBox `near_mint` still
imports as NM.

### No schema migration

The `Condition` enum is unchanged. Existing rows wrongly stored as LP from `near_mint` are not
auto-migrated.

## Consequences

- **Positive:** Staging and block detail match staff intent from ManaBox; listing CSV conditions
  round-trip to the intended Mana Pool seller grade; intake and listing maps are separate seams
  in one module.
- **Negative:** Intake and listing maps are not inverses (`near_mint` → NM on intake, LP on
  Mana Pool import). A future Mana Pool → ManaBox → app path still needs an explicit adapter.
- **Neutral:** **GAM-006** generalises per-game vocabularies; C-007 is the MTG/ManaBox intake
  slice. **I-026** (optional batch condition override on upload) remains deferred polish.
  Full multi-channel export templates remain **CHN-006**.

## Related

- **C-003** — internal enum and default NM
- **I-009** — ManaBox CSV upload to staging
- **CHL-016** — Mana Pool listing CSV outward map (`mint` for NM)
- **CHN-006** — channel export/import adapters (future)
- **GAM-006** — per-game condition vocabularies (future)
