# AGENTS — apps/web

## Purpose

Next.js (App Router) frontend for Versale. Renders the public catalog, user auth, cart, checkout, seller product management, and admin dashboard. Data is fetched through React Query against the API at `NEXT_PUBLIC_API_URL`.

## Ownership

- **Local contract**: this file.
- Source under `src/`:
  - `src/app/` — Next.js routes (App Router): `(public)`, `admin/`, `cart/`, `login/`, `orders/`, `products/`, `profile/`, `sell/`, `signup/`.
  - `src/components/` — shared UI components grouped by domain (`ui/`, `layout/`, `products/`, `marketing/`).
  - `src/lib/` — client utilities: `api`, `auth`, `token`, `types`, `order-status`, plus `__tests__/`.
  - `src/test-utils/` — test providers and helpers used by Vitest.

## Local Contracts

- Run mode: `npm run dev` (Next dev server, Turbopack).
- API URL: `NEXT_PUBLIC_API_URL` env var (e.g. `http://127.0.0.1:3001`).
- Package manager: `npm` (workspaces resolve at the repo root).
- All visible UI labels, buttons, errors, and copy are in **Spanish** (`Iniciar sesión`, `Crear cuenta`, `Carrito`, `Pendiente`, etc.). Tests must select elements by their Spanish label.
- State management: server state via React Query; auth via the `useAuth` hook in `src/lib/auth.tsx`; tokens stored in `localStorage` under the `versale_token` key.

## Work Guidance

- The `Header` shows admin links only when the logged-in user has role `ADMIN`. The `sell` form (`src/app/sell/page.tsx`) requires authentication; unauthenticated users get the empty-state CTA pointing to `/login`.
- After creating a product via `/sell`, the app pushes the user to `/products` (the product is `isApproved: false` until an admin approves it).
- Money is rendered through the `Price` UI component which formats `Float` amounts as COP currency.
- Order status display goes through `ORDER_STATUS_LABEL` in `src/lib/order-status.ts`. Keep these labels in Spanish.
- The marketing surface (home page, topbar, header, footer) follows the design tokens documented in `design.md` at the repo root. Marketing-only primitives live in `src/components/marketing/` (e.g. `category-grid.tsx`, `closing-cta.tsx`); the home page (`src/app/page.tsx`) is composed from those primitives plus `ProductsBrowser`.
- Marketing copy must only claim capabilities the product actually has. There is no newsletter backend, no returns flow, and no free-shipping threshold, so no surface may promise them; likewise do not present placeholder testimonials or invented metrics as real evidence (see `PRODUCT.md`).
- The `Button` component (`src/components/ui/index.tsx`) accepts a `pill` boolean. In-app CTAs default to the rounded square; marketing CTAs (header auth, hero, editorial) set `pill`.
- HTML5 form validation must not block legitimate input. The sell form price field uses `step="1"` (any positive integer) to match backend DTO constraints.

## Verification

- `npm test` (from `apps/web`) — runs Vitest suites under `src/`.

## Child DOX Index

This subtree does not currently maintain child AGENTS.md files; module-level work guidance is documented inline in source comments.
