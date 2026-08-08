---
name: spec-compliance-review
description: >-
  Reviews implementation and Vitest coverage against backlog Gherkin scenarios
  (Agent B / spec compliance). Use when the user asks for spec compliance review,
  Agent B verification, Gherkin coverage check, test pass validation against epic
  acceptance criteria, or to verify a story ID (e.g. P-009, I-023) before marking @done.
disable-model-invocation: true
---

# Spec Compliance Review (Agent B)

Read-only verification: map backlog Gherkin to tests and runtime, without implementing features.

## When to use

- After Agent A (or you) implemented a story
- Before flipping `@pending` → `@done` in an epic file
- Before marking a story Done in `docs/BACKLOG.md`
- When the user says "Agent B", "spec compliance", or names a story ID for review

## Hard rules

1. **Do not implement features** — review, report, optionally suggest test additions as text only unless the user asks you to write tests
2. **Do not weaken assertions** to make tests pass — report spec vs code mismatch
3. **Gherkin is the spec** — epic file Feature block, not the BACKLOG index status alone (index can drift)
4. **Green tests ≠ Done** — require traceability from each **Then** to a test or documented manual step
5. **Valid test run** — must use test database; see [docs/TESTING.md](../../../docs/TESTING.md)

## Workflow

### Step 1 — Load the spec

1. User provides story ID (e.g. `P-014`, `I-023`) or epic + story
2. Read `docs/backlog/epic-NN-*.md` — find the `Feature:` block for that ID
3. Note tags: `@done`, `@pending`, `@dual`
4. Read [docs/backlog/CONVENTIONS.md](../../../docs/backlog/CONVENTIONS.md) Gherkin rules if ambiguous

### Step 2 — Build the traceability matrix

For **every** scenario, extract each **Then** and **And** (outcome clauses only, not Given/When).

Produce a table:

```markdown
## {STORY_ID} compliance

| Scenario | Then / And | Coverage | Verdict |
|----------|------------|----------|---------|
| ... | ... | `tests/foo.test.ts` L42-48 | OK |
| ... | ... | — | GAP |
| ... | ... | Manual: /pick UI smoke | OK (manual) |
```

Verdict values: **OK**, **GAP**, **WEAK** (test exists but asserts implementation not outcome), **CONFLICT** (code contradicts spec)

Also list **orphan tests** — assertions in `tests/` with no matching Then (possible drift).

### Step 3 — Run the test suite

```powershell
docker compose up -d db
docker compose --profile test run --rm test
```

If Docker unavailable, ask the user to paste full Vitest output.

**Invalid runs** (report as blocked, do not treat as pass):

- `docker compose exec app npm test` (prod container has no tests)
- `DATABASE_URL` without `test` in the name

Record: `Test Files X passed | Tests Y passed`

### Step 4 — Verdict and recommendations

```markdown
## Summary

- Test run: {pass/fail counts}
- Scenarios fully covered: N / M
- Gaps: [list]
- Orphan/drift tests: [list]

## @done recommendation

- [ ] Justified — all Then clauses covered, tests green
- [ ] Not justified — [reasons]

## Required follow-ups

1. ...
```

Only recommend flipping `@pending` → `@done` when all scenarios in that Feature are covered and tests pass.

Do **not** edit epic files unless the user explicitly asks you to update tags.

## Quality checks (apply while reviewing)

| Check | Question |
|-------|----------|
| Outcome vs implementation | Does the test assert DB/UI/event outcomes, not internal helpers? |
| Guards | Are negative scenarios from Gherkin tested (refused actions, invalid state)? |
| Fixtures | Do tests use realistic data or only synthetic `Test Card B1-P1` names without justification? |
| Mocks | If heavily mocked (e.g. webhook), is end-to-end coverage noted as GAP? |
| PL-008 guard | Does setup refuse non-test DB? |

## Standard prompt (user may paste verbatim)

```text
You are Agent B — spec compliance only. Do not implement features.

Story: {STORY_ID} from docs/backlog/epic-*.md
Read the Feature block (all scenarios).

Tasks:
1. List every Then/And as a checklist.
2. For each, cite tests/*.test.ts line(s) or say GAP.
3. Flag tests that don't map to any Then (possible drift).
4. Run: docker compose --profile test run --rm test
5. Say whether @done is justified for this Feature.

Do not weaken assertions to match bugs. If code fails spec, report spec failure.
```

Replace `{STORY_ID}` with the requested story.

## Related docs

- [docs/TESTING.md](../../../docs/TESTING.md) — how to run tests, suite inventory
- [docs/backlog/CONVENTIONS.md](../../../docs/backlog/CONVENTIONS.md) — `@done` / `@pending` meaning
- [review-bugbot skill](file:///.cursor/skills-cursor/review-bugbot/SKILL.md) — optional bug-focused pass (complements, does not replace, this skill)
