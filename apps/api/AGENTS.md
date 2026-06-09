# AGENTS — apps/api

## Purpose

NestJS + Prisma backend for Versale. Exposes REST endpoints for auth, users, products, cart, orders, and reviews. Persists data in SQLite via the `better-sqlite3` Prisma driver adapter.

## Ownership

- **Local contract**: this file.
- Modules in `src/`: `auth`, `users`, `products`, `cart`, `orders`, `reviews`, `prisma`. Each module owns its controller, service, DTOs, and `__tests__/` specs.
- The Prisma schema lives in `prisma/schema.prisma`; generated client is at the repo-root `node_modules/.prisma/client`.

## Local Contracts

- Run mode: `npm run start:dev` (Nest watch) for development, `npm run start:prod` after `npm run build`.
- Database URL: `DATABASE_URL` env var, default `file:./dev.db` (relative to `apps/api`).
- JWT secret: `JWT_SECRET` env var.
- Schema management: `npx prisma db push` for prototyping, `npx prisma migrate dev` for new migrations.
- API base path: `/auth`, `/users`, `/products`, `/cart`, `/orders`, `/reviews`. Admin variants live under each resource's `/admin/*` path.

## Work Guidance

- Money is stored as `Float` in the schema and validated with `class-validator`'s `@IsNumber({ maxDecimalPlaces: 2 })` and `@IsPositive()`. Price inputs in the UI must align with the backend's allowed precision.
- The sell form (`/sell` in the web app) accepts any positive COP price; do not impose step constraints that would reject legitimate prices.
- Order status labels are in Spanish everywhere they are displayed: `Pendiente`, `Pagado`, `Enviado`, `Entregado`, `Cancelado`. The enum values remain the English keys (`PENDING`, etc.).
- All `__tests__/*.spec.ts` files run under Jest with `ts-jest`; tests mock `PrismaService` rather than opening a real DB.

## Verification

- `npm test` (from `apps/api`) — runs all `*.spec.ts` under `src/`.

## Child DOX Index

This subtree does not currently maintain child AGENTS.md files; module-level work guidance is documented inline in source comments and module-level files.
