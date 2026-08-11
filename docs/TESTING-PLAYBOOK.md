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
| **Dev app** (`tcg_inventory`, localhost:3010) | Persists in Docker volume | You (seed, staging CSV, clicking) |
| **“Fresh dev DB”** | Wiped or never had smoke inventory | You redo staging setup once |

> **Never smoke test at localhost:3000** — that is the production store with real inventory (ADR-011). All testing happens on the dev stack (3010) or the test database.

### By goal — what to run

| Goal | Fresh dev DB setup? | Layer 1 (Vitest) | Layer 2 (Agent B) | Layer 3 (smoke) |
|------|---------------------|------------------|-------------------|-----------------|
| Quick check after a small fix | No | **Yes** (~5 min) | Only if you touched a Must story’s behavior | Skip, or 2 min on the page you changed |
| Same day, same area, tests green, dev DB still has the staging fixture blocks | No | **Yes** | If story status / Gherkin might change | **Focused** path only (see golden path steps for that story) |
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

`db:seed` is non-destructive and safe to re-run on a populated database: it creates `MTG-0001`–`MTG-0003` only when those IDs are missing, and it raises the block and bin counters rather than resetting them. Seed alone does **not** give you inventory the pick fixtures can match — do the staging setup below.

**One-time smoke inventory setup (~8 min):**

| Step | Where | Action | Pass if |
|------|-------|--------|---------|
| 1 | `/staging` | Upload [`fixtures/staging-01-single-block.csv`](fixtures/staging-01-single-block.csv) | Import appears in pending list, 12 rows / 12 cards |
| 2 | Staging review | Open import; assign the single block to bin **A-B01**; **Formalize** | Success message naming the new block ID — record it |
| 3 | Staging review or `/blocks` | **Seal** the new block (OPEN → SEALED) | Status SEALED; 12 cards at positions 1–12 |
| 4 | `/staging` | Upload [`fixtures/staging-04-shelf-b.csv`](fixtures/staging-04-shelf-b.csv) | Import appears, 6 rows / 6 cards |
| 5 | Staging review | Assign the single block to a shelf **B** bin (**B-B01**); **Formalize**, then **Seal** | Block on shelf B, SEALED |

Steps 4–5 are only needed for the wave path (Step 6 below). See [fixtures/README.md](fixtures/README.md) for what each slice contains.

---

### Phase 4 golden path — order → pick → ship (~20 min)

Stories exercised: P-001, P-002, P-003, P-004, P-006, P-009, P-011, P-012, P-014 (+ P-005 counter pick, P-007 pullsheet as optional branches)

| # | Route | You do | Pass if |
|---|-------|--------|---------|
| 1 | `/orders` | **Import test fixture** → choose `docs/fixtures/manapool-order-staging-01.json` | Success message; order **STAGE-ORDER-001** in table |
| 2 | `/orders/{id}` | Open order; review 4 lines (`Leaping Lizard`, `Illusionary Terrain`, `Midnight Recovery`, `Fallen Angel`) | Lines match fixture |
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
| Counter pick (P-005) | `/blocks/MTG-…` | **Counter pick** form on the staging-01 block — pick `Waterwhirl`, `Crackling Triton`, or `Griptide` (no fixture claims those) |
| Pullsheet (P-007) | `/pick/import` | Upload `docs/fixtures/tcgplayer-pullsheet-staging-01.csv` (4 cards the order did not claim) |
| Correction (P-013) | `/pick/{id}` ON_HOLD | **Import correction** → `/pick/correction` |

---

### Phase 3 spot check — intake still works (~10 min)

Run monthly or after staging/block changes.

| Step | Route | Action | Pass if |
|------|-------|--------|---------|
| 1 | `/staging` | Upload [`fixtures/staging-02-two-blocks.csv`](fixtures/staging-02-two-blocks.csv); set target count **10** | Review shows **2** suggested blocks of 10 cards |
| 2 | Review | Assign block 1 to **A-B01**, block 2 to **A-B02**; Formalize | Two new block IDs, each in the bin you chose |
| 3 | `/blocks` | Seal block 1; leave block 2 **OPEN** | One SEALED, one OPEN |
| 4 | `/inventory` | Search a card from block 2 | Counted as **In packing (OPEN)**, not sellable |
| 5 | `/staging` | Upload [`fixtures/staging-03-qty-split.csv`](fixtures/staging-03-qty-split.csv); set target count **8** | 3 suggested blocks; review flags `Kelsinko Ranger` and `Weakness` as split across blocks |
| 6 | `/staging` | Upload [`fixtures/staging-05-undo.csv`](fixtures/staging-05-undo.csv), formalize, then **Undo formalize** (type `UNDO`) | Block removed; message says MTG IDs are not reused |

---

### Phase 5b golden path — upload session → Mana Pool (~15 min)

Stories exercised: **CHL-003**, **CHL-004**, **CHL-005**, **CHL-006**, **CHL-015**. Pick gating (**CHL-012**) is deferred to [Phase 4×5b pick gating](#phase-45b--pick-gating-chl-012--future-golden-path). See [Epic 22](backlog/epic-22-channel-catalogs.md) and [ADR-013](architecture/adr/013-channel-catalogs-block-listing.md).

**Prerequisite:** Formalize + **seal** [`fixtures/staging-02-two-blocks.csv`](fixtures/staging-02-two-blocks.csv) (both blocks SEALED). Do **not** activate before this path — activation is what the upload session completes.

| # | Route | You do | Pass if |
|---|-------|--------|---------|
| 1 | `/uploads` | New session → select both SEALED blocks → Mana Pool | Session DRAFT; blocks show reserved |
| 2 | Session detail | Generate CSV | Status CSV_READY; download matches expected row count |
| 3 | (external) | Import CSV at manapool.com (optional on dev) | — |
| 4 | Session detail | Click **Complete session** → read confirmation copy (“does not verify Mana Pool…”) → **Yes, mark all blocks active** | Disclaimer visible before activate; both blocks ACTIVE + MANAPOOL; session COMPLETED |

**Cancel branch (disposable):** Use staging-05 block — create session, generate CSV, **Cancel** → block stays SEALED, reservation cleared. On CSV_READY session detail, confirm warning text includes **Mana Pool may already have been updated** before clicking Cancel.

**CHL-015 integrity branch (manual UI):**

| Step | Route | You do | Pass if |
|------|-------|--------|---------|
| A | `/uploads` | Create session with one SEALED block | Block reserved; note session id (e.g. UP-0001) |
| B | `/blocks/{id}` | Open reserved block detail | Banner names session; **Mark as listed** is absent/disabled |
| C | `/blocks/{id}` | Move block to another bin | Move succeeds |
| D | `/uploads/{sessionId}` | Refresh session detail | Location column shows new bin; block still listed in session |

**Integrity checks (Agent B):** Map ADR-013 matrix **I-01**–**I-17** to tests or manual steps before `@done` on **CHL-015**.

---

### Phase 4×5b — Pick gating (CHL-012) — future golden path

**Status:** Not part of Phase 5b closeout. Run when you have done [Phase 4 staging-01 setup](#prerequisites-fresh-database) and want manual proof that orders skip upload-reserved blocks. **Regression:** `tests/upload-sessions.test.ts` (`excludes reserved blocks from pick allocation`, counter-pick rejection, post-cancel allocation).

**Why separate:** Phase 5b uses **staging-02**; the order fixture uses **staging-01** cards. Pick gating also needs two blocks with the same printing — one reserved, one pickable — which staging-01 alone does not provide without extra setup.

**Prerequisite:** [One-time staging-01 setup](#prerequisites-fresh-database) complete; block sealed then **Active** (upload session complete or per-block activate). Optionally formalize staging-01 twice into two bins if you need duplicate printings for allocation tests — see [`fixtures/upload-session-pick-gating.json`](fixtures/upload-session-pick-gating.json).

| # | Route | You do | Pass if |
|---|-------|--------|---------|
| 1 | `/uploads` | New session → reserve **one** sealed staging-01 block → generate CSV (do not complete) | Block reserved; session CSV_READY |
| 2 | `/blocks/{id}` | Open the **reserved** block → **Counter pick** any card | Rejected; message names the upload session |
| 3 | `/orders` | Import [`fixtures/manapool-order-staging-01.json`](fixtures/manapool-order-staging-01.json) → generate pick | If only the reserved block holds those cards: pick **shorts** or refuses; if a second Active block has them: lines come from the **non-reserved** block only |
| 4 | `/uploads/{sessionId}` | **Cancel** session | Reservation cleared |
| 5 | `/orders` | Re-import or regenerate pick for the same order | Allocation may now use the formerly reserved block |

**Post-complete sanity (optional):** After activating staging-01 via upload session, import the same order fixture — pick list allocates from that Active block (Phase 4 step 1–3 with upload-activated inventory).

---

### ACC-003 smoke — access platform gate (~15 min)

Stories exercised: **ACC-001**, **ACC-002**, **ACC-003**

**Gate:** Do not flip `@pending` → `@done` for ACC-001 or ACC-002 until Agent B signs off automated coverage. Run this full checklist once **ACC-003** is implemented — it is the single manual smoke for the Phase 6 access trio.

Automated coverage (Layer 1 before manual steps):

| Story | Tests |
|-------|-------|
| ACC-001 | `tests/auth-*.test.ts` — middleware, API 401, session, bootstrap, users, pre-auth data |
| ACC-002 | `tests/auth-permissions*.test.ts` — matrix, staff paths, UI markup, denial audit |
| ACC-003 | `tests/auth-actor.test.ts`, `tests/auth-actor-ui.test.ts`, `tests/inventory-events.test.ts`, `tests/auth-pre-auth-data.test.ts`, `tests/cron-sync.test.ts` |

**Agent B (before ACC-003 build):** Fresh chat → review **ACC-001** and **ACC-002** separately or in one pass. Fix gaps before starting ACC-003 implementation.

#### A — Auth (ACC-001)

| # | Route | You do | Pass if |
|---|-------|--------|---------|
| A1 | `/setup` or `/login` | Fresh DB → `/setup` creates owner; existing DB → sign in | Header shows your display name + **Sign out** |
| A2 | `/blocks` (signed out) | Open in private window or after sign out | Redirect to `/login`; no block data |
| A3 | API | `GET /api/backup/export` without session cookie | **401** JSON `{ "error": "Unauthorized" }` |
| A4 | `/settings/users` | As owner: create staff, reset password, disable | Disabled account cannot sign in |

#### B — Roles (ACC-002)

**Setup:** As owner, create Manager, Staff, and Read-only accounts at `/settings/users` (keep Owner).

| # | Role | Route | You do | Pass if |
|---|------|-------|--------|---------|
| B1 | Staff | `/settings` | Open settings | No **Danger zone**, no shelf/bin forms, no backup download |
| B2 | Manager | `/settings` | Open settings | Shelf/bin forms visible; **Danger zone** still hidden |
| B3 | Staff | `/blocks/{id}` | Open a removable block | No **Remove block** section |
| B4 | Manager | `/blocks/{id}` | Same block | **Remove block** section visible (may still be blocked by pick history) |
| B5 | Read-only | Nav | Sign in | No Staging, Orders, Pick, or Settings nav items |
| B6 | Staff | API | `GET /api/backup/export` with staff cookie | **403** `{ "error": "Forbidden" }` |
| B7 | Owner | `/activity` | After staff denial (B6) | `Permission denied` event with staff actor |

#### C — Actor on events (ACC-003)

| # | Role | Route | You do | Pass if |
|---|------|-------|--------|---------|
| C1 | Manager | `/blocks/{id}` | **Seal** an OPEN block | `/activity` seal event shows manager display name as actor |
| C2 | Owner | `/activity` | Scan recent events | Each new mutation shows actor alongside what/when; pre-auth rows show unattributed (not guessed) |
| C3 | Owner | `/activity` | Filter by a staff user | Only that user's actions listed |
| C4 | Staff | `/pick/{id}` | Mark an item **Picked** | Pick event in `/activity` shows staff actor |
| C5 | Owner | `/activity` | Find a system/cron event (e.g. price refresh when available) | Actor is **system**, not a person |

---

### Phase 5 golden path — search, move, secure inbound (~15 min)

Stories exercised: **S-001**, **S-004**, **O-002**, **SAS-001**, **P-015**

**Prerequisites:** Sign in at `/login` (or complete `/setup` on a fresh DB). Steps 1–2 need the staging-01 block from the one-time setup; step 6 also needs the staging-04 block on shelf B. Card details are in [`fixtures/golden-path-inventory-map.json`](fixtures/golden-path-inventory-map.json).

| # | Route | You do | Pass if |
|---|-------|--------|---------|
| 1 | `/inventory` | Search **Leaping Lizard** | Staging-01 block, position 1, location A / A-B01, status SEALED |
| 1b | `/inventory` | Search **Legions of Lim-Dûl** (needs staging-03 formalized) | On hand **5**, spread across two blocks |
| 2 | `/inventory` | Open the **Leaping Lizard** quantity panel | Available excludes OPEN-block copies; allocated shows pick reservations |
| 3 | `/blocks` | Select 2 blocks; bulk transfer to another bin | Success message; locations update |
| 4 | `/blocks` | Use **Entire bin** mode to move all blocks from one bin | All blocks in destination bin |
| 5 | API | `POST /api/webhooks/manapool` with no secret configured — `curl.exe` one-liner below | **503**, no order created |
| 6-prep | `/blocks` | Confirm the staging-01 block is on a shelf **A** bin and the staging-04 block is on **B-B01** (steps 3–4 may have moved them) | One block per shelf |
| 6a | `/orders` | Import [`manapool-order-staging-wave.json`](fixtures/manapool-order-staging-wave.json) | Order **STAGE-WAVE-001** appears |
| 6b | Order detail | **Generate pick list** | Pick detail opens |
| 6c | `/pick/{id}` | Scroll the list | **Wave 1** = `Tusked Colossodon` (shelf A); **Wave 2** = `Vesper Ghoul` (shelf B) |
| 2b | `/inventory` | Search **Tusked Colossodon** again | **On pick lists = 1**; Available reduced by 1 |

**Step 5 — Windows PowerShell 5.1 (single line):**

```powershell
curl.exe -s -o NUL -w "HTTP %{http_code}\n" -X POST "http://localhost:3010/api/webhooks/manapool" -H "Content-Type: application/json" -d "{\"manapoolOrderId\":\"smoke-test-unauth\",\"lines\":[{\"name\":\"Bolt\",\"quantity\":1,\"condition\":\"NM\",\"finish\":\"NONFOIL\",\"language\":\"en\"}]}"
```

Expect `HTTP 503`. Confirm `/orders` has no `smoke-test-unauth` row.

**Optional — larger order from live stock:** regenerate [`manapool-order-from-db.json`](fixtures/manapool-order-from-db.json) (16 lines sampled from ACTIVE blocks) with the command in [`fixtures/README.md`](fixtures/README.md), then import it at `/orders`.

---

### Starting over on a dirty database

The staging fixtures are the same every time, so the cheapest reset is to wipe inventory rather than reconcile it.

| Want | Do |
|------|-----|
| Fresh inventory, keep shelves and bins | `/settings` → Danger zone → **Delete all card inventory** |
| Fresh everything | `docker compose down -v`, then `docker compose up -d` and `docker compose exec app npm run db:seed` |
| Undo one import | Staging review → **Undo formalize** (type `UNDO`), or **Discard staging** if you have not formalized |

Undo formalize never reuses a block ID, so a partial reset leaves gaps. The two full wipes reset the counter, so you start again at **MTG-0001**. Either way the IDs will not match your last smoke log — record the new ones.

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

**Agent B (single story):**

```text
Read .cursor/skills/spec-compliance-review/SKILL.md and review story {ID}
```

**Agent B (ACC gate — run before ACC-003 build):**

```text
Read .cursor/skills/spec-compliance-review/SKILL.md and review stories ACC-001 and ACC-002 in docs/backlog/epic-20-access-platform.md. Run docker tests. Report gaps; do not implement fixes.
```

**Phase 4 closure audit:**

```text
Read .cursor/skills/spec-compliance-review/SKILL.md and docs/backlog/epic-04-picking.md.
Review every Must story. Run docker tests. Say what is safe to call Phase 4 closed.
```
