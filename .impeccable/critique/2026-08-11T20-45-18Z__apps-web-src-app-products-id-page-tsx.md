---
target: Product detail (/products/[id])
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-11T20-45-18Z
slug: apps-web-src-app-products-id-page-tsx
---
Method: dual-agent (A: a81f417c68980fc7c · B: ab3119b78ca193c33)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Unauthenticated "Agregar al carrito" click silently redirects to /login with no inline feedback at the click site |
| 2 | Match System / Real World | 3 | Locale-appropriate condition labels and COP formatting; secondary-image thumbnails look clickable but aren't wired |
| 3 | User Control and Freedom | 2 | No breadcrumb; only exit is the generic top-nav "Explorar" link |
| 4 | Consistency and Standards | 2 | Breaks common PDP conventions: no working gallery, no related items, seller isn't linked |
| 5 | Error Prevention | 1 | Quantity stepper allows up to 99 units of a one-of-a-kind used garment |
| 6 | Recognition Rather Than Recall | 3 | Specs sit in a persistent, scannable list next to the CTA |
| 7 | Flexibility and Efficiency | 2 | Accessible roving-tabindex star rating is a nice touch; no wishlist/save-for-later wiring |
| 8 | Aesthetic and Minimalist Design | 2 | Oversized 64px title over a 30px mono price; missing-image state is a bare gray box |
| 9 | Error Recovery | 2 | Inline `role="alert"` errors are solid, but the login-redirect isn't surfaced as an error at all |
| 10 | Help and Documentation | 1 | No size guide, no explanation of what "Buen estado" concretely means |
| **Total** | | **20/40** | **Acceptable (50%)** |

## Design Specificity Verdict

Typography and localization show real intent, but the one conversion action — "Agregar al carrito" — renders in plain ink/black, not the terracotta DESIGN.md calls the brand's sole signature color; zero terracotta anywhere on the page. Combined with the non-functional gallery and unlinked seller, the page reads as an interchangeable e-commerce PDP with Versale's fonts painted on top.

**Deterministic scan**: CLI on the two target files = 0 findings. Browser scan (after discarding a contaminated capture from tab cross-contamination) found 21 items; only two are confirmed genuinely attributable to product-detail.tsx: a `kicker-above-heading` pattern (brand label immediately above the `<h1>`) and a `skipped-heading` gap (h2 "Reseñas" → Footer's h4, which only manifests when logged out with 0 reviews). A `cramped-padding` finding and a text-overflow finding on this page are undermined by a confirmed 0×0-viewport bug in this session and should be re-verified rather than trusted as-is.

## Priority Issues

- **[P0] Add to Cart is a silent dead-end for unauthenticated visitors.** Click performs `router.push("/login")` with zero inline feedback; the only explanation sits in small print below Reviews. Fix: show an inline message adjacent to the button, or open a lightweight auth prompt.
- **[P1] The brand's one accent color is absent from the conversion action.** DESIGN.md: terracotta is "the only color that means Versale accent" — absent here. Fix: apply the `accent` Button variant.
- **[P1] Mobile CTA sits below the fold; the title consumes disproportionate space.** At 375×812, the button starts at top:931px — never visible on initial load. Fix: reduce the PDP title scale or add a sticky mobile action bar.
- **[P2] No positive trust signal for admin-approved listings** — `isApproved` is only ever rendered as a negative ("Aún no disponible"), never a positive verification badge.
- **[P3] Non-functional gallery thumbnails; no size guide.**

## Persona Red Flags

- A cautious first-time buyer clicks "Agregar al carrito" with no account, gets bounced to /login with zero context, reasonably assumes the button is broken.
- A mobile shopper has to scroll past title/photo/description/specs before the purchase button even appears on screen.
- A price-and-condition-driven shopper wants to know exactly what "Buen estado" means and whether the seller is reputable — gets a static badge and a bare name with no way to check either.

## Minor Observations

No-brand products show "Versale" in the brand slot (`data.brand ? data.brand : "Versale"`), risking implying a house label; eyebrow-text contrast computes to ≈4.7:1 (passes AA, little headroom); condition Badge always renders the neutral variant regardless of tier even though success/warning variants exist and are used elsewhere on the same page; quantity input has no visible label text, only `aria-label`.
