# Orders debug sweeps — ponytail debt

## Problema

`e2e/tests/order-lifecycle.spec.ts:385` marcaba `// ponytail: si hace falta testear autoRefund/autoResolve por HTTP, exponer POST /orders/admin/debug/run-sweeps solo en NODE_ENV=test.` y `:83/334` usaban `backdate directo a DB` como `minimal e2e bridge` porque `cron not exposed via HTTP`. Sin endpoint HTTP, e2e debe hacer `prisma.order.update` directo para simular deadlines, acoplado a implementación DB y no prueba el sweep via HTTP.

## Arquitectura

- Single file winner: `apps/api/src/orders/orders.controller.ts` (+ `orders.service.ts` ya expone `runOrderDeadlineSweeps` público).
- Añadir `POST admin/debug/run-sweeps` bajo `admin/*` (dos segmentos, no colisiona con `:id`), con `RolesGuard` + `ADMIN`, y guard `if (process.env.NODE_ENV !== 'test') throw NotFound` — solo test, no prod.
- Handler llama `await ordersService.runOrderDeadlineSweeps()` y retorna `{ ok: true, ranAt: new Date().toISOString() }` (o totales si se quiere verificar).
- No cambia `runOrderDeadlineSweeps` — ya es idempotente y secuencial.

Alternativa descartada: exponer cada sweep por separado (`/debug/autoRefund`, `/debug/autoResolve`) — YAGNI, un endpoint que corre los 3 cubre e2e.

## Data flow

- E2E (futuro): `POST /orders/admin/debug/run-sweeps` con admin JWT → controller → `runOrderDeadlineSweeps()` → `autoCancelStalePendingOrders` + `autoRefundUnshippedPaidOrders` + `autoResolveExpiredDisputes` (cada uno paginado 500) → retorna ok.
- Actual: e2e sigue usando backdate directo, pero endpoint ya existe como upgrade path para cuando se quiera testear vía HTTP.

## Componentes

- `OrdersController`: nuevo `POST admin/debug/run-sweeps` después de `admin/:id/status`, antes de `:id/dispute`, con `NotFoundException` guard.
- `PONYTAIL-DEBT.md` — actualizar `order-lifecycle:385` entry a `upgrade: endpoint exists POST /orders/admin/debug/run-sweeps (test only)`.

## Testing strategy

- `npm run test:api` — controller no tiene test unitario directo, pero `orders.service.spec.ts` para sweeps sigue 221 pass; nuevo endpoint no rompe rutas existentes (`admin/*` dos segmentos, no colisiona con `:id`).
- Manual: `curl -H "Authorization: Bearer $ADMIN_JWT" -X POST http://localhost:3001/orders/admin/debug/run-sweeps` en `NODE_ENV=test` → 201 `{ok:true}`; en `NODE_ENV=production` → 404.
- `grep -rn ponytail` → `order-lifecycle:385` ahora con `upgrade: endpoint exists`.

## Riesgos

- Ninguno prod: guard `NODE_ENV !== 'test'` → 404 fuera de test. Admin guard ya existe.
- No expone PII, solo trigger sweeps.

## Ponytail ceiling

- `// ponytail: POST /orders/admin/debug/run-sweeps solo en NODE_ENV=test; no exponer en prod, no añadir auth bypass` — techo explícito.
