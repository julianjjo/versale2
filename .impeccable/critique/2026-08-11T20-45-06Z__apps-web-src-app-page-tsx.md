---
target: Home (/)
total_score: 24
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 2
timestamp: 2026-08-11T20-45-06Z
slug: apps-web-src-app-page-tsx
---
Method: dual-agent (A: aeb85a85587c3d5a9 · B: af963d71f5bedc0e3)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Filter pills show active state but have no onClick — decorative controls that appear live |
| 2 | Match System / Real World | 3 | Footer "Colombia, México y Argentina" contradicts PRODUCT.md's confirmed Colombia-only scope |
| 3 | User Control and Freedom | 2 | All 6 category tiles link to plain /products regardless of title — promise not delivered |
| 4 | Consistency and Standards | 3 | Header/Footer links have focus rings; hero/category/newsletter controls don't |
| 5 | Error Prevention | 3 | Only form on page (newsletter) has native email validation |
| 6 | Recognition Rather Than Recall | 4 | Sticky header, clear labels throughout |
| 7 | Flexibility and Efficiency | n/a | Marketing landing page, no power-user path to evaluate |
| 8 | Aesthetic and Minimalist Design | 3 | Strong editorial rhythm undercut by 100% placeholder imagery ("Sin imagen" on every card/tile) |
| 9 | Error Recovery | 3 | Product-fetch error state is plain-language and actionable |
| 10 | Help and Documentation | n/a | Not applicable to a marketing landing page |
| **Total** | | **24/32** | **Good (75%)** |

## Design Specificity Verdict

Copy layer is bespoke (Spanish voice, COP, secondhand-specific categories, seller economics, circular-fashion stats). Visual layer undercuts it: zero real photography anywhere (hero, categories, products, lookbook all render as flat placeholder blocks), so the page currently looks templated despite authored copy.

**Deterministic scan**: CLI detector on page.tsx = 0 findings. Browser runtime detector on the rendered page = 54 findings, but ~20 trace to imported components (Footer, NewsletterCTA, ProductsBrowser) not page.tsx itself. Genuinely page.tsx-sourced: category-card clip/overflow, hero eyebrow/em overflow, marquee cramped padding, and — most notably, since the CLI missed it — a 4.3:1 contrast failure (needs 4.5:1) on testimonial location text (`#7a6a55` on `#efe9dc`), 3 instances.

## Priority Issues

- **[P0] No product/category photography anywhere.** All cards/tiles render "Sin imagen" placeholder blocks. Kills desire and credibility at the moment a shopper should be persuaded. Fix: seed real imagery; design a real empty-image fallback.
- **[P0] Testimonials present fabricated identities as genuine.** Named people, cities, ratings, stock avatars — PRODUCT.md explicitly says this placeholder content "must not be presented as genuine." Fix: label as illustrative or hold until real testimonials exist.
- **[P1] Decorative controls with no behavior.** Filter pills and header search/heart icons render fully "live" but have no onClick. Fix: wire to real filters or remove.
- **[P1] Missing focus-visible rings on highest-intent CTAs.** `.btn-pill`, `.filter-pill`, category tiles, and the newsletter input have no focus ring, unlike Header/Footer links. Fix: apply the existing ring pattern everywhere.
- **[P2] Category tiles don't filter.** All 6 tiles link to unfiltered /products. Fix: pass real category query params.

## Persona Red Flags

- **Jordan**: clicks "Denim" category expecting filtered results, lands on the generic catalog; then clicks a homepage filter pill and nothing happens — reads as broken.
- **Sam**: tabbing to the hero CTA and the newsletter email field gets no visible focus indicator.
- **Casey**: at 375px, nav/auth CTAs are hidden behind a hamburger; scrolls past 6 category tiles + 5 filter pills before reaching a product grid that's entirely "Sin imagen."

## Minor Observations

Category-tile accessible name announced twice to screen readers; "2.4k personas mirando ahora" and "−65%" are static hardcoded numbers presented as live data; heart/favorite button on product cards is decorative only; image-hover zoom has no `prefers-reduced-motion` handling.
