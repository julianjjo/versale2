# Products query typing — eliminar `any` en controller/service

## Problema

`products.controller.ts` expone 3 rutas con `@Query() query: any` (`findAll`, `findAllMine`, `findAllForAdmin`) → `products.service` `Record<string,unknown>`. 3 warnings `no-unsafe-argument`. Continuación #167-169.

## Solución

- `products.controller.ts`: 3× `unknown`
- `products.service.ts`: `findAll(query: unknown={})`, `findAllMine(sellerId, query: unknown={})`, `findAllForAdmin(query: unknown={})` con guard `const q = isRecord(query)?...:{}`, destructure idéntico.

## Verificación

- `npx eslint src/products/*` → 0 errors en 2 archivos
- `lint:ci` → 6 warnings (9→6), 0 errors
- `npm run test:api` → 727 passed
