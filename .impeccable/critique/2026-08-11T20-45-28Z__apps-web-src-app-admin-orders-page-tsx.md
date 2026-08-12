---
target: Admin orders (/admin/orders)
total_score: 14
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-11T20-45-28Z
slug: apps-web-src-app-admin-orders-page-tsx
---
Method: dual-agent (A: af94ad021cdba7857 · B: a3e456debc784a059)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | The shared mutation instance disables every row's Select during any single row's save |
| 2 | Match System / Real World | 3 | Correct Spanish status vocabulary; a linear fulfillment progression is presented as an unordered flat select |
| 3 | User Control and Freedom | 1 | No undo, no confirmation; one-click status change in either direction can silently revert Entregado to Pendiente |
| 4 | Consistency and Standards | 1 | Inconsistent with its own siblings: /admin/products shows seller identity and guards delete with confirm(); this page shows neither |
| 5 | Error Prevention | 0 | No confirmation dialog on any status transition; the backend writes any status to any status with zero transition validation |
| 6 | Recognition Rather Than Recall | 2 | Status always visible, but buyer identity is never surfaced despite the API already fetching it |
| 7 | Flexibility and Efficiency | 0 | No search, filter, sort, bulk update, or pagination — confirmed the backend query has no skip/take at all |
| 8 | Aesthetic and Minimalist Design | 2 | Redundant Select+Badge pairing shows the identical status word twice per row |
| 9 | Error Recovery | 2 | A real `role="alert"` Spanish error region exists, but it's generic and not tied to which row failed |
| 10 | Help and Documentation | 1 | No guidance on what a transition means or whether it's reversible |
| **Total** | | **14/40** | **Poor (35%)** |

## Design Specificity Verdict

Not a purpose-built moderation tool — it's a near-verbatim reuse of the consumer-facing /orders history card with a `<Select>` bolted onto the read-only Badge. It's measurably less capable than its own sibling admin screens: /admin/products already paginates and shows seller identity; this page has neither, despite the backend already fetching the buyer's name and email for every order.

**Deterministic scan**: CLI on admin/orders/page.tsx = 0 findings. Browser scan = 7-9 findings, all attributable to shared Topbar/Footer/AdminLayout chrome (including the confirmed, known Footer ink-on-ink bug) — none originate in this page's own code.

## Priority Issues

- **[P0] Buyer identity is completely invisible, though the API already sends it.** The card shows only an ID fragment, item count, total, and date — never a name. The backend's `getAllOrders()` already includes `user: {id, name, email}`, but the frontend type doesn't even declare the field. Fix: surface `order.user?.name` in the card and use it as the basis for search.
- **[P0] Status changes fire immediately, with no confirmation, no undo, and no server-side guard.** Five adjacent dropdown options, one misclick, and a moderator can silently cancel a live order or revert a delivered one — inconsistent with the confirm() pattern already used on sibling admin screens. Fix: guard backward/cancelling transitions with a confirmation; consider an explicit "Guardar" step.
- **[P1] No filter, search, sort, bulk action, or pagination for a repeated, at-volume task.** Fix: status filter chips, a buyer/order-id search box, pagination, and bulk status update.
- **[P1] Mobile squeeze: the order's meta line collapses into an unreadable ~88px column** right next to the interactive Select, on the exact device a moderator triaging from their phone would use. Fix: force the controls onto their own line at small breakpoints.
- **[P2] Redundant status display** — the Select's value and the Badge repeat the identical word on every row.

## Persona Red Flags

- **Alex**: gets a support ticket referencing a buyer by name and has no on-screen way to match it to a row — has to leave this screen entirely to find the buyer, defeating the page's purpose.
- **Jordan**: opens the page on a commute; the meta line squeezes into a 4-line, ~90px-wide sliver right next to the status control being changed.
- **Casey** (closing out a shipping batch of 15 orders): no multi-select or bulk action, so 15 individual, unconfirmed, un-audited clicks replace what should be a 30-second task.

## Minor Observations

Design-token drift: globals.css's success/warning/danger values don't match DESIGN.md's documented hex values (contrast still passes); the Select's `aria-label` is identical and generic across every row, giving screen-reader users no way to tell which order a given control belongs to; the "Pedido #xxxx" link has no visible affordance of being clickable beyond hover-underline.
