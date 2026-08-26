# Reviews query typing — eliminar `any` en controller/service

## Problema

`reviews.controller.ts:104` expone `@Query() query: any` → `reviews.service.getAllReviews(query: Record<string,unknown>)`. Ultimo `no-unsafe-argument` de controllers (6→5). Continuación #167-170.

## Solución

- `reviews.controller.ts`: `unknown`
- `reviews.service.ts`: `getAllReviews(query: unknown)` + guard `const q = isRecord(query)?query:{}`, destructure `page,limit` igual.

## Verificación

- `npx eslint src/reviews/*` → 0 errors en esos 2 archivos
- `lint:ci` → 5 warnings (6→5), 0 errors
- `npm run test:api` → 727 passed
