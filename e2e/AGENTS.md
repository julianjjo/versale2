# AGENTS — e2e

## Purpose

Playwright end-to-end test suite for Versale. Exercises the full stack: web UI, API, and SQLite database seeded from `e2e/utils/seed.ts`.

## Ownership

- **Local contract**: this file.
- Layout:
  - `e2e/tests/` — Playwright spec files (one per area: `auth`, `shopping`, `seller-admin`, `responsive`).
  - `e2e/fixtures/` — shared fixtures, e.g. `auth.ts` (logged-in `userPage`, `adminPage`, `sellerPage`).
  - `e2e/utils/` — `global-setup.ts`, `seed.ts`, `viewport.ts`.

## Local Contracts

- Runs against dedicated ports: API on `3101`, Web on `3100`. The `baseURL` for the web is `http://127.0.0.1:3100`.
- Dedicated SQLite file: `apps/api/e2e.db`.
- Test user credentials are exported from `e2e/utils/seed.ts` as `E2E_USERS` (user, admin, seller).
- `playwright.config.ts` orchestrates the harness. The API `webServer` command pushes the Prisma schema before starting Nest; the Web `webServer` command starts `next dev`. `e2e/utils/global-setup.ts` runs the seed script after both servers are reachable.

## Work Guidance

- **Schema bootstrap runs in the API `webServer` command, not in global-setup.** The API process opens a SQLite connection at boot. If global-setup recreates the file, the API's connection points to a deleted inode and the next write fails with `SQLITE_READONLY_DBMOVED`. The current `playwright.config.ts` chain is: `prisma db push … && npx nest start` so the schema is on disk before the API process starts.
- `global-setup.ts` only runs the seed (`npx tsx e2e/utils/seed.ts`). The seed wipes and re-inserts the demo users and products; it never touches the schema.
- Select UI elements by their Spanish label. The web app copy is Spanish, and tests live in the rendered language.
- The `e2e.db` file is rewritten on every `npm run e2e` run via the API webServer command's `prisma db push`. Do not add it to `.gitignore` exceptions that would keep it across runs.
- The `auth` fixture logs the test user in via the actual login page to keep cookie/session behaviour realistic; do not bypass the API.

## Verification

- `npm run e2e` (from repo root). Runs the configured projects (`chromium` by default) against the in-process API and Web.

## Child DOX Index

This subtree does not currently maintain child AGENTS.md files; test patterns are documented in the spec files themselves and the shared fixtures.
