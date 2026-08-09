# TCG Chaos Inventory — Strategy Memo (Amazon 6-Pager)

**Forxia Industries Corp.** · August 2026 · Confidential

Narrative memo in the [Amazon 6-pager](https://www.sixpagermemo.com/blog/amazon-six-pager-template) format (~6 pages prose + appendix). PDF: [AMAZON-6-PAGER.pdf](AMAZON-6-PAGER.pdf). HTML source: [AMAZON-6-PAGER.html](AMAZON-6-PAGER.html).

---

## Format reference (Amazon 6-pager)

| Section | Typical length | Purpose |
|---------|----------------|---------|
| **Introduction** | ½–1 page | Context, complication, proposed resolution |
| **Goals** | ½ page | Output metrics (results) + input metrics (levers) |
| **Tenets** | ½ page | Principles that resolve trade-offs without escalation |
| **State of the Business** | ~1 page | Data-driven current snapshot |
| **Lessons Learned** | ½–1 page | Past cycle insights tied to goals |
| **Strategic Priorities** | 2–3 pages | Execution plan — core of the memo |
| **Appendix** | Unlimited | Tables, charts, supporting detail |

Main body ≈ six pages single-spaced; appendix not counted. Written as narrative prose, not slide bullets.

---

## 1. Introduction

Trading card game shops lose margin and staff time at the boundary between *bulk* and *sellable* inventory. A trade-in arrives as an unsorted pile; staff must decide what to brick for position-picking, what to sort for individual listing, and how to keep channels from overselling stock that does not exist. Most shop software assumes everything is already sorted into SKUs. That assumption breaks the moment a shop accepts a 3,000-card collection on a Saturday afternoon.

**TCG Chaos Inventory**, developed by Forxia Industries Corp., is a self-hosted shop operating system built for that reality. Its differentiator is deliberate support for **chaos blocks**—sealed, position-indexed bulk inventory—alongside a planned **sorted stock** mode for individually sellable singles. A physical card lives in exactly one mode; moving between them is explicit and audited. The product runs on the shop’s own server (Docker + PostgreSQL). There is no platform commission and no vendor lock-in on inventory data.

Phases 1–4 are largely complete: staging intake from ManaBox CSV, formalized blocks, Mana Pool order import, and location-aware pick lists. The strategic question for the next 12–18 months is completing full-shop parity—identity, sellable stock, autopricing, marketplace sync, counter POS, and buylist—without abandoning the bulk model trade-in-heavy shops depend on.

## 2. Goals

**Output metrics:** 50% faster scan-to-pickable vs spreadsheets; zero oversells on sorted stock post–Phase 9; sub-30s “where is this card?” for bulk or singles; full backup/restore without cloud dependency.

**Input metrics:** Ship Phases 5–6 next; complete MVP parity (Phases 6–10) before parked work; maintain dockerized regression tests on inventory/money paths.

## 3. Tenets

- **Bulk honesty over fake SKUs** — chaos blocks are first-class, not a workaround.
- **Self-hosted first** — shop owns DB and backup; SaaS is later.
- **Audit before scale** — no POS/channels/buylist without staff identity on events.
- **CSV before API** — marketplace templates before live integrations.
- **One promote bridge** — bulk → sorted only via explicit logged action.
- **Speed over completeness on intake** — external scan + staging review; camera scan not blocking MVP.

## 4. State of the Business

Working single-tenant MTG deployment: Next.js 15, Prisma, PostgreSQL 16, Docker. **Shipped:** staging → formalize, block lifecycle, Mana Pool export/import, pick lists (hold, quarantine, correction), aging analytics, backup/restore, activity log. **Gaps:** prices not persisted ($0 valuation), no auth/actor, no sorted stock/channels/POS/buylist. **Position:** SortSwift-class parity plus chaos blocks as differentiator.

## 5. Lessons Learned

Staging as commit point and import-level undo beat partial block surgery. Position index is non-negotiable for pick recovery. “Partial” features that imply value (pricing) damage trust. Parity order is fixed: identity → price persistence → SKU ledger → pricing rules → channels → POS.

## 6. Strategic Priorities

1. **Phase 5** — pricing persistence, search, webhook auth.
2. **Phase 6** — login, SKU ledger, sort/promote, reservations.
3. **Phase 7** — multi-game, printing picker, price overlay.
4. **Phase 8** — autopricing rule engine.
5. **Phase 9** — channel sync, oversell guard.
6. **Phase 10** — POS, buylist.
7. **Phase 11** — unified fulfilment.

Parked: consignment, advanced reporting, kiosk, mobile, public API, multi-tenant SaaS.

---

*See HTML/PDF for full narrative and appendices.*
