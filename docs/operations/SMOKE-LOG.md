# Smoke test log

Append one entry per smoke session. Evidence for phase closure and Agent B follow-ups.

| Date | Build / branch | Path | Result | Notes |
|------|----------------|------|--------|-------|
| YYYY-MM-DD | main / local | Phase 4 golden | PASS / FAIL | e.g. Vitest 48/48; steps 1–14 manual |
| 2026-08-07 | local | Phase 4 golden (DB restore + `manapool-order-from-db.json`) | PASS | Steps through quarantine→clear→complete; clear quarantine auto-released ON_HOLD (no manual Resume); order PICKED; Activity + Analytics populated; short rate 25% / median pick ~82m noted for later metric check; quarantine UX fix verified (general “Quarantined” copy) |
| 2026-08-09 | local | V-005 focused (restore Aug-7 backup → backfill → valuation UI) | PASS | Restored `tcg-inventory-backup-2026-08-07.json` (375 lines, all null prices); Settings backfill priced all blocks; `/` dashboard non-zero; `/blocks` block totals; `/analytics` capital/value; new backup `backups/tcg-inventory-backup-2026-08-09.json` with `priceCents`; Vitest 85/85; Agent B 7/7 V-005 |
| 2026-08-09 | local | Phase 5 golden (existing inventory) | PASS | Steps 1–6 + 2b; fixtures `manapool-order-dev-wave.json` / DEV-WAVE-001; webhook 503; Leaping Lizard qty on hand 1 available 1; waves MTG-0001 + MTG-0006. **Deferred UX:** inventory name search + Scryfall autocomplete feels kludgy (Counterspell partial match / wrong printing → “no copies”); bulk-move row ticks stay selected after successful move — expect clear on success |
| 2026-08-09 | local | ACC-003 gate (ACC-001 A + ACC-002 B + ACC-003 C) | PASS | Real-card fixtures (`staging-01`, `staging-02`, `manapool-order-staging-01.json`); blocks MTG-0001–0003; A3 401 Unauthorized confirmed pass; roles Owner/Manager/Staff/Read-only; C4 Staff pick + actor on Activity; inventory decrement UX fix applied (card name in summary). Vitest 182/182. Agent B ACC gate prior. No findings outside expectations. |

---

## Narrated session template

Paste into a Cursor chat while walking a path (see [TESTING-PLAYBOOK.md](../TESTING-PLAYBOOK.md#narrated-smoke-sessions-ai-native-practice)):

```text
Smoke session — {path name}
Date: YYYY-MM-DD
Build: local / {branch}
Vitest: pass / fail / not run ({count if run})

Step N {route} — {action} — PASS | FAIL: {observed}
...

End session. Summarize for SMOKE-LOG row. Do not implement fixes.
```

**Finding shorthand** (paste into Agent B when any step FAILs):

```text
FINDING
- Observed:
- Expected:
- Story:
- Layer: smoke | regression | spec
- Severity: blocks ops | wrong data | cosmetic
- Repro:
```
