---
target: Order detail (/orders/[id])
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-11T20-45-18Z
slug: apps-web-src-app-orders-id-page-tsx
---
Method: dual-agent (A: ae56678eaee9cfee5 · B: a619e732e698ba2b0)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | "Última actualización" duplicates "Realizado el" verbatim — implies a tracked timeline that doesn't exist |
| 2 | Match System / Real World | 3 | `item.product.condition` renders raw English ("Good") on an otherwise all-Spanish page |
| 3 | User Control and Freedom | 2 | Only exit is "← Volver a mis pedidos" — no reorder, receipt, dispute, or review shortcut |
| 4 | Consistency and Standards | 2 | Order-ID is a small muted label everywhere else but becomes a giant Fraunces H1 here |
| 5 | Error Prevention | 2 | Deleted-product edge case falls back to displaying the raw UUID as the item name |
| 6 | Recognition Rather Than Recall | 4 | Everything needed is on one screen |
| 7 | Flexibility and Efficiency | 1 | Zero shortcuts — no reorder, no review link, no print/export |
| 8 | Aesthetic and Minimalist Design | 2 | Oversized order-ID heading visibly wraps/breaks at 375px |
| 9 | Error Recovery | 2 | Good "not found" empty state; missing-product case degrades to a raw UUID instead of a message |
| 10 | Help and Documentation | 1 | No support/contact link anywhere on the page |
| **Total** | | **22/40** | **Acceptable (55%)** |

## Design Specificity Verdict

Uses Versale's tokens correctly at the component level but is structurally a generic three-card receipt (items+total / address / metadata) that could belong to any marketplace starter kit — nothing signals "pre-owned," "Colombia," or "curated trust," and the review feature that already exists elsewhere in the app is never surfaced here at the exact moment (delivery) sentiment is freshest.

**Deterministic scan**: CLI on orders/[id]/page.tsx = 0 findings. Browser scan (after discarding a contaminated capture) = 6 findings for this page, all tracing to shared Topbar/Footer chrome, none to the page's own code.

## Priority Issues

- **[P0] Missing keyboard focus indicator on in-page links.** The back-link and product-title link have zero focus-visible styling, inconsistent with the same app's own `/orders` list page. Fix: apply the existing focus-ring pattern to both links.
- **[P1] Untranslated condition string ("Good") on an all-Spanish page.** A `CONDITION_LABELS` map already exists (duplicated in 4 other files) — this is the one place it's missing. Fix: apply the same map.
- **[P1] Order-ID given disproportionate visual weight; breaks on mobile.** Renders as a 64px Fraunces H1 that wraps to two lines at 375px, floating the status badge awkwardly beside it — while the same string is small and muted on the list page one click away. Fix: demote to a small mono label; let status/item/total lead.
- **[P2] No post-delivery next step; no seller identity.** No "leave a review" CTA despite the feature existing; no seller name/link despite the data model having it. Fix: surface both for DELIVERED orders.
- **[P3] Unhandled edge cases** — deleted product falls back to a raw UUID; empty items array has no EmptyState guard.

## Persona Red Flags

- **Alex**: opens a delivered order to confirm the item matched what was promised — finds no seller name and a condition label that isn't even in Spanish, undercutting trust at the exact moment it matters most.
- **Riley**: primed to rate the item while sentiment is high — finds no way to review from this page and likely abandons the review Versale needs for its curation story.
- **Casey**: received an item not matching its listed condition and looks for any dispute/return path — finds only a back-link.

## Minor Observations

Status is rendered twice on the page (badge + "Detalles del pedido" text); missing product image renders as a bare "—" rather than a garment-style icon; shipping address has no `<address>` semantic element or field labels.
