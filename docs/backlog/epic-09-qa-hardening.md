# Epic 9 — I-015 QA Hardening

Not an epic with its own prefix. This is a **programme**: the stories that came out of the August 2026 QA review of block removal (**I-015**), which live in Epics 1 and 3 and are indexed here so the programme can be tracked as a unit.

Back to [index](../BACKLOG.md) · [conventions](CONVENTIONS.md)

Each story is defined once, in its home epic. Follow the link rather than duplicating acceptance criteria here.

---

## Programme status

10 of 14 shipped. The four open items are all Could or Should polish.

| ID | Story | Priority | Status | Defined in |
|----|-------|----------|--------|------------|
| **I-023** | Undo formalize import in one action | Must | Done | [epic-03](epic-03-intake.md#i-023--undo-formalize-import) |
| **I-022** | Staging review shows assigned versus unassigned | Must | Done | [epic-03](epic-03-intake.md#i-022--staging-review-reflects-assignment-state) |
| **I-024** | Staging list status badges | Should | Done | [epic-03](epic-03-intake.md#i-024--staging-list-status-badges) |
| **I-025** | No auto-redirect after upload | Should | Done | [epic-03](epic-03-intake.md#i-025--upload-success-without-auto-redirect) |
| **B-010** | Atomic pick guard on remove | Must | Done | [epic-01](epic-01-blocks.md#b-010--atomic-pick-guard-on-block-remove) |
| **B-011** | Disable remove when picks exist | Should | Done | [epic-01](epic-01-blocks.md#b-011--disable-remove-ui-when-block-has-pick-history) |
| **B-012** | Status-aware removal | Should | Done | [epic-01](epic-01-blocks.md#b-012--status-aware-block-removal) |
| **B-013** | Global inventory event log | Should | Done | [epic-01](epic-01-blocks.md#b-013--global-inventory-event-log-and-activity-feed) |
| **B-015** | Remove success message survives redirect | Could | Done | [epic-01](epic-01-blocks.md#b-015--persist-remove-success-message-before-redirect) |
| **PL-008** | Tests for remove and staging paths | Should | Done | [epic-00](epic-00-platform.md#pl-008--automated-tests-for-remove-and-staging-flows) |
| **I-021** | Safe partial block removal | Should | — | [epic-03](epic-03-intake.md#i-021--safe-partial-block-removal) |
| **B-017** | Backup reminder on remove | Should | — | [epic-01](epic-01-blocks.md#b-017--backup-reminder-on-block-remove-danger-zone) |
| **B-014** | Case-insensitive confirmation | Could | — | [epic-01](epic-01-blocks.md#b-014--case-insensitive-remove-confirmation) |
| **B-016** | Document ID non-recycling | Could | — | [epic-01](epic-01-blocks.md#b-016--document-that-mtg-ids-are-never-recycled) |
| **B-018** | Empty block removal policy | Could | — | [epic-01](epic-01-blocks.md#b-018--empty-block-removal-policy) |

---

## What the review found, and what it changed

The QA review of **I-015** asked one question: when staff need to undo a mistake, does the system make them do N clicks where 1 would do, and can it lose cards while they try?

Both answers were yes. The programme fixed the first outright and made the second visible.

**Recovery is now import-level, not block-level.** Before **I-023**, redoing a bad scan after formalize meant removing every block one at a time, then deleting the staging import. For a 40-block trade-in that is 40 confirmations. Formalize is the commit point, so undoing it should be one action — that is now what it is.

**Removal is guarded rather than trusting.** Three guards landed: pick history is re-checked inside the delete transaction (**B-010**), the UI refuses before the user types a confirmation (**B-011**), and lifecycle status gates removal so ACTIVE blocks must be taken offline first and LIQUIDATED blocks cannot be removed at all (**B-012**).

**Deletions stopped erasing their own evidence.** **B-013** made the event log append-only and independent of its subject, so a removal event still names `MTG-0007` after that block is gone.

**The destructive paths got tests.** **PL-008** covers undo formalize, partial remove, import unlock, re-formalize, lifecycle transitions and the pick guard, against a database the suite refuses to run unless its name contains "test".

## What is still open, and why it is acceptable

**I-021** is the only substantive gap: after a partial remove, the removed block's staging cards are visible as unassigned (**I-022** made that so) but there is no workflow to re-formalize them. This was deliberately deprioritised, because **I-023** covers the case that actually happens — staff distrust a whole scan far more often than one brick out of forty. Build **I-021** only if single-brick repair proves necessary in production.

The remaining three are polish: a backup link in the remove danger zone (**B-017**), case-insensitive confirmation for mobile keyboards (**B-014**), a documentation line about ID non-recycling (**B-016**), and a decision on empty-block removal (**B-018**).

## Layer model for recovery

Established by this review and carried into Phase 4. Choosing the wrong layer is how cards get lost.

| Layer | When | Tool |
|-------|------|------|
| **1 — Scan quality** | Before seal; the whole export is wrong | **I-023** undo formalize, then re-upload |
| **2 — One bad brick** | After formalize; the scan is trusted | **I-021**, block move, re-pack |
| **3 — Pick mismatch** | At pick; the position or card is wrong | **P-011**–**P-014** quarantine, hold, re-scan, re-allocate |

**I-023** is never the answer to a layer-3 problem. Once blocks are sealed and on pick lists, undoing an import would delete inventory somebody is standing in front of.
