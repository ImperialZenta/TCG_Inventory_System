# Smoke test log

Append one entry per smoke session. Evidence for phase closure and Agent B follow-ups.

| Date | Build / branch | Path | Result | Notes |
|------|----------------|------|--------|-------|
| 2026-08-10 | local | Phase 5b + CHL-001/008/015 | PASS | Vitest 49/277; Phase 5b A/B/C + cancel + CHL-015 + E pass; CHL-012 pick gating deferred to Phase 4×5b path (Vitest covers) |
| 2026-08-07 | local | Phase 4 golden (DB restore + `manapool-order-from-db.json`) | PASS | Steps through quarantine→clear→complete; clear quarantine auto-released ON_HOLD (no manual Resume); order PICKED; Activity + Analytics populated; short rate 25% / median pick ~82m noted for later metric check; quarantine UX fix verified (general “Quarantined” copy) |
| 2026-08-09 | local | V-005 focused (restore Aug-7 backup → backfill → valuation UI) | PASS | Restored `tcg-inventory-backup-2026-08-07.json` (375 lines, all null prices); Settings backfill priced all blocks; `/` dashboard non-zero; `/blocks` block totals; `/analytics` capital/value; new backup `backups/tcg-inventory-backup-2026-08-09.json` with `priceCents`; Vitest 85/85; Agent B 7/7 V-005 |
| 2026-08-09 | local | Phase 5 golden (existing inventory) | PASS | Steps 1–6 + 2b; fixtures `manapool-order-dev-wave.json` / DEV-WAVE-001; webhook 503; Leaping Lizard qty on hand 1 available 1; waves MTG-0001 + MTG-0006. **Deferred UX:** inventory name search + Scryfall autocomplete feels kludgy (Counterspell partial match / wrong printing → “no copies”); bulk-move row ticks stay selected after successful move — expect clear on success |
| 2026-08-09 | local / b1c03ec+ | PL-009 prod/dev separation | PASS | Vitest **195/195** (`tests/pl009-prod-separation.test.ts` 13 tests); manual: prod **3000** + dev **3010** both up; `docker compose -f docker-compose.prod.yml down -v` → `tcg_prod_pgdata` volume survived → `/setup` HTTP 200 after restart; `backup-store.ps1` → `backups/store/tcg-store-2026-08-09-1141-b1c03ec.dump` (51 KB); restore guard: `destructive-scope.mjs restore DELETE` exit 1 with confirmation message; full pg_restore roundtrip **deferred** (run before first prod upgrade drill, not against live store mid-session) |
| 2026-08-09 | store-v1 / b4ef198 | C-007 ManaBox condition import | PASS | Deploy `store-v1`; re-upload ManaBox CSV (`near_mint` rows) on prod **3000** → staging + block detail show **Near Mint** (not Lightly Played); Vitest **212/212** incl. `manabox-condition-mapping.test.ts`; Agent B spec OK |

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
