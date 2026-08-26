# Lint cleanup: reports / reviews / uploads — eliminar `any` inseguros + prettier

## Problema

`npm run lint:ci` en `apps/api` reporta **38 errores + 15 warnings** (base `main` + commit `807e786`). Bloquean el gate CI si se toca archivo. Este slice ataca el módulo **reports / reviews / uploads** (13 errores):

- `reports/reports.service.ts:61` — `Unsafe assignment of any` en `async getAll(query: any)`
- `reports/__tests__/reports.service.spec.ts` — 8× `no-unsafe-*` al inspeccionar `mockPrismaService.client.productReport.upsert.mock.calls[0][0]` tipado como `any`
- `reports/dto/__tests__/create-report.dto.spec.ts` — 4× `no-unsafe-*` por `pipe.transform()` → `any` y `memberAccess`
- `reviews/__tests__/reviews.service.spec.ts` — 3× `prettier/prettier` (objetos inline ` { id: 'v1' }` superan límite línea)
- `uploads/uploads.controller.ts` — `_host` unused + `as` innecesario

## Solución (ponytail ultra — mínimo cambio)

1. **reports.service.ts**: tipar `query` como `unknown` + type-guard (`isRecord`) + extracción segura de `page/limit/status`. Mantiene comportamiento (undefined tolerado) sin `any`.
2. **reports.service.spec.ts**: tipar helper `getUpsertCall()` con `Prisma.ProductReportUpsertArgs` y `as unknown` bridge solo donde `mock.calls` es `any`; acceso a `.update` ahora type-checked.
3. **create-report.dto.spec.ts**: `as CreateReportDto` sobre `pipe.transform()` + `'prop' in result` para whitelist checks — patrón ya usado en `create-product` y `questions` specs.
4. **reviews.service.spec.ts**: `npx eslint --fix` para los 3 bloques prettier (multiline objetos) — sin cambio semántico.
5. **uploads.controller.ts**: `_host` → `host`, eliminar `as multer.MulterError` ya tipado + corregir uso.

## No-objetivos

- No tocar warnings `no-unsafe-argument` de controllers (requieren refactor `Request.user` completo) — quedan para siguiente slice.
- No tocar errores `cart`/`auth` introducidos en `807e786` — fuera de scope.

## Verificación

- `cd apps/api && npm run lint:ci` — 0 errores en los 5 archivos tocados.
- `npm run test:api` — 727 tests verdes (incremento o igual).
- `npm run test:web` — sin regresión.
