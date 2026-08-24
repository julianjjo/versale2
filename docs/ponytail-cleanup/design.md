# Ponytail Cleanup — Fase 1 (safe deletions/shrinks)

## Objetivo

Aplicar los cortes de sobre-ingeniería rankeados con mayor ROI y menor riesgo
de la auditoría ponytail, sin cambiar comportamiento. Deleciones > shinks,
diff más corto gana.

## Arquitectura (estado actual)

- Monorepo `npm workspaces: apps/*` (root `package.json` con `concurrently`).
- `apps/api`: NestJS + Prisma (SQLite dev/e2e, `better-sqlite3` adapter), módulos `auth`, `users`, `products`, `cart`, `orders`, `reviews`, `notifications`, `uploads`, `favorites`.
- `apps/web`: Next.js + fetch-wrapper `lib/api.ts` (`{data}`, `ApiError` con `response.status/data`), `lib/site.ts` (SITE_URL/API_URL), storage helpers (`token.ts`, `recently-viewed.ts`).
- `e2e`: Playwright, `apps/api/e2e.db`, `playwright.config.ts` levanta API+Web, `e2e/utils/seed.ts` vs `apps/api/prisma/seed.ts`.

## Flujos afectados

- **Auth/JWT**: `JwtAuthGuard` (JwtService.verify) es la única vía; `jwt.strategy.ts` es shim muerto post-615c1b7.
- **Uploads**: `UploadsController.fileFilter` (Multer) + `UploadsService.validateFiles` (MIME + magic-bytes) — doble cheque MIME.
- **Notificaciones email**: `BrevoService` (fetch a api.brevo.com) expuesto vía `BrevoModule` Global; usado desde `AuthService`.
- **Trim**: `src/common/trim.decorator.ts` canónico vs duplicado inline en `create-order.dto.ts`.
- **Role**: `@prisma/client Role` vs `src/users/role.enum.ts` copia.
- **Web API**: `extractBlobApiError` alias de `extractApiError` (toApiError ya decodifica igual para blob/json).
- **e2e fixtures**: `fixtures/auth.ts` 3× copy-paste `userPage/adminPage/authorPage`, `utils/purchasable.ts` helpers, `utils/viewport.ts` viewports muertos.

## Componentes y cortes por fase

### Fase 1 — SAFE (este PR)

| # | Área | Corte | Riesgo | Rollback |
|---|------|-------|--------|----------|
| 1 | root | `.gitignore` + `.opencode/*` ignores | nulo | revert |
| 2 | root | Borrar `docs/WORKFLOW.md` (duplicado AGENTS.md) | nulo | revert |
| 3 | root | Borrar `.agents/skills/` (duplicado de `.claude/skills/`, skills-lock.json apunta a `.claude`) | nulo | `git restore` |
| 4 | api/common | Borrar `app.controller.ts` + `app.service.ts` + `app.controller.spec.ts` (AppModule no los importa) | nulo | revert |
| 5 | api/auth | Borrar `src/auth/jwt.strategy.ts` shim (0 imports) | nulo | revert |
| 6 | api/common | Inline `log-and-swallow.ts` → `.catch(e=>logger.error(...))` en 2 call-sites, borrar archivo+spec | bajo | revert |
| 7 | api/users | Dedupe `Role` enum → `import {Role} from '@prisma/client'`, borrar `role.enum.ts` | bajo | revert |
| 8 | api/orders | Dedupe `Trim` en `create-order.dto.ts` → `import {Trim} from '../../common/trim.decorator'` | bajo | revert |
| 9 | api/uploads | Eliminar `imageFileFilter` en controller, dejar `validateFiles` (MIME+magic-bytes) como única validación | bajo | revert |
| 10 | web/lib | Eliminar `extractBlobApiError` alias, usar `extractApiError` | bajo | revert |
| 11 | web/lib | Eliminar `API_URL` duplicado en `app/products/[id]/page.tsx` y `app/vendedores/[id]/page.tsx` → `import {API_URL} from '@/lib/site'` | bajo | revert |
| 12 | web/e2e | `fixtures/auth.ts`: factorizar `loginAs` en factory `makeAuthFixture` | bajo | revert |
| 13 | e2e | `viewport.ts`: borrar viewports muertos, mantener solo usados | nulo | revert |

### Fase 2 — DEFERRED (documentado, no ejecutado)

Módulos con modelos Prisma y migraciones: `payments` (MercadoPago), `questions`, `reports`, `notifications` (campana), votos `helpful` en reviews. Borrarlos ahora deriva migración; requieren feature-flag o archivado con plan de rollback мигра.

- payments/questions/reports/notifications: marcar como `Phase 2` con rollback: `git revert` + `prisma migrate deploy` del estado previo; no tocar hasta decisión de producto.
- `parsePositiveIntEnv` (`common/env.ts`): conserva validación `isInteger && >0 && <=1M`; inlinear `Number(...)||fallback` perdería guards — diferir.
- `BrevoModule` Global indirection: `BrevoService` no es thin wrapper (10s timeout, BrevoApiError, sender); diferir inline a AuthService hasta medir uso.
- `docs/design.md` strip migración >300L: opcional, no bloquea; posponer.

## Estrategia de pruebas

- `npm run test:api` (cd apps/api && npm test) — 100% pass.
- `npm run test:web` (cd apps/web && npm test) — 100% pass.
- `playwright.config.ts` sintaxis check (`npx tsc --noEmit` en web/api, `npx playwright --version`).
- `npm run e2e` si tiempo permite; mínimo verificar que webServer commands aún hacen `migrate deploy` y `seed`.
- Cada grupo de cortes se commitea separado y se verifica antes del siguiente.

## Verificación final

- Commits en `feat/ponytail-cleanup`, `git diff main --stat` muestra solo deleciones/shrinks.
- `main` estable tras `git merge feat/ponytail-cleanup` + `npm run test:api && npm run test:web` en main.
