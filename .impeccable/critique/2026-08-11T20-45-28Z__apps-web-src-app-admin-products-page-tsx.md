---
target: Admin products (/admin/products)
total_score: 17
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-11T20-45-28Z
slug: apps-web-src-app-admin-products-page-tsx
---
Method: dual-agent (A: a062b9ac0b1d4ab30 · B: a71a8459622231ba0)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No success confirmation after approve — the badge just silently flips color |
| 2 | Match System / Real World | 2 | "Eliminar" is asked to represent two different real-world actions: reject an unreviewed submission vs. remove a live listing |
| 3 | User Control and Freedom | 1 | No unapprove/undo path exists in the API at all; the only "recovery" mechanism is a native confirm() before a hard, irreversible delete |
| 4 | Consistency and Standards | 3 | Consistent component reuse; "Aprobar" uses the plain default ink button, never touching accent/success tokens |
| 5 | Error Prevention | 1 | The list view shows only a thumbnail + metadata — an admin can approve a listing without ever seeing the full photos or description |
| 6 | Recognition Rather Than Recall | 3 | All decision-relevant metadata visible inline per row |
| 7 | Flexibility and Efficiency | 0 | Confirmed: no status filter, no search, no bulk-approve, no sort override — the literal control surface for the product's #1 differentiator has none of these |
| 8 | Aesthetic and Minimalist Design | 2 | Two stacked oversized editorial headings (layout H1 + page H2, both 38–72px Fraunces) push the actual queue down |
| 9 | Error Recovery | 2 | Human, Spanish error copy, but it's a single global banner that doesn't name which product failed |
| 10 | Help and Documentation | 1 | No moderation guidelines or disqualification criteria anywhere |
| **Total** | | **17/40** | **Poor (42.5%)** |

## Design Specificity Verdict

A generic admin CRUD table wearing Versale's typography, not a control room for its stated trust mechanism. Pending and approved items get equal visual weight, the approve action gets the same ink-black button as a login form, and the reject/delete distinction a real moderation tool needs doesn't exist at all — swap "Productos" for "Usuarios" in the copy and the page is functionally identical to /admin/users.

**Deterministic scan**: CLI on admin/products/page.tsx = 0 findings. Browser scan = 7-10 findings; 6 trace to shared Topbar/Footer/AdminLayout chrome (including the confirmed Footer ink-on-ink bug). Two are genuinely attributable to this page: 15-16 repeated "—" image-placeholder characters (an `em-dash-overuse` false trigger caused by every seeded product lacking an image) and the H2 half of a heading-skip (the H4 half is the shared Footer's).

## Priority Issues

- **[P0] No reject action; "Eliminar" conflates rejection with permanent deletion.** The backend has no reject/unapprove endpoint at all — only approve and a generic hard delete. A moderator who wants to say "fix your photos and resubmit" has no way to do that. Fix: add a distinct "Rechazar" action for pending items; reserve "Eliminar" for removing a live catalog entry.
- **[P0/P1] Zero flexibility/efficiency tooling for the literal implementation of "admin-moderated trust."** No filter, search, bulk-approve, or sort override — confirmed in both frontend and backend. Fix: segmented Pendientes/Aprobados/Todos filter defaulting to Pendientes, search, and bulk approve.
- **[P1] Approval requires no real review of the listing.** The row shows only a 64px thumbnail — an admin can rubber-stamp approval without ever seeing the full photo set or description. Fix: require opening the detail view, or add an inline expand/preview.
- **[P1] No visual priority for pending items; oversized headings dominate the queue.** Pending and approved rows are visually equal-weight and interleaved by recency. Fix: sort/group pending-first with a visible count; use denser headings on internal Operate pages.
- **[P2] Silent, unscoped feedback** — no success toast/highlight after approve; the error banner doesn't name the affected product.

## Persona Red Flags

- **Alex**: opens the dashboard expecting to see "how many are waiting" but the stat card reports the count of ALL products, approved or not — the entry point into this exact workflow is wrong before Alex even reaches this page.
- **Jordan** (newer admin): clicks "Eliminar" on a pending item meaning "reject," sees a generic confirm dialog with no signal this permanently destroys the record with no seller notification.
- **Casey** (moderating from a phone): at 375px, thumbnail + 3 lines of text + badge + up to 2 buttons pack into one dense wrapping block per row, harder to scan one-handed than desktop.

## Minor Observations

Per-product titles render as plain link text, not headings, so screen-reader users can't jump by heading between rows; the delete confirm() breaks out of the app's own visual system; pagination is untested at current seed size (always 1 page); warning/danger tokens sit close in hue to the terracotta brand accent, making rapid color-only scanning harder.
