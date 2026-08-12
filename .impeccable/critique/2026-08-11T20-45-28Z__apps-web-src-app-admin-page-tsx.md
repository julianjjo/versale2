---
target: Admin dashboard (/admin)
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-11T20-45-28Z
slug: apps-web-src-app-admin-page-tsx
---
Method: dual-agent (A: a9da6d8de198d47f1 · B: a16556a9ae06525ff)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | One full-page spinner gates all three queries; no per-section loading, no "last updated" timestamp |
| 2 | Match System / Real World | 2 | "Productos pendientes" doesn't match what it actually computes (see P0) |
| 3 | User Control and Freedom | 3 | Admin tabs always present, nothing destructive here |
| 4 | Consistency and Standards | 2 | Recent-order rows here are plain divs; identical-looking rows on /admin/orders are links |
| 5 | Error Prevention | 2 | The silent-zero failure mode (see below) undermines triage decisions |
| 6 | Recognition Rather Than Recall | 3 | Status always pairs color + text; order rows show only a truncated hex ID, no buyer/product name |
| 7 | Flexibility and Efficiency | 0 | No bulk actions, shortcuts, saved filters, or "pending only" view for a tool opened daily |
| 8 | Aesthetic and Minimalist Design | 2 | Sparse dashboard content bookended by the full consumer marketing shell (promo topbar, social footer) |
| 9 | Error Recovery | 0 | Confirmed in source: no `isError` handling anywhere; a failed fetch renders identically to a true zero |
| 10 | Help and Documentation | 2 | No tooltips; acceptable for a power-user tool, but no orientation for a new hire |
| **Total** | | **17/40** | **Poor (42.5%)** |

## Design Specificity Verdict

A generic admin-overview template wearing the storefront's Fraunces/Inter/terracotta skin, not a purpose-built moderation console. Nothing here — metric choice, copy, layout — reflects Versale's actual differentiator (admin-moderated curation): no visual signal for "listing awaiting review" vs. routine data, no thumbnail context in the queue.

**Deterministic scan**: CLI on admin/page.tsx = 0 findings. Browser scan = 7 findings, all attributable to shared Topbar/Footer/AdminLayout chrome, none to page.tsx itself. The Footer's known ink-on-ink `FooterColumn` heading bug reproduces here too.

## Priority Issues

- **[P0] "Productos pendientes" is mislabeled — it shows total catalog size, not the approval queue.** Confirmed against the API: `findAllForAdmin`'s count query has no `isApproved: false` filter, so it counts every product, approved and pending alike. This is the single number a moderator most needs for daily triage, and it's wrong. Fix: filter the count by `isApproved: false`, or relabel honestly and add a real pending count.
- **[P1] Zero error-state handling across all three dashboard queries.** A failed fetch silently falls back to `?? 0` — indistinguishable from a genuine zero on a status dashboard. Fix: surface a visible inline error banner per failed query.
- **[P1] Recent-order rows aren't clickable here, unlike identical rows on /admin/orders.** Fix: wrap in the same Link pattern.
- **[P2] The admin tool inherits the full consumer marketing shell with zero differentiation** — promo topbar, Carrito/Vender nav, and social footer surround every admin route, risking misclicks mid-task. Fix: give `/admin/*` a dedicated layout.
- **[P3] No pending-queue affordance anywhere in the IA** — reaching the real queue means manually scanning an unfiltered, unsorted product list.

## Persona Red Flags

- **Alex** (opens this every morning to clear the queue): sees "Productos pendientes: 15," clicks through expecting 15 items to review, lands on an unfiltered mixed list, and has to manually re-derive the real queue by eye every day — learns to distrust the headline number.
- **Jordan**: if the products query ever fails, sees "0 productos pendientes" and reasonably concludes the queue is empty.
- **Sam**: tabs through "Pedidos recientes" expecting each row to be activatable (matching the shape used elsewhere) — they're inert divs, forcing a detour through the Pedidos tab.

## Minor Observations

"Ingresos (COP)" correctly excludes CANCELLED orders but doesn't disclose the methodology; order rows show only a truncated hex ID with no buyer/product name; stat-card labels use quiet marketing-style microcopy for what should be the most scannable text on a data screen; no refresh control or staleness indicator.
