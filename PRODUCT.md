# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Spanish-speaking buyers and sellers of pre-owned clothing in Colombia. There is
no separate seller role: any registered `USER` becomes a seller simply by
publishing a product on `/sell` (the product row's `sellerId` is that user).
`ADMIN` users moderate the catalog, manage other users, and update order
status. Anyone can browse and buy without registering as a "merchant" first.

## Product Purpose

Versale is a commercial marketplace (actively in progress toward launch, not
a portfolio or client demo) for buying and selling pre-owned clothing. It
exists to make secondhand shopping feel trustworthy and curated rather than
like an unmoderated flea market, and to make selling low-friction enough that
any user can list an item without a separate seller application.

Success means real buyers and sellers transacting through the catalog, cart,
checkout, and order-history flow. The specific monetization model (commission
on sales, listing fees, subscription, or none) has not been decided — record
this as an open decision, not yet designed; do not invent pricing or fee
mechanics for it.

## Positioning

Confirmed differentiators versus a generic resale-marketplace clone (e.g. a
Vinted/Depop copy):

- **Admin-moderated trust.** Every listing is reviewed and approved before it
  appears in the public catalog (`isApproved: false` until an admin acts).
  Curation is the trust mechanism, not just optional moderation.
- **Frictionless selling.** There is no seller role, application, or
  onboarding gate. Any registered `USER` starts selling the moment they
  publish on `/sell`.
- **Sustainability / circular-fashion framing.** The product is positioned
  around reducing textile waste and extending a garment's life, not purely as
  "cheap secondhand shopping."

## Operating Context

- **Target market: Colombia, specifically** (confirmed, not a placeholder).
  Money renders as COP via `Intl.NumberFormat("es-CO", { style: "currency",
  currency: "COP", maximumFractionDigits: 0 })` through the shared `Price`
  component.
- Core workflows: browse/search the catalog (filter by size, brand,
  condition, category, price) → product detail → cart → checkout → order
  history; list a product via `/sell` → pending admin approval → visible in
  catalog; leave a product review and star rating; admin dashboard for user
  management, product approval, and order-status updates.
- Two roles only: `USER` and `ADMIN`. There is no `SELLER` role — a "seller"
  is a `USER` who has published at least one product.
- Auth is email + password exchanged for a JWT (`/auth/signup`,
  `/auth/login`); the token is stored client-side and drives which nav/admin
  affordances render.

## Capabilities and Constraints

- Product catalog with filtering by size, brand, condition, category, and
  price.
- Persistent cart, checkout into an order, and order history per user.
- Product reviews and star ratings.
- Admin capabilities: approve/reject products, manage users, update order
  status. Order status values are `Pendiente`, `Pagado`, `Enviado`,
  `Entregado`, `Cancelado` (display labels only — the underlying enum keys
  stay in English).
- New products default to unapproved and are excluded from the public
  catalog until an admin approves them.
- Monetization mechanics (commission, fees, subscription, or none) are an
  explicitly open product decision — not yet designed.

## Brand Commitments

- Name: **Versale**.
- All visible copy — storefront, dashboard, forms, error messages — is in
  Spanish. Tests select elements by their Spanish label; a copy change must
  update the UI and its tests together, never diverge from Spanish.

## Evidence on Hand

- No real testimonials, case studies, press mentions, or production content
  exist yet. Any testimonial/stat content in the current visual reference
  (`index.html`, `DESIGN.md`) is illustrative placeholder copy, not real
  evidence — future work must not present it as genuine customer content.

## Product Principles

1. **Trust before volume.** Admin moderation gates every listing; curation
   is a feature shoppers rely on, not friction to route around.
2. **Selling should feel like posting, not applying.** No seller role, no
   gatekeeping step beyond the first listing's approval.
3. **Secondhand is the product, not the compromise.** The sustainability /
   circular-fashion framing is a real position to design toward, not
   decorative copy.
4. **Colombia first.** COP currency and the `es-CO` locale are a committed
   market decision; do not generalize copy or currency handling to other
   markets without a new decision.
