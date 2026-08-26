# Orders sweep pagination — unbounded scan fix (ponytail debt)

## Problema

`orders.service.ts: sweepOrders` hace `findMany(where, select:{id,userId,status})` sin `take`/`cursor`. Con backlog grande (>1k tras outage) carga todas las filas en memoria de una vez — OOM en SQLite y supera `maxWait` si el sweep secuencial ya es lento (ver comentario sobre mutex). Ponytail marcó `// ponytail: unbounded scan, paginate with cursor if rows >1k`.

## Solución (ponytail ultra — cursor batch)

- `sweepOrders`: `BATCH_SIZE=500` (por debajo del cap 5000 de `MAX_EXPORT_ROWS`, suficiente para hourly cron sin presionar memoria). Loop `while(true)` con `take: BATCH_SIZE`, `cursor: {id: lastId}`, `skip:1`, `orderBy:{id:'asc'}` (determinístico, no depende de `where`). Acumula `total` y procesa cada batch secuencialmente con `transitionStatus` + `notifySafely` (mantiene serie por mutex SQLite, no `Promise.allSettled`).
- `findMany` por batch try/catch → `total` ya acumulado, break con error log (mismo `warnPrefix`).
- Mantiene `orderBy` estable; `where` sin cambios.

## Verificación

- `npm run test:api` → 727 passed (sweeps mockeados con `findMany` por batch; tests existentes `findMany` mockeado con `mockResolvedValue` que ignora `take/cursor`, sigue retornando batch).
- `npx eslint` → 0/0 (api+web)
- Manual: con 1200 stale orders, loop hace 3 batches (500+500+200) vs OOM previo.

## No-objetivos

- No cambiar `MAX_EXPORT_ROWS` ni `sweep interval`.
- No paralelizar `transitionStatus` (mantiene `for` serie por mutex).
