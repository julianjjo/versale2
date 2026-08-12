---
target: Cart (/cart)
total_score: 20
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-08-11T20-45-18Z
slug: apps-web-src-app-cart-page-tsx
---
Method: dual-agent (A: acf5c7104be90e572 · B: a1a72ec0c8303cadc)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Quantity edits/removals give no confirmation of success, no announced total change |
| 2 | Match System / Real World | 3 | Free 1–99 quantity stepper doesn't map onto one-of-a-kind used garments (no stock field exists) |
| 3 | User Control and Freedom | 1 | "Eliminar" and "Vaciar carrito" fire their mutation immediately — no confirm, no undo |
| 4 | Consistency and Standards | 3 | `<Price>` renders in mono here but Fraunces on product cards — same component, different look by page |
| 5 | Error Prevention | 1 | Checkout can complete with a fully blank shipping address — no `required`, no validation |
| 6 | Recognition Rather Than Recall | 3 | Thumbnail/title/condition/size shown per row, but no line-item total forces mental math |
| 7 | Flexibility and Efficiency | 2 | Enter-to-commit on quantity is a nice touch; no saved-address reuse |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and uncluttered; H1 renders at marketing-hero scale (64px) for a utility screen |
| 9 | Error Recovery | 2 | Network errors get a proper inline alert with retry; invalid quantity silently reverts with no explanation |
| 10 | Help and Documentation | 1 | No reassurance/help at the point of payment; footer trust links (Envíos, Privacidad, etc.) all resolve to /login |
| **Total** | | **20/40** | **Acceptable (50%)** |

## Design Specificity Verdict

Reads as generic, not Versale-authored. Every color on the page is ink/neutral/danger — terracotta appears nowhere on "Pagar," the summary, or any cart chrome — and prices render in plain monospace instead of the Fraunces treatment already used on product cards elsewhere in the same codebase.

**Deterministic scan**: CLI on cart/page.tsx = 0 findings. Browser scan = 6-8 findings; the `all-caps-body` (Topbar), `skipped-heading` (h2→Footer h4), `overused-font`, `cream-palette` findings are all shared chrome, out of scope. Three `low-contrast 1.0:1 #1a1a1a on #1a1a1a` findings could not be pinpointed to a specific element before the tab was closed by pool contention — flagged as unresolved, recommend re-running.

## Priority Issues

- **[P0] Destructive actions have no confirmation or undo.** One misclick permanently wipes a cart of one-of-a-kind items. Fix: confirm dialog before clearCart; an undo-window toast before per-item removal actually fires.
- **[P1] Checkout can complete with a fully blank shipping address.** No `required` attributes; the mutation posts `{}` when every field is empty. Fix: mark fields required, block submit until validated.
- **[P1] "Total" is mislabeled relative to unresolved shipping** — Total equals Subtotal exactly while shipping says "se calcula al entregar," undercutting price transparency at the point of payment.
- **[P1] No live-region announcements; quantity/remove controls aren't disambiguated per item** — all quantity inputs share the accessible name "Cantidad," all remove buttons share "Eliminar," with no product qualifier.
- **[P2] Zero brand identity on the highest-stakes screen** — "Pagar" and cart prices use ink/mono tokens instead of terracotta/Fraunces.

## Persona Red Flags

- **Sam**: tabbing hears "Cantidad, edit text, 1" then "Cantidad, edit text, 2" with no way to tell which item is which, and no confirmation the total updated.
- **Riley**: at 375px, scrolls past both item cards and the full 5-field address form before ever seeing Subtotal/Total or "Pagar" — no sticky summary below `lg`.
- **Alex**: sees the price next to "Pagar" with no security badge, no return-window mention, and an unresolved shipping line — can't tell if the price is final or how payment even works.

## Minor Observations

64px Fraunces H1 is disproportionate to the dense card content below it; "Vaciar carrito" occupies the same header slot other pages reserve for primary (non-destructive) actions; `max={99}` on quantity is arbitrary since Product has no stock field.
