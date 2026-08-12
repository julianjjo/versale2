---
target: Products list (/products)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-11T20-45-06Z
slug: apps-web-src-app-products-page-tsx
---
Method: dual-agent (A: a130afb4d74a2a672 · B: a4e2068ccb5a8e9f9)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | "Talla" select visually contradicts the actual applied filter after "Limpiar filtros" |
| 2 | Match System / Real World | 3 | Every card is "Vendido por Camila Rodríguez" — contradicts the multi-seller "community" framing |
| 3 | User Control and Freedom | 2 | Can't remove one filter at a time; filter state never lands in the URL |
| 4 | Consistency and Standards | 3 | Price font contradicts DESIGN.md's own type table (renders mono, not Fraunces) |
| 5 | Error Prevention | 1 | Confirmed live: an inverted price range (min>max) is silently accepted, producing an unexplained empty state |
| 6 | Recognition Rather Than Recall | 2 | Text filter inputs are placeholder-only, no persistent labels |
| 7 | Flexibility and Efficiency | 1 | No sort; no brand/category filter despite PRODUCT.md naming both as core capabilities |
| 8 | Aesthetic and Minimalist Design | 3 | Clean card hierarchy undercut by an all-placeholder image grid |
| 9 | Error Recovery | 1 | 0-result state never says which filter is responsible |
| 10 | Help and Documentation | 2 | No legend for what separates "Aceptable" from "Buen estado" |
| **Total** | | **20/40** | **Acceptable (50%)** |

## Design Specificity Verdict

Card anatomy and Spanish/COP copy are authored for Versale, but the filter bar — six placeholder-labeled fields, no brand/category facets, no condition legend, no trust signals — is close to interchangeable with any CRUD admin list. Paired with all-placeholder imagery and a single repeating seller, today's experience reads as a scaffolded demo, not the "editorial fashion magazine" DESIGN.md commits to.

**Deterministic scan**: CLI on the two target files = 0 findings. Browser scan = 31 findings; 17 attributable to `products-browser.tsx` (2 `call-caps-body` on truncated uppercase brand text, 3 `text-overflow` on the size/condition line, 12 `clipped-overflow-container` — one per rendered card's image frame clipping its "Pendiente" badge/heart button). Remaining 15 are Footer chrome, out of scope.

## Priority Issues

- **[P0] Stale filter silently corrupts subsequent searches.** Verified live: clearing filters resets the grid but not the Talla `<select>`'s DOM value; a later unrelated search silently re-applies the stale size filter, producing an unexplained 0-result dead end. Fix: make the form controlled or force remount on clear.
- **[P0] Every catalog item renders as a placeholder box.** All 12 seeded products have `images: null`. Fix: seed real photography; give the fallback state real brand warmth.
- **[P1] Brand and category filters are entirely missing from the UI** despite PRODUCT.md naming both as core capabilities and the API supporting them.
- **[P1] Filter state never reaches the URL** — no bookmarking, sharing, or back/forward to a filtered view.
- **[P2] Product price loses its Fraunces treatment on every card** — a CSS cascade issue (`font-mono` wins over `font-display`) confirmed via computed styles.

## Persona Red Flags

- **Casey**: every item sold by the same person, no photos — the two things a trust-skeptical secondhand buyer most needs are both absent.
- **Alex**: expects to filter by brand per PRODUCT.md's own promise; no such control exists, must discover free-text search happens to cover it.
- **Sam**: hits the stale-filter bug directly — selects a size, clears it, searches something real, gets an unexplained zero-result dead end.

## Minor Observations

Filter panel shares the exact page background, separated only by a 10%-opacity hairline; muted meta text computes to ≈4.72:1 (passes AA but with little headroom); the favorite-heart button is invalidly nested inside the card's anchor tag; no sort control; condition grades have no legend.
