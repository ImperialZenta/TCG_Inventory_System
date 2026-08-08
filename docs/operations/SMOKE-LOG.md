# Smoke test log

Append one entry per smoke session. Evidence for phase closure and Agent B follow-ups.

| Date | Build / branch | Path | Result | Notes |
|------|----------------|------|--------|-------|
| YYYY-MM-DD | main / local | Phase 4 golden | PASS / FAIL | e.g. Vitest 48/48; steps 1–14 manual |

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
