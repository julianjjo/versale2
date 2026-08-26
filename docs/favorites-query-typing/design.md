# Favorites query typing — eliminar `any` en controller/service

## Problema

`favorites.controller.ts:22` expone `@Query() query: any` y lo pasa directo a `favorites.service.findAll(req.user.id, query)` que espera `Record<string,unknown>`. ESLint marca `no-unsafe-argument` (any→Record). Es el mismo patrón ya resuelto en `reports.service.getAll` (slice #163): `any` oculta que la query viene de la URL sin validar.

Quedan 15 warnings `no-unsafe-argument` en 6 controllers; este slice fixa 1 (favorites) como piloto sin tocar tests.

## Solución (ponytail ultra — `unknown` + guard)

- `favorites.controller.ts`: `@Query() query: unknown` — no cambia runtime, solo tipo de entrada.
- `favorites.service.ts`: `findAll(userId, query: unknown)` → `const q = isRecord(query) ? query : {}; const {page,limit}=q;` con helper `isRecord(v): v is Record<string,unknown>` inline (2 líneas). Mantiene comportamiento previo (`undefined` → defaults) pero ahora type-safe.

No se tocan warnings de `orders/products/notifications` — quedan para siguientes slices idénticos.

## Verificación

- `npx eslint src/favorites/{*.ts,__tests__/*.ts}` → 0 errors en esos 2 archivos (antes 1 warning).
- `npm run lint:ci` → 14 warnings (antes 15), 0 errors.
- `npm run test:api` → 727 passed (sin regresión, `findAll` ya testeado con `{page,limit}`).
