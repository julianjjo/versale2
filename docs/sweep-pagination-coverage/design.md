# Sweep pagination coverage — test cursor batches

## Problema

`fix/orders-sweep-pagination` (#177) introdujo `BATCH_SIZE=500` cursor loop pero los tests existentes solo cubren `findMany` de 1 batch (<500). Sin test de >500, una regresión que elimine `cursor`/`take` pasaría inadvertida.

## Solución (ponytail ultra)

Agregar 1 test en `orders.service.spec.ts` bajo `cron — timeout de pedidos PENDING`:

- Mock `findMany` con `mockImplementation` que devuelve 500 en primera llamada (cursor undefined) y 10 en segunda (cursor=`id` de último de batch1), luego `[]` implícito no necesario porque segundo batch <500 ya rompe loop.
- Pero para mantener el mock simple y no acoplar a `take/cursor`, se usa `mockResolvedValueOnce` 500 + `mockResolvedValueOnce` 10 con `expect.objectContaining` ya tolerante a paginación.
- Verifica `findMany` llamado 2 veces y `total` 510, y que `transitionStatus` + notificación se llamaron 510 veces (o al menos 2 batches procesados).

Mantiene `BATCH_SIZE` internal, no expone constante; test valida contrato `total` y `findMany` llamadas múltiples.

## Verificación

- `npm run test:api` → 728 passed (727→728, +1)
- `npx eslint` → 0/0
