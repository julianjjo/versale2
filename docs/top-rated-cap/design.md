# Top-rated cap coverage — test MAX_TOP_RATED_SCAN

## Problema

`products.service.ts: MAX_TOP_RATED_SCAN=1000` con `take: MAX_TOP_RATED_SCAN` en `findAll({sortBy:'top_rated'})` (in-memory sort, no DB column) no tiene test que congele el cap. Sin test, un cambio que elimine `take` cargaría todo el catálogo en memoria (OOM en >10k).

## Solución

Agregar 1 test en `products.service.spec.ts` bajo `top_rated`:

- Mock `prisma.product.findMany` para `top_rated` → verificar `findMany` llamado con `take: 1000` y `where` con `PUBLICLY_VISIBLE`.
- Mock `review.groupBy` para ratings, verificar `data` ordenada y `meta.pages` correcto.
- Mantiene `BATCH_SIZE` internal, no expone constante; test valida contrato `take` y `orderBy` no usado (in-memory).

## Verificación

- `npm run test:api` → 729 passed (728→729, +1)
- `npx eslint` → 0/0
