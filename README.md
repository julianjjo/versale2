# Versale — Used Clothing Marketplace

[![CodSpeed](https://img.shields.io/endpoint?url=https://codspeed.io/badge.json)](https://app.codspeed.io/julianjjo/versale2?utm_source=badge)
[![codecov](https://codecov.io/gh/julianjjo/versale2/branch/main/graph/badge.svg)](https://codecov.io/gh/julianjjo/versale2)

A full-stack editorial marketplace for buying and selling pre-owned clothing. Versale pairs a NestJS + Prisma backend with a Next.js 15 storefront and a Playwright end-to-end suite, all running from a single npm workspace.

The visual system (typography, color tokens, button, card, and section patterns) is documented in [`design.md`](./design.md) and is the source of truth for every UI change.

## Stack

- **Backend** — NestJS 11, Prisma ORM, SQLite (local), JWT auth, AWS S3 SDK for Cloudflare R2 image storage
- **Frontend** — Next.js (App Router) + React 19, Tailwind CSS v4, React Query, Vitest
- **E2E** — Playwright with its own API + Web on ports 3101 / 3100 and a dedicated SQLite file
- **Package manager** — npm workspaces (`apps/*`)

## Repository layout

```
versale/
├─ apps/
│  ├─ api/                  # NestJS + Prisma backend
│  │  ├─ prisma/            # schema.prisma + migrations
│  │  ├─ src/               # modules: auth, users, products, cart, orders, reviews
│  │  └─ AGENTS.md          # backend-specific contract
│  └─ web/                  # Next.js storefront
│     ├─ src/app/           # routes (App Router)
│     ├─ src/components/    # layout/, marketing/, products/, ui/
│     └─ AGENTS.md          # frontend-specific contract
├─ e2e/                     # Playwright suites, fixtures, seed
│  └─ AGENTS.md             # e2e-specific contract
├─ design.md                # Visual system (tokens, components, anti-patterns)
└─ AGENTS.md                # Repo-wide contract (start here)
```

`AGENTS.md` (root) is the entry point — it links to the per-area contracts that own the actual rules for the API, the web app, and the e2e harness. **Read it first.**

## Features

- Email + password authentication (JWT) with two roles: `USER` and `ADMIN`. Any registered user can both buy and sell — there is no separate `SELLER` role. A user becomes a "seller" simply by publishing a product on `/sell`; the row's `sellerId` is the user who created it. Admins moderate the catalog (approve products, manage users, update order status).
- Product catalog with search and filtering (size, brand, condition, category, price)
- Persistent shopping cart, order checkout, and order history
- Product reviews and star ratings
- Admin dashboard: user management, product approval, order status
- Editorial design system: Fraunces (display) + Inter (body) + terracotta accent, pill CTAs, dark footer
- Fully responsive (mobile drawer, `xl`/`lg`/`sm` breakpoints)
- Spanish copy across the storefront, dashboard, and forms

## Prerequisites

- **Node.js 18+** (Node 20 LTS recommended)
- **npm 9+** (workspaces are first-class)
- A C toolchain only if Playwright needs to install browsers from scratch (`npx playwright install --with-deps chromium`)

## Getting started

### 1. Install dependencies

```bash
npm install
```

This installs the root devDeps (Playwright, ESLint, Prettier, concurrently) and both workspaces.

### 2. Configure environment

Create `apps/api/.env` with the local development values:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="change-me-to-a-long-random-string"
PORT=3001
```

> `apps/web` reads `NEXT_PUBLIC_API_URL` at build time. It defaults to `http://localhost:3001` in development. The e2e harness injects a different value when it boots.

### 3. Initialize the database

```bash
cd apps/api
npx prisma migrate deploy      # apply existing migrations
npx prisma generate            # regenerate the client
npm run seed                   # creates admin@versale.local + demo users
```

For a clean reset during development:

```bash
cd apps/api
npx prisma migrate reset       # drops, recreates, re-seeds dev.db
npm run seed                   # re-add the admin + demo users
```

> **If your `dev.db` was created with `prisma db push`**, `migrate deploy` cannot
> be applied to it. A pushed database has no `_prisma_migrations` ledger, so
> `deploy` replays the migrations from the very first one and fails with
> `table "User" already exists` — and a failed migration stays marked as failed,
> which blocks every later run until it is resolved.
>
> The simplest fix, since `dev.db` holds nothing but seed data, is to recreate it
> from the migrations:
>
> ```bash
> cd apps/api
> rm -f dev.db dev.db-journal
> npx prisma migrate deploy
> npm run seed
> ```
>
> To keep the existing data instead, baseline the ledger by marking every
> migration already contained in the pushed schema as applied, then deploy the
> rest:
>
> ```bash
> cd apps/api
> npx prisma migrate resolve --applied 20260606184402_init
> # …repeat for each migration the pushed schema already includes…
> npx prisma migrate deploy
> ```
>
> Prefer `prisma migrate dev` over `db push` from here on: it keeps the ledger in
> step with the schema, which is what lets `deploy` work everywhere.

See [Seeded users](#seeded-users) for credentials and the production admin flow.

### 4. Start development servers

```bash
npm run dev
```

This runs the API and the web app concurrently:

| Service | URL                       | Notes                              |
| ------- | ------------------------- | ---------------------------------- |
| API     | http://localhost:3001     | NestJS, auto-reload via `nest start --watch` |
| Web     | http://localhost:3000     | Next.js dev server                  |

You can also run them individually:

```bash
npm run dev:api      # API only
npm run dev:web      # Web only
```

## Available scripts

All commands are run from the repository root unless noted.

### Development

| Command            | What it does                                              |
| ------------------ | --------------------------------------------------------- |
| `npm run dev`      | API + Web in parallel (concurrently)                      |
| `npm run dev:api`  | API on port 3001 with file-watch reload                   |
| `npm run dev:web`  | Next.js dev server on port 3000                           |

### Build & start

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `npm run build`  | Builds both workspaces (NestJS + Next.js)                 |
| `npm start`      | Runs both production servers in parallel                  |
| `npm run start:api` | API from `dist/main`                                   |
| `npm run start:web` | `next start` on the production build                    |

### Lint & format

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `npm run lint`   | ESLint over `.ts` and `.tsx` across the monorepo          |
| `npm run format` | Prettier write across the whole tree                     |

### Tests

| Command             | Framework | What it covers                                |
| ------------------- | --------- | --------------------------------------------- |
| `npm test`          | Jest + Vitest | API unit/integration + Web unit tests      |
| `npm run test:api`  | Jest      | API unit + integration tests (Supertest)      |
| `npm run test:web`  | Vitest    | Web unit + component tests                    |
| `npm run e2e`       | Playwright | Full-stack end-to-end flows                  |
| `npm run e2e:ui`    | Playwright | Same suites in the interactive UI runner    |
| `npm run e2e:report`| —         | Opens the last Playwright HTML report         |

#### e2e specifics

The Playwright harness is self-contained: it boots its **own** API and Web instances on ports **3101** (API) and **3100** (Web), backed by a dedicated SQLite file at `apps/api/e2e.db`. The API `webServer` command in `playwright.config.ts` runs `prisma db push` against that file before starting Nest, and `e2e/utils/global-setup.ts` only seeds users and products.

That means you do not need the dev servers running to execute e2e — `npm run e2e` brings everything up and tears it down for you.

> Schema bootstrap lives in the API `webServer` (not in `globalSetup`) because the API process opens its SQLite connection before global setup runs. Moving the bootstrap anywhere else triggers `SQLITE_READONLY_DBMOVED`.

### Benchmarks

Performance benchmarks run on Vitest's bench runner and are tracked in CI by [CodSpeed](https://codspeed.io). They live next to the code they measure, in `apps/api/bench/` and `apps/web/bench/`, and use their own Vitest configs (`vitest.bench.config.mts`) so the unit-test setup stays untouched.

| Command             | What it covers                                                                    |
| ------------------- | --------------------------------------------------------------------------------- |
| `npm run bench`     | Both workspaces                                                                    |
| `npm run bench:api` | DTO validation, JWT signing/verification, roles guard, products + orders services  |
| `npm run bench:web` | UI primitives, product card rendering, API error parsing, product/order list logic |

The API benchmarks drive the services against in-memory Prisma stubs, so they measure service logic (validation, authorization, totals, query building, response shaping) without a database in the loop. Run `npx prisma generate` in `apps/api` once before the first API benchmark run.

To reproduce the CI measurements locally with the [CodSpeed CLI](https://codspeed.io/docs/cli):

```bash
codspeed run --mode simulation -- npm run bench
```

Every push to `main` and every pull request runs `.github/workflows/codspeed.yml`, which measures the benchmarks and reports the results back on the PR.

## Seeded users

The signup endpoint always creates a `USER`. The admin role has to be granted explicitly through the seed script.

### e2e (Playwright)

`e2e/utils/seed.ts` provisions three users every time the e2e suite runs:

| Role  | Email              | Password     | Name        | Purpose |
| ----- | ------------------ | ------------ | ----------- | ------- |
| USER  | `user@e2e.test`    | `user12345`  | E2E User    | Buys products, leaves reviews |
| ADMIN | `admin@e2e.test`   | `admin12345` | E2E Admin   | Moderates catalog, manages orders |
| USER  | `author@e2e.test`  | `author12345`| E2E Author  | Owns the seeded `Product` rows (`sellerId` FK) |

The "author" is a regular `USER` — there is no `SELLER` role. Any user that publishes on `/sell` becomes an author of their own products.

These accounts live in `apps/api/e2e.db` and are wiped on every `npm run e2e` run. They are **not** available against `apps/api/dev.db`.

### Local development (`apps/api/dev.db`)

Run the seed script to bootstrap an admin plus two demo users against your dev database:

```bash
cd apps/api
npm run seed
```

Defaults (overridable via env vars):

| Role  | Email                  | Password     | Name           |
| ----- | ---------------------- | ------------ | -------------- |
| ADMIN | `admin@versale.local`  | `admin12345` | Versale Admin  |
| USER  | `user@versale.local`   | `user12345`  | Demo User      |

The demo `USER` can both buy and publish products — log in with it to exercise the full flow.

The script is **idempotent**: re-running it does not duplicate users; if the admin already exists with role `ADMIN` it is left alone, and if the email exists with role `USER` it is promoted to `ADMIN` and rotated. To use a custom admin, override the defaults:

```bash
cd apps/api
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=your-strong-password npm run seed
```

### Production

In production the seed script **refuses to run** without explicit `ADMIN_EMAIL` and `ADMIN_PASSWORD`, never logs the password, and skips the demo users. Generate a strong password with `openssl`:

```bash
cd apps/api
NODE_ENV=production \
  ADMIN_EMAIL=admin@yourdomain.com \
  ADMIN_PASSWORD="$(openssl rand -base64 32)" \
  npm run seed
```

Save the generated password in your password manager — it will not be printed again. The admin can change it after the first login through the profile endpoint.

## API reference

All endpoints are mounted under `http://localhost:3001`. Most write endpoints require an `Authorization: Bearer <jwt>` header obtained from `/auth/login` or `/auth/signup`.

### Auth
- `POST /auth/signup` — register a new user
- `POST /auth/login` — exchange credentials for a JWT

### Users
- `GET    /users/me`            — current user profile
- `PATCH  /users/me`            — update current user profile
- `GET    /users`               — list all users (**admin**)
- `GET    /users/:id`           — fetch user by id
- `PATCH  /users/:id`           — update any user (**admin**)
- `DELETE /users/:id`           — delete a user (**admin**)

### Products
- `GET    /products`                       — public catalog with filters
- `GET    /products/:id`                   — single product
- `POST   /products`                       — create (auth)
- `PATCH  /products/:id`                   — update (owner)
- `DELETE /products/:id`                   — delete (owner)
- `GET    /products/admin/all`             — all products incl. pending (**admin**)
- `PATCH  /products/admin/:id/approve`     — approve a product (**admin**)

### Cart
- `GET    /cart`
- `POST   /cart/items`
- `PATCH  /cart/items/:itemId`
- `DELETE /cart/items/:itemId`
- `DELETE /cart`

### Orders
- `POST   /orders`                          — checkout from cart
- `GET    /orders`                          — current user history
- `GET    /orders/:id`                      — single order (owner)
- `GET    /orders/admin/all`                — all orders (**admin**)
- `PATCH  /orders/admin/:id/status`         — update status (**admin**)

Status values are localized in the UI: `Pendiente`, `Pagado`, `Enviado`, `Entregado`, `Cancelado`.

### Reviews
- `GET    /reviews/product/:productId`
- `POST   /reviews`                         — create (auth)
- `PATCH  /reviews/:id`                     — update (owner)
- `DELETE /reviews/:id`                     — delete (owner)

## Project conventions

- **Spanish copy.** Frontend strings, error messages, and admin labels are in Spanish. Tests select by Spanish text — change the UI to match, not the other way around.
- **Design tokens live in `design.md`.** Do not introduce ad-hoc colors, type scales, or radii. New components should reuse `.btn-pill*`, `.heading-*`, `.text-eyebrow`, and the ink/paper/terracotta tokens from `apps/web/src/app/globals.css`.
- **The `Button` `pill` prop is opt-in.** In-app buttons default to `rounded-md`; only marketing CTAs (hero, newsletter, footer) pass `pill`.
- **Per-area contracts.** `apps/api/AGENTS.md`, `apps/web/AGENTS.md`, and `e2e/AGENTS.md` extend the root contract for their respective workspaces. If this README conflicts with one of them, the area-level document wins for that area.

## Troubleshooting

- **`SQLITE_READONLY_DBMOVED` during e2e** — the API process started before `prisma db push` finished. The fix lives in `playwright.config.ts`; do not move the schema push into `e2e/utils/global-setup.ts`.
- **Playwright browser missing** — run `npx playwright install --with-deps chromium` (the suite only needs Chromium).
- **Stale Prisma client** — after editing `apps/api/prisma/schema.prisma`, run `npx prisma generate` and restart the dev server.
- **Fonts look like the system fallback** — check that `next/font` can reach Google Fonts in your environment; the dev server prints a warning if the fetch fails.

## License

MIT.
