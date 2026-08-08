# Testing Playbook

**Your cheat sheet** — when to test, what to run, and how to turn smoke observations into action.

Technical reference: [TESTING.md](TESTING.md) · Agent B skill: [`.cursor/skills/spec-compliance-review/SKILL.md`](../.cursor/skills/spec-compliance-review/SKILL.md)

---

## Three layers (memorize the triggers)

| Layer | Trigger | Time | Command / action |
|-------|---------|------|------------------|
| **1 — Regression gate** | End of every build session | ~5 min | `docker compose --profile test run --rm test` |
| **2 — Spec compliance (Agent B)** | Before `@done`, before phase closure, after smoke surprises | ~10 min | Fresh chat → spec compliance skill + story ID(s) |
| **3 — Operational smoke** | After Layer 1 green; before calling a phase “closed” | ~20 min | Golden path below |

**Do not skip Layer 1 because Layer 3 felt fine.** Smoke happy paths miss guards (ON_HOLD, quarantine, OPEN block exclusion).

---

## When to re-run what

Three contexts — don’t confuse them:

| Context | Database | Who sets up data |
|---------|----------|------------------|
| **Vitest** (`tcg_inventory_test`) | Fresh every test | Tests via `resetTestDb()` + fixtures |
| **Dev app** (`tcg_inventory`, localhost:3000) | Persists in Docker volume | You (seed, staging CSV, clicking) |
| **“Fresh dev DB”** | Wiped or never had smoke inventory | You redo staging setup once |

### By goal — what to run

| Goal | Fresh dev DB setup? | Layer 1 (Vitest) | Layer 2 (Agent B) | Layer 3 (smoke) |
|------|---------------------|------------------|-------------------|-----------------|
| Quick check after a small fix | No | **Yes** (~5 min) | Only if you touched a Must story’s behavior | Skip, or 2 min on the page you changed |
| Same day, same area, tests green, dev DB still has Test Card blocks | No | **Yes** | If story status / Gherkin might change | **Focused** path only (see golden path steps for that story) |
| First time testing picking on this machine | **Yes** — staging CSV + seal (once) | **Yes** | Optional | Focused pick path |
| After `docker compose down -v` or re-seed | **Yes** — smoke inventory setup | **Yes** | Optional | As much as you have time for |
| Before `@done` or Done in BACKLOG | No | **Yes** | **Yes** — that story | Steps covering that story’s scenarios |
| Phase / epic closure | Clean dev DB nice but not required | **Yes** | **Yes** — all Must stories | **Full** golden path |
| Smoke felt wrong, tests green | No | Already ran | **Yes** — FINDING template | Repro the failing step only |

### What “memory” is retained

| Mechanism | Remembers | Until |
|-----------|-----------|-------|
| `tests/*.test.ts` | Asserted behavior | Test deleted or assertion weakened |
| Gherkin `@done` + Agent B report | Spec + coverage claim | You change the epic without re-review |
| [SMOKE-LOG.md](operations/SMOKE-LOG.md) | Human walked a path on a date | Next code change (smoke is not auto-replayed) |
| Dev DB inventory | Blocks, orders, pick lists | Volume wipe, undo formalize, or destructive test |

**Rule of thumb:** run Vitest often (cheap, machine memory). Repeat full manual golden path only at milestones or after wiping dev data. Log milestones in SMOKE-LOG.

---

## When to test (decision tree)

```text
Did I (or Agent A) change src/, tests/, or prisma/schema?
  YES → Run Layer 1 before stopping for the day
        → Run Layer 2 for each story ID touched
        → Run focused smoke (subset of golden path for those stories)

Am I about to flip @pending → @done or mark a story Done in BACKLOG.md?
  YES → Layer 2 on that story first (fresh chat)
        → Only flip tags if Agent B says justified

Am I closing a phase or declaring “Epic X complete”?
  YES → Layer 2 on all Must stories in the epic
        → Full golden path (Layer 3)
        → Log result in [operations/SMOKE-LOG.md](operations/SMOKE-LOG.md)

Did smoke feel wrong but tests are green?
  YES → Layer 2 with FINDING template (below)
        → Do not let Agent A fix until classified (spec vs bug vs gap)
```

---

## When to open a fresh chat

Long threads fill the context window, get compacted, and mix implement + verify in one bias. **Fresh chats are role boundaries**, not etiquette.

### Why it matters

| Problem | What happens |
|---------|----------------|
| Context compaction | Early constraints drop (“minimal diff”, “don’t weaken tests”) |
| Implementation drift | Same agent defends code it wrote instead of re-reading the spec |
| Mixed goals | Build + refactor + backlog Q&A in one thread pulls in different directions |
| Stale assumptions | Agent cites file state from before your manual revert |

**Durable memory lives in git, tests, Gherkin, and SMOKE-LOG — not in chat history.**

### Always fresh (hard rules)

| Moment | Chat role |
|--------|-----------|
| Spec compliance / **Agent B** | Verify only — never the implementation thread |
| After Agent B reports gaps | **New Agent A** — paste the report; implement from spec |
| Smoke **FAIL** → classify before fix | **Agent B** first; don’t fix in the smoke/narration chat |
| **Bugbot** or security review | Separate pass |
| Unrelated backlog story | New Agent A (e.g. P-011 done → start P-007 in a new chat) |

### New Agent A chat when building

| Signal | Action |
|--------|--------|
| One story landed (code + tests) | New chat for the **next** story |
| Topic / epic area changes | New chat |
| ~15–25+ turns or thread feels muddled | New chat + handoff block (below) |
| Agent repeats mistakes or cites wrong files | New chat |
| You manually reverted a lot | New chat — old file assumptions are stale |
| Major design pivot | New chat with updated requirements only |

**Stay in the same chat when:** same story, iterative fix; debugging one test from the change you just made; small follow-up on code written in that thread.

### Chat types (simple model)

```text
Build chat   → one story or tight slice (Agent A)
Verify chat  → Agent B, smoke narration, FINDING classification
Fix chat       → new Agent A with Verify chat output pasted
Explore chat   → backlog/architecture questions (read-only; doesn’t pollute Build)
```

You don’t need four windows open. Typical flow: **Build → Verify → (optional) Fix**.

### Handoff into a new chat (~30 sec)

```text
Continuing TCG Inventory System.

Done in previous chat:
- Stories / files: [e.g. P-011 — src/lib/blocks/quarantine.ts]
- Vitest: pass / fail
- Open: [Agent B gaps or smoke FAILs]

Task now:
- [single next step]

Constraints:
- Story {ID} in docs/backlog/epic-NN-*.md
- Minimal diff; existing conventions
- Do not flip @done without Agent B
```

### Layers vs same chat

| Layer | Same chat as implementation? |
|-------|------------------------------|
| Layer 1 — Vitest | Yes — agent can run the command |
| Layer 2 — Agent B | **No — always fresh** |
| Layer 3 — narrated smoke | **Separate** from Build; optional dedicated smoke-log chat |
| Fix after smoke FAIL | **Fresh Agent A** with FINDING + Agent B summary |

### Signs the thread is too long

- Proposes edits to files you already fixed elsewhere  
- Quotes code that doesn’t match disk  
- Skips reading files and guesses  
- Contradicts `TESTING-PLAYBOOK.md` or epic Gherkin  
- You re-explain the same constraints  

→ New chat + handoff. Cheaper than fighting the thread.

---

## Layer 1 — Regression gate

```powershell
docker compose up -d db
docker compose --profile test run --rm test
```

Expect: all tests pass. If fail → fix before new features.

**Invalid:** `docker compose exec app npm test` (prod image has no tests).

---

## Layer 2 — Agent B (spec compliance)

Open a **new Cursor chat** (not the implementation chat).

```text
Read .cursor/skills/spec-compliance-review/SKILL.md and review story P-011
```

Batch example:

```text
Read .cursor/skills/spec-compliance-review/SKILL.md and review all Must stories in docs/backlog/epic-04-picking.md
```

**End-of-session orchestrator prompt** (when you forget what to run):

```text
I'm done implementing for today. Act as my test orchestrator:
1) Give the exact docker test command.
2) List story IDs from my session that need Agent B.
3) Give a 10-minute smoke checklist for those stories only.
Do not implement anything.
```

---

## Layer 3 — Golden paths

### Prerequisites (fresh database)

```powershell
docker compose up -d
docker compose exec app npm run db:seed
```

Card names in [`fixtures/manapool-order-sample.json`](fixtures/manapool-order-sample.json) require **Test Card** inventory — seed alone gives Lightning Bolt on `MTG-0001`, which will not match the fixture.

**One-time smoke inventory setup (~5 min):**

| Step | Where | Action | Pass if |
|------|-------|--------|---------|
| 1 | `/staging` | Upload [`fixtures/smoke-inventory-manabox.csv`](fixtures/smoke-inventory-manabox.csv) | Import appears in pending list |
| 2 | Staging review | Open import; target count **2**; assign both suggested blocks to bin **A-B01** | Formalize succeeds |
| 3 | Staging review or `/blocks` | **Seal** both new blocks (OPEN → SEALED) | Status SEALED; cards at positions 1–2 each |

See [fixtures/README.md](fixtures/README.md).

---

### Phase 4 golden path — order → pick → ship (~20 min)

Stories exercised: P-001, P-002, P-003, P-004, P-006, P-009, P-011, P-012, P-014 (+ P-005 counter pick, P-007 pullsheet as optional branches)

| # | Route | You do | Pass if |
|---|-------|--------|---------|
| 1 | `/orders` | **Import test fixture** → choose `docs/fixtures/manapool-order-sample.json` | Success message; order **TEST-ORDER-001** in table |
| 2 | `/orders/{id}` | Open order; review 2 lines (`Test Card B1-P1`, `B1-P2`) | Lines match fixture |
| 3 | Order detail | Click **Generate pick list** | Redirect or link to new pick list |
| 4 | `/pick` | Confirm list under **Active** with item count | Status not COMPLETED |
| 5 | `/pick/{id}` | Scan pick order top to bottom | Blocks grouped; shelf/bin order sensible |
| 6 | Pick detail | Click **Picked** on first item | Status badge updates; position renumber if applicable |
| 7 | Pick detail | **Hold list** (toolbar) | Status ON_HOLD; badge on `/pick` |
| 8 | Pick detail (ON_HOLD) | Try **Picked** on a pending item | Action refused or button disabled (ON_HOLD guard) |
| 9 | Pick detail | **Resume** → **Re-allocate** (while ON_HOLD) | Pending lines refresh without error |
| 10 | Pick detail | **Quarantine block** on a pending item | Block quarantined; list may move ON_HOLD |
| 11 | `/blocks/{blockId}` | Open quarantined block | Quarantine banner; **Clear quarantine** available |
| 12 | `/pick/{id}` | **Resume** if ON_HOLD; finish remaining picks | List can complete when all items resolved |
| 13 | `/activity` | Open Activity | Pick / allocation events present |
| 14 | `/analytics` | Scroll to pick metrics section | Counts non-empty after picks |

**Optional branches**

| Branch | Route | Action |
|--------|-------|--------|
| Counter pick (P-005) | `/blocks/MTG-…` | **Counter pick** form — pick position 1 |
| Pullsheet (P-007) | `/pick/import` | Upload `docs/fixtures/tcgplayer-pullsheet-sample.csv` |
| Correction (P-013) | `/pick/{id}` ON_HOLD | **Import correction** → `/pick/correction` |

---

### Phase 3 spot check — intake still works (~10 min)

Run monthly or after staging/block changes.

| Step | Route | Action |
|------|-------|--------|
| 1 | `/staging` | Upload smoke CSV again (or undo prior import first) |
| 2 | Review | Formalize 2 blocks |
| 3 | `/blocks` | Seal one block; leave one OPEN |
| 4 | `/orders` + pick | Confirm OPEN block **not** allocated (P-001 guard) |

---

## When something feels wrong

Paste into **Agent B** (fresh chat):

```text
Read .cursor/skills/spec-compliance-review/SKILL.md.

Smoke finding:
- Observed: [what you saw]
- Expected: [what should happen — quote Gherkin Then if possible]
- Page/route: [e.g. /pick/abc]
- Repro: [clicks, fixture used]

Map to backlog story IDs and Gherkin scenarios.
Run docker tests if possible.
Classify: spec bug | implementation bug | missing feature | doc drift.
Do not implement fixes yet.
```

Log the session in [operations/SMOKE-LOG.md](operations/SMOKE-LOG.md).

---

## Narrated smoke sessions (AI-native practice)

**Helpful at milestones — not required every time.**

Vitest is machine memory; narration is **human memory in a form agents can read**. Cursor chats do not remember last week’s smoke unless you leave a durable record.

### When narration is worth it

| Situation | Narrate? |
|-----------|----------|
| Full golden path before phase closure | **Yes** — one row in SMOKE-LOG + optional chat transcript |
| Quick “clicked hold, worked” after a small fix | **No** — Vitest + git history is enough |
| Something felt wrong (even if tests pass) | **Yes** — FINDING block; Agent B classifies |
| First walkthrough of a new epic area | **Yes** — helps Agent B map gaps later |
| Daily end-of-session with only Layer 1 green | **No** — unless you changed UI and have no test yet |

### Lightweight workflow (milestone smoke)

1. Run Layer 1 (Vitest).
2. Walk the golden path (or a focused subset).
3. **Narrate as you go** in a Cursor chat — Agent B or a dedicated “smoke log” chat:

```text
Smoke session — Phase 4 golden path
Date: YYYY-MM-DD
Build: local / branch name
Vitest: pass (paste count if you ran it)

Step 1 /orders import fixture — PASS
Step 2 order detail lines — PASS
Step 7 hold list — PASS
Step 8 picked while ON_HOLD blocked — FAIL: button still enabled

End session. Append summary row to docs/operations/SMOKE-LOG.md.
Do not implement fixes.
```

4. Ask the agent to **append one summary row** to `SMOKE-LOG.md` (Agent mode) or add the row yourself.
5. For any FAIL, open a **fresh Agent B chat** with the FINDING template — don’t fix in the narration chat.

### Why this is AI-native

- **Structured beats stream-of-consciousness** — step numbers + PASS/FAIL map to Gherkin and golden path rows.
- **Durable beats conversational** — SMOKE-LOG and git beat “we talked about it Tuesday.”
- **Separate roles** — narration chat records; Agent B verifies; Agent A fixes.
- **Don’t narrate what Vitest already proves** — e.g. skip narrating “import is idempotent” if `order-import.test.ts` covers it unless you saw a UI-specific issue.

### Minimum viable record (30 seconds)

If you won’t narrate, still add one SMOKE-LOG row at phase closure:

`| 2026-08-07 | local | Phase 4 golden | PASS | Vitest 48/48; steps 1–14 manual |`

That is enough audit trail for solo work until CI exists.

---

## Weekly health check (~30 min)

1. Layer 1 — full test suite  
2. Layer 2 — one epic you have not touched recently (rotate)  
3. Phase 4 golden path (or current phase path)  
4. Re-read [AUDIT-2026-08.md](backlog/AUDIT-2026-08.md) — known defects still tracked?

---

## Agent A vs Agent B vs Bugbot

See [When to open a fresh chat](#when-to-open-a-fresh-chat) for full guidance.

| Situation | Use |
|-----------|-----|
| Build a story | **Agent A** (implementation chat) |
| Verify spec + test coverage | **Agent B** (fresh chat + skill) |
| Review diff for bugs | **Bugbot** |
| Fix Agent B findings | **New Agent A chat** with report pasted |

**Rule:** The agent that wrote the code should not be the only one signing off on spec compliance.

---

## Cursor automation in this repo

| Mechanism | What it does |
|-----------|----------------|
| [`.cursor/rules/testing-ritual.mdc`](../.cursor/rules/testing-ritual.mdc) | Agent suggests testing steps after implementation |
| [`.cursor/hooks.json`](../.cursor/hooks.json) | Reminders after edits and when agent stops |
| This playbook | Your human checklist |

If hooks do not fire, restart Cursor or check **Settings → Hooks**.

---

## Quick copy-paste

**Daily gate:**

```powershell
docker compose --profile test run --rm test
```

**Agent B:**

```text
Read .cursor/skills/spec-compliance-review/SKILL.md and review story {ID}
```

**Phase 4 closure audit:**

```text
Read .cursor/skills/spec-compliance-review/SKILL.md and docs/backlog/epic-04-picking.md.
Review every Must story. Run docker tests. Say what is safe to call Phase 4 closed.
```
