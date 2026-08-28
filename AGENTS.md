# AGENTS — Versale Repo Root

## Purpose

Versale is a used-clothing marketplace monorepo. This file owns project-wide rules and points to per-area contracts.

## Ownership

- **Root contract**: this file. All subtrees defer to it where their docs are silent.
- **`apps/api`**: NestJS + Prisma backend. See `apps/api/AGENTS.md`.
- **`apps/web`**: Next.js + Vitest frontend. See `apps/web/AGENTS.md`.
- **`e2e`**: Playwright end-to-end tests. See `e2e/AGENTS.md`.

The root keeps repo-wide workflow, DOX hierarchy rules, and the top-level child index.

## Mandatory Execution Workflow (8-Step Pipeline)

For EVERY feature or task (especially backlog items from `todo-implementacion.md`), agents MUST strictly execute this 8-step pipeline before marking a goal as complete:

1. **Sync & Branch**: Never develop directly on `main`. Always update `main` first (`git checkout main && git pull origin main`), then create a dedicated feature branch (`git checkout -b feat/<nombre-funcionalidad>`).
2. **Plan & Document**: Create a folder `docs/<nombre-funcionalidad>/` and draft a design `.md` file detailing architecture, data flows, components, and testing strategy.
3. **Multi-Angle Plan Review**: Conduct an initial design review focusing on architecture, security, performance, and test strategy. Update the plan with necessary adjustments.
4. **Development & Testing**: Implement the feature code and write unit/integration/E2E tests to maintain or increase project coverage.
5. **PR Preparation**: Stage and commit all changes to the feature branch (`feat/<nombre-funcionalidad>`).
6. **Deep AI Review**: Run a deep code analysis over the feature diff to identify and fix security vulnerabilities, performance bottlenecks, or code smells.
7. **Safe Merge to `main`**: Verify that the PR fulfills ALL original requirements and edge cases defined in the task. Ensure all verification test suites pass at 100%. Switch back to `main`, sync latest changes, and perform the merge (`git checkout main && git pull origin main && git merge feat/<nombre-funcionalidad>`). **Explicitly verify the merge was successful (no conflicts) and that the `main` branch build remains stable.**
8. **Cleanup & Completion**: Delete the local feature branch (`git branch -d feat/<nombre-funcionalidad>`), compact context if necessary, and call `complete_goal`. The detached auditor will verify the `Done when:` contract directly on the clean `main` branch.

## Local Contracts

- Workspace manager: `npm` with `apps/*` workspaces.
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

- `apps/api/AGENTS.md` — NestJS backend, Prisma data layer, modules (`auth`, `users`, `products`, `cart`, `orders`, `reviews`, `payments`, `uploads`, `favorites`, `reports`, `questions`, `notifications`, `common`, `prisma`).
- `apps/web/AGENTS.md` — Next.js 16.2.7 frontend, React Query, Vitest, routes `mis-productos`, `mis-ventas`, `favoritos`, `vendedores/[id]`, `verify-email`, `sitemap.ts`/ `robots.ts`.
- `e2e/AGENTS.md` — Playwright suites, fixtures, global setup, seed.
- `design.md` — Visual design system (tokens, components, accessibility, anti-patterns) adapted from the static reference in `index.html`. Owns all palette, type, spacing, and component-level rules for the web app.
- `docs/arquitectura.md` — Diagrama Mermaid del monorepo: módulos de `apps/api`, rutas y capas de `apps/web`, y las integraciones externas (Brevo, Cloudflare R2, Mercado Pago) sobre Prisma/SQLite.
- `docs/funcionalidades-propuestas.md` — Roadmap por hitos (v4 histórico + Estado actual v5 verificado 2026-08-24). Cerrado y estable: implementar desde "Orden de implementación del Hito 1"; reabrir solo si cambia una premisa verificada del código o llega tracción real.
- `docs/todo-implementacion.md` — 17 ítems sincronizados a v5 (verificados en main); pipeline ahora en `AGENTS.md §8-Step Pipeline` (reemplaza `docs/WORKFLOW.md` eliminado).
