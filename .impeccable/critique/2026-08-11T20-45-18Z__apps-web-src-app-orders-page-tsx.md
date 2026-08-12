---
target: Orders list (/orders)
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-11T20-45-18Z
slug: apps-web-src-app-orders-page-tsx
---
Method: dual-agent (A: a5fcd2125324c5e4e · B: a40f4a3c057bd1f25)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Nav "Pedidos" link has no active/current-page styling |
| 2 | Match System / Real World | 3 | Orders identified by a raw hex fragment instead of a human, dictatable order number |
| 3 | User Control and Freedom | 3 | No contextual action per order (no cancel-pending, no track-shipment) |
| 4 | Consistency and Standards | 4 | Fully reuses the shared Card/Badge/Price/PageContainer kit |
| 5 | Error Prevention | 3 | Read-only page, nothing destructive to guard |
| 6 | Recognition Rather Than Recall | 2 | Cards show no product name/image — only "N producto(s) · price" |
| 7 | Flexibility and Efficiency | 1 | No search, filter, sort, or pagination; API call has no query params at all |
| 8 | Aesthetic and Minimalist Design | 4 | Genuinely clean, calm card list |
| 9 | Error Recovery | 0 | Confirmed in source: page destructures only `{data, isLoading}` — no `isError` branch at all; a failed fetch renders a blank void under the header |
| 10 | Help and Documentation | 1 | No contextual explanation of status meaning or timelines |
| **Total** | | **24/40** | **Acceptable (60%)** |

## Design Specificity Verdict

Partially authored (Spanish, COP, shared component kit, Fraunces h1) but mostly generic — the card template (muted ID, badge, price, date) is the exact structure of any Shopify/Stripe order-history page. Rendering every order as an anonymous "1 producto" with no name/photo is a bigger miss here than for a generic retailer, since Versale's differentiator is curated, one-of-a-kind pieces a buyer specifically chose.

**Deterministic scan**: CLI on orders/page.tsx = 0 findings. Browser scan = 6 findings, 100% attributable to shared Topbar/Footer/global background, none to the page's own markup. Separately confirmed (not page-specific): the Footer's `FooterColumn` `text-paper/50` opacity class isn't resolving — "Comprar"/"Vender"/"Versale" column headers render at `#1a1a1a` on `#1a1a1a`, effectively invisible.

## Priority Issues

- **[P0] Silent failure on API error.** No `isError` handling anywhere in the component; a failed fetch shows the "Historial de pedidos" header over a blank area with no explanation. Fix: destructure `isError`, render a retry `EmptyState`.
- **[P1] No product identity on the order card.** Only count + price shown, no name/thumbnail — directly undermines the page's own purpose (quickly finding a specific order). Fix: surface the first item's product title + thumbnail.
- **[P1] No reassurance/tracking signal for in-flight orders.** "Enviado" is a static badge with no ETA, carrier, or elapsed-time context — the page's highest-anxiety moment offers less information than a shipping-confirmation email. Fix: add a status timeline + estimated delivery date.
- **[P2] No search, filter, or sort** — fine at 3 orders, breaks down as history grows.
- **[P2] Order reference is an opaque 8-char hex fragment** — not memorable or easily dictated to support.

## Persona Red Flags

- **Riley**: kills the network request and finds a blank area under the header with no error message or retry — files it as a hard bug on sight.
- **Casey**: checks her "Enviado" order one-handed on the go; good tap target, but zero tracking info, so she has to leave the app to get the answer she came for.
- **Jordan**: sees "Pendiente" with no explanation of what it means or how long it lasts, and no product name/photo to confirm she's looking at the right order.

## Minor Observations

Card-internal hierarchy is flat — order ID, price, and date are all similarly weighted; `EmptyState`'s optional icon prop is unused here (and across the whole codebase); `order-status.ts` maps both PAID and SHIPPED to the same "info" blue badge — will become ambiguous once a Pagado order exists; dates render with no relative framing ("hace 3 días").
