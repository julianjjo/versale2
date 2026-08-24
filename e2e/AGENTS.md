# AGENTS — e2e

## Purpose

Playwright end-to-end test suite for Versale. Exercises the full stack: web UI, API, and SQLite database seeded from `e2e/utils/seed.ts`.

## Ownership

- **Local contract**: this file.
- Layout:
  - `e2e/tests/` — Playwright spec files (one per area: `auth`, `shopping`, `seller-admin`, `responsive`).
  - `e2e/fixtures/` — shared fixtures, e.g. `auth.ts` (logged-in `userPage`, `adminPage`, `authorPage`). `authorPage` is a regular `USER` whose account owns the seeded products — there is no separate `SELLER` role in the product model.
  - `e2e/utils/` — `global-setup.ts`, `seed.ts`, `viewport.ts`.

## Local Contracts

- Runs against dedicated ports: API on `3101`, Web on `3100`. The `baseURL` for the web is `http://127.0.0.1:3100`.
- Dedicated SQLite file: `apps/api/e2e.db`.
- Test user credentials are exported from `e2e/utils/seed.ts` as `E2E_USERS` (user, admin, author — there is no `seller` role; the author is a regular `USER` that owns seeded products).
- `playwright.config.ts` orchestrates the harness. The API `webServer` command runs `node e2e/utils/reset-db.js && npx prisma migrate deploy --schema=./prisma/schema.prisma && npx nest start` (portable on Windows via `reset-db.js`); the Web `webServer` command starts `next dev`. `e2e/utils/global-setup.ts` runs the seed script after both servers are reachable.

## Work Guidance

- **Schema bootstrap runs in the API `webServer` command, not in global-setup.** The API process opens a SQLite connection at boot. If global-setup recreates the file, the API's connection points to a deleted inode and the next write fails with `SQLITE_READONLY_DBMOVED`. The current `playwright.config.ts` chain is: `node e2e/utils/reset-db.js && npx prisma migrate deploy --schema=./prisma/schema.prisma && npx nest start` so the schema is on disk before the API process starts. `reset-db.js` is a Node `fs` script (portable, replaces POSIX `rm -f`).
- `global-setup.ts` only runs the seed (`npx tsx e2e/utils/seed.ts`). The seed wipes and re-inserts the demo users and products; it never touches the schema.
- Select UI elements by their Spanish label. The web app copy is Spanish, and tests live in the rendered language.
- The `e2e.db` file is rewritten on every `npm run e2e` run via the API webServer command's `node e2e/utils/reset-db.js && npx prisma migrate deploy`. Do not add it to `.gitignore` exceptions that would keep it across runs.
- The `auth` fixture logs the test user in via the actual login page to keep cookie/session behaviour realistic; do not bypass the API.

## Verification

- `npm run e2e` (from repo root). Runs the configured projects (`chromium` by default) against the in-process API and Web.

## Child DOX Index

This subtree does not currently maintain child AGENTS.md files; test patterns are documented in the spec files themselves and the shared fixtures.
