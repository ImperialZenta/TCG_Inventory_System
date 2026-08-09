# ADR-012: Condition vocabulary and import mapping

| | |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-08-09 |
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
**CHN-006**, not intake.

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

Formalize, seal, and Mana Pool listing CSV export copy **internal** codes unchanged
([`toManaPoolCsv`](../../../src/lib/manapool/csv-export.ts) already emits `NM`, `LP`, …).

### No schema migration

The `Condition` enum is unchanged. Existing rows wrongly stored as LP from `near_mint` are not
auto-migrated.

## Consequences

- **Positive:** Staging and block detail match staff intent from ManaBox; listing export condition
  matches TCGplayer/Mana Pool order vocabulary; one map module is the single intake seam.
- **Negative:** Mana Pool's ManaBox roundtrip table differs from intake (`near_mint` → LP there);
  a future Mana Pool → ManaBox → app path needs an explicit channel adapter, not this map.
- **Neutral:** **GAM-006** generalises per-game vocabularies; C-007 is the MTG/ManaBox slice.
  **I-026** (optional batch condition override on upload) remains deferred polish.

## Related

- **C-003** — internal enum and default NM
- **I-009** — ManaBox CSV upload to staging
- **CHN-006** — channel export/import adapters (future)
- **GAM-006** — per-game condition vocabularies (future)
