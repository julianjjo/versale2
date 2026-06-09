# AGENTS — Versale Repo Root

## Purpose

Versale is a used-clothing marketplace monorepo. This file owns project-wide rules and points to per-area contracts.

## Ownership

- **Root contract**: this file. All subtrees defer to it where their docs are silent.
- **`apps/api`**: NestJS + Prisma backend. See `apps/api/AGENTS.md`.
- **`apps/web`**: Next.js + Vitest frontend. See `apps/web/AGENTS.md`.
- **`e2e`**: Playwright end-to-end tests. See `e2e/AGENTS.md`.

The root keeps repo-wide workflow, DOX hierarchy rules, and the top-level child index.

## Local Contracts

- Workspace manager: `npm` with `apps/*` and `packages/*` workspaces.
- Primary verification commands (run from repo root):
  - API unit/integration tests: `npm run test:api`
  - Web unit tests: `npm run test:web`
  - End-to-end tests: `npm run e2e`
- All three suites must pass before considering test work complete.
- Default API port: 3001 (dev), 3101 (e2e).
- Default Web port: 3000 (dev), 3100 (e2e).

## Work Guidance

- The e2e harness brings up its own API and Web on ports 3101/3100 with a dedicated SQLite file at `apps/api/e2e.db`.
- The e2e API webServer pre-pushes the Prisma schema and runs the API. `e2e/utils/global-setup.ts` only seeds.
- The e2e DB must exist with the schema before the API process starts. Do not move schema bootstrap into globalSetup (the API opens a connection before globalSetup runs).
- Frontend labels and copy are in Spanish. When a test selects UI elements by label, match the rendered Spanish string. Do not change tests to English if the UI is Spanish; fix the UI to stay consistent.

## Verification

- API tests: `cd apps/api && npm test`
- Web tests: `cd apps/web && npm test`
- E2E tests: `npm run e2e` (from repo root). The webServer commands in `playwright.config.ts` reset `apps/api/e2e.db` and re-seed on each run.

## Child DOX Index

- `apps/api/AGENTS.md` — NestJS backend, Prisma data layer, modules (`auth`, `users`, `products`, `cart`, `orders`, `reviews`).
- `apps/web/AGENTS.md` — Next.js frontend, React Query, Vitest.
- `e2e/AGENTS.md` — Playwright suites, fixtures, global setup, seed.
