# Versale — Used Clothing Marketplace

[![codecov](https://codecov.io/gh/julianjjo/versale2/branch/main/graph/badge.svg)](https://codecov.io/gh/julianjjo/versale2)

A full-stack editorial marketplace for buying and selling pre-owned clothing. Versale pairs a NestJS + Prisma backend with a Next.js 16.2.7 storefront and a Playwright end-to-end suite, all running from a single npm workspace.

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
│  │  ├─ src/               # modules: auth, users, products, cart, orders, reviews, payments, uploads, favorites, reports, questions, notifications, common, prisma
│  │  └─ AGENTS.md          # backend-specific contract
│  └─ web/                  # Next.js storefront
│     ├─ src/app/           # routes: admin, cart, login, signup, verify-email, forgot-password, reset-password, products/[id], sell, mis-productos, mis-ventas, favoritos, vendedores/[id], orders, profile, ayuda, contacto, terminos, privacidad, cookies, envios, sitemap.ts, robots.ts
│     ├─ src/components/    # layout/, marketing/, products/, ui/
│     ├─ src/lib/           # api, auth, token, site, auth-events, recently-viewed, categories, etc.
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

### Tests

| Command             | Framework | What it covers                                |
| ------------------- | --------- | --------------------------------------------- |
| `npm run test:api`  | Jest      | API unit + integration tests (Supertest)      |
| `npm run test:web`  | Vitest    | Web unit + component tests                    |
| `npm run e2e`       | Playwright | Full-stack end-to-end flows                  |
| `npm run e2e:ui`    | Playwright | Same suites in the interactive UI runner    |
| `npm run e2e:report`| —         | Opens the last Playwright HTML report         |

> Scripts reales en `package.json` (root): `dev`, `dev:api`, `dev:web`, `build`, `start`, `start:api`, `start:web`, `test:api`, `test:web`, `e2e`, `e2e:ui`, `e2e:report`.

#### Coverage & Test Analytics (Codecov)

CI sends Codecov two different reports per suite: **lcov** for coverage, and **JUnit XML** for [Test Analytics](https://app.codecov.io/gh/julianjjo/versale2/tests) — the view that tracks flaky tests, failure rates and slowest tests. The JUnit report is what the `test:ci` scripts add on top of the plain coverage run:

| Command                                | Coverage report               | JUnit report                      | Codecov flag |
| -------------------------------------- | ----------------------------- | --------------------------------- | ------------ |
| `npm run test:ci --workspace=apps/api` | `apps/api/coverage/lcov.info` | `apps/api/test-results/junit.xml` | `api`        |
| `npm run test:ci --workspace=apps/web` | `apps/web/coverage/lcov.info` | `apps/web/test-results/junit.xml` | `web`        |
| `CI=true npm run e2e`                  | —                             | `test-results/junit.xml`          | `e2e`        |

Two details worth keeping if this is ever edited:

- The JUnit upload steps run under `if: ${{ !cancelled() }}`, unlike the coverage ones. A failing suite fails its test step and would skip every step after it — and failures are exactly the data Test Analytics exists to collect, so skipping that upload would hide every regression and every flake.
- Playwright only emits JUnit when `CI` is set, and writes it to `test-results/` instead of its `outputDir`, which it wipes at the start of each run. All three `test-results/` directories are gitignored.

#### e2e specifics

The Playwright harness is self-contained: it boots its **own** API and Web instances on ports **3101** (API) and **3100** (Web), backed by a dedicated SQLite file at `apps/api/e2e.db`. The API `webServer` command in `playwright.config.ts` runs `node e2e/utils/reset-db.js && npx prisma migrate deploy --schema=./prisma/schema.prisma` against that file before starting Nest, and `e2e/utils/global-setup.ts` only seeds users and products.

That means you do not need the dev servers running to execute e2e — `npm run e2e` brings everything up and tears it down for you.

> Schema bootstrap lives in the API `webServer` (not in `globalSetup`) because the API process opens its SQLite connection before global setup runs. Moving the bootstrap anywhere else triggers `SQLITE_READONLY_DBMOVED`.

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

- **`SQLITE_READONLY_DBMOVED` during e2e** — the API process started before `node e2e/utils/reset-db.js && npx prisma migrate deploy` finished. The fix lives in `playwright.config.ts`; do not move the schema bootstrap into `e2e/utils/global-setup.ts` (globalSetup only seeds).
- **Playwright browser missing** — run `npx playwright install --with-deps chromium` (the suite only needs Chromium).
- **Stale Prisma client** — after editing `apps/api/prisma/schema.prisma`, run `npx prisma generate` and restart the dev server.
- **Fonts look like the system fallback** — check that `next/font` can reach Google Fonts in your environment; the dev server prints a warning if the fetch fails.

## License

MIT.
