# Sales & customer literature



Customer-facing materials for **Forxia Industries Corp.** — derived from the product backlog, written for prospects and partners (not engineers).



**Product:** TCG Chaos Inventory — self-hosted inventory and shop operations for trading card stores.



**Engineering source of truth:** [BACKLOG.md](../BACKLOG.md) and [backlog/](../backlog/) epics. When shipped scope changes, update these sales docs to match.



---



## PDF catalog (share with prospects)



| PDF | Pages | Purpose |

|-----|------:|---------|

| [PRODUCT-OVERVIEW.pdf](PRODUCT-OVERVIEW.pdf) | 1 | Elevator pitch — features, dual inventory model, roadmap snapshot |

| [ROADMAP-AND-FEATURES.pdf](ROADMAP-AND-FEATURES.pdf) | 2 | Full feature list (available / in progress) + phase roadmap |

| [AMAZON-6-PAGER.pdf](AMAZON-6-PAGER.pdf) | ~6 + appendix | Strategy narrative memo (Amazon 6-pager format) |



Regenerate all PDFs: `powershell -ExecutionPolicy Bypass -File scripts/regenerate-sales-pdf.ps1`



---



## Source files



| Base name | Markdown | HTML | PDF |

|-----------|----------|------|-----|

| **PRODUCT-OVERVIEW** | [md](PRODUCT-OVERVIEW.md) | [html](PRODUCT-OVERVIEW.html) | [pdf](PRODUCT-OVERVIEW.pdf) |

| **ROADMAP-AND-FEATURES** | [md](ROADMAP-AND-FEATURES.md) | [html](ROADMAP-AND-FEATURES.html) | [pdf](ROADMAP-AND-FEATURES.pdf) |

| **ROADMAP** *(markdown only)* | [md](ROADMAP.md) | — | — |

| **AMAZON-6-PAGER** | [md](AMAZON-6-PAGER.md) | [html](AMAZON-6-PAGER.html) | [pdf](AMAZON-6-PAGER.pdf) |



Edit **Markdown** for quick text changes, **HTML** for print layout, then regenerate PDFs. Keep all three formats aligned when scope changes.



Add new literature: `TOPIC.md` + optional `.html` / `.pdf`; register in this table and in [.cursor/rules/sales-literature-index.mdc](../../.cursor/rules/sales-literature-index.mdc).



---



## Branding



| Field | Value |

|-------|-------|

| **Company** | Forxia Industries Corp. |

| **Product** | TCG Chaos Inventory |

| **Tagline** | Self-hosted inventory & shop operations for trading card stores |



Use **customer language** in this folder: no story IDs (`V-005`), no internal status keys (Partial, Schema).



---



## Updating after build progress



1. Read [BACKLOG.md](../BACKLOG.md) phase roadmap and epic status.

2. Update `PRODUCT-OVERVIEW`, `ROADMAP`, `ROADMAP-AND-FEATURES`, and `AMAZON-6-PAGER` (State of the Business + Strategic Priorities) as needed.

3. Sync HTML layouts from markdown content.

4. Run `scripts/regenerate-sales-pdf.ps1`.

5. Bump “Last updated” month in footers when scope meaningfully changes.



**Cursor prompts:** *“Update sales literature from the backlog”* · *“Refresh the 2-page roadmap PDF”* · *“Update the Amazon 6-pager for Phase N”*



Agent rules: [sales-literature-index.mdc](../../.cursor/rules/sales-literature-index.mdc) (always on) · [sales-literature.mdc](../../.cursor/rules/sales-literature.mdc) (when editing `docs/sales/`)



---



## Amazon 6-pager format



Industry-standard narrative memo used at Amazon instead of slide decks. Six main sections (~6 pages) plus unlimited appendix:



1. **Introduction** — context and hook  

2. **Goals** — output + input metrics  

3. **Tenets** — trade-off principles  

4. **State of the Business** — current snapshot with data  

5. **Lessons Learned** — prior cycle insights  

6. **Strategic Priorities** — execution plan (largest section)  

7. **Appendix** — tables and supporting detail  



See [AMAZON-6-PAGER.md](AMAZON-6-PAGER.md) for format reference and [sixpagermemo.com](https://www.sixpagermemo.com/blog/amazon-six-pager-template) for external template guidance.



---



*Forxia Industries Corp. · Last updated August 2026*

