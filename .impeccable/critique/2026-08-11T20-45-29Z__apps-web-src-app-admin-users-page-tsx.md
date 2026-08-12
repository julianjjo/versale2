---
target: Admin users (/admin/users)
total_score: 12
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-11T20-45-29Z
slug: apps-web-src-app-admin-users-page-tsx
---
Method: dual-agent (A: ae39e23ee35939610 · B: a0124166f1e0db3b9)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Shared `isPending` disables every row's button at once; no success confirmation after delete |
| 2 | Match System / Real World | 2 | "Eliminar" copy-pasted from the products page treats deleting a human account with the same weight as deleting a listing |
| 3 | User Control and Freedom | 1 | No undo, no soft-delete — accepting the native confirm() is final |
| 4 | Consistency and Standards | 2 | Consistent with the Products admin recipe, but the raw browser confirm() breaks the app's own design system and isn't guaranteed to render in Spanish |
| 5 | Error Prevention | 0 | No self-delete or last-admin guard anywhere (frontend or backend); no `role` field exists in the update DTO at all, so a deleted last-admin is unrecoverable without direct DB access; no dependency/cascade check before deleting a user who owns products/orders |
| 6 | Recognition Rather Than Recall | 2 | Role always visible via badge; no signal of a user's product/order footprint |
| 7 | Flexibility and Efficiency | 0 | No search, filter, sort, or pagination; `GET /users` is completely unpaginated |
| 8 | Aesthetic and Minimalist Design | 2 | Two consecutive hero-scale serif headings (layout H1 + page H2) add ornamental weight a dense ops screen doesn't need |
| 9 | Error Recovery | 1 | Deleting a user with dependent records (e.g. the seller with 14 products) would very likely hit an unhandled FK-constraint failure with no actionable message |
| 10 | Help and Documentation | 0 | No explanation anywhere of what "Administrador" grants or what deletion does to a user's data |
| **Total** | | **12/40** | **Poor (30%)** |

## Design Specificity Verdict

A generic "list records + delete" admin template re-skinned with Versale's typography, not a screen designed around what makes this product's user model specifically risky. It structurally mirrors the Products moderation list but drops the one thing that page got right (pagination), and never accounts for PRODUCT.md's own model — that a "seller" is just a USER who published a product, so a row here can silently represent 14 live listings with zero surfaced signal of that.

**Deterministic scan**: CLI on admin/users/page.tsx = 0 findings. Browser scan = 7-9 findings, all attributable to shared Topbar/AdminLayout/Footer chrome (including the confirmed Footer ink-on-ink bug) — zero findings originate in this page's own code.

## Priority Issues

- **[P0] No self-delete or last-admin protection.** The delete button renders unconditionally for every row, including the logged-in admin's own account, with no last-remaining-ADMIN guard server-side and no role-promotion UI anywhere to recover from the mistake. Fix: disable Eliminar for the current user's own row; add a server-side last-ADMIN check.
- **[P0] The native confirm() is the entire error-prevention strategy, and it's uninformed.** One generic Yes/No dialog, identical regardless of role or how much data is attached to the account. Fix: replace with an in-system modal showing role and product/order counts, requiring typed confirmation for ADMIN or high-footprint accounts.
- **[P1] Deleting a user with dependent records has no handled failure path.** No cascade rule and no server-side dependency check — deleting the seller (14 products) is very likely to throw an unhandled 500. Fix: check for dependent records and return an actionable Spanish error, or implement a deliberate cascade/soft-delete strategy.
- **[P1] No search, filter, sort, or pagination** — the core IA question (can an admin quickly find and manage a specific user) fails past a screenful of accounts.
- **[P2] A user's marketplace footprint is invisible before you act on them** — the API already returns join date/verification state, but neither the type nor the page surfaces it, and there's no product/order count.

## Persona Red Flags

- **Alex**: asked to remove a fake account, sees four structurally identical rows with no activity signal — Camila Rodríguez's row (14 live products) looks exactly like a throwaway test account. The blank confirm dialog gives no count of her products or "active seller" warning. Alex closes the tab and asks someone to do it in the database instead.
- **Jordan** (power admin triaging 30 flagged accounts): no search/filter/bulk action, and the shared pending state makes it unclear which row is mid-delete when clicking through quickly.
- **Riley** (screen-reader user): gets no live-region announcement after a delete completes — the row just disappears, forcing a full re-scan to confirm the action worked.

## Minor Observations

The "Administrador" badge measures ~4.10:1 contrast at 12px — under the 4.5:1 AA threshold for normal text; design-token drift between globals.css and DESIGN.md's documented danger/warning/success values; at 375px the admin tab strip's "Usuarios" tab isn't fully visible without a scroll gesture; the footer still shows "Iniciar sesión"/"Crear cuenta" while logged in as admin.
