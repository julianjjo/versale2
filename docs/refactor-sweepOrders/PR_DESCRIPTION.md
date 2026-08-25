# refactor(orders): dedup 3× sweep loops into sweepOrders helper (ponytail ultra)

## Resumen
Refactor puro de `apps/api/src/orders/orders.service.ts:1004-1140`. Los 3 sweeps horarios (`autoRefundUnshippedPaidOrders` 7d, `autoResolveExpiredDisputes` 30d, `autoCancelStalePendingOrders` 24h) compartían el mismo esqueleto `findMany → for secuencial → transitionStatus → notifySafe → warn → return count` con 3 copias del comentario de mutex SQLite. Se extrae helper privado único `sweepOrders(where, toStatus, notification, warnPrefix, afterTransition?)` — los 3 métodos quedan como thin wrappers que solo calculan su `where`/`cutoff` y delegan. Comportamiento idéntico, sin cambios de lógica.

## Cambios
- `apps/api/src/orders/orders.service.ts` (único archivo tocado):
  - Nuevo `private async sweepOrders(opts: { where, toStatus, notification, warnPrefix, afterTransition? })` con el loop secuencial y el comentario SQLite centralizado.
  - `autoRefundUnshippedPaidOrders` → calcula `cutoff` 7d y llama `sweepOrders` (REFUNDED, ORDER_STATUS_CHANGED, mensaje reembolso 7d, warnPrefix reembolso).
  - `autoResolveExpiredDisputes` → llama `sweepOrders` con `afterTransition` que hace `order.update({ disputeResolvedAt })` (preserva orden: transition → extra update → notify).
  - `autoCancelStalePendingOrders` → calcula `cutoff` 24h y llama `sweepOrders` (CANCELLED, ORDER_CANCELLED, mensaje cancelación pendiente).
  - Añade `// ponytail: 3× loop dedup into helper, split into per-status sweepers if drift needs isolation`.
  - Diff neto: -22 líneas (81 borradas, 59 añadidas; ponytail deletion over addition).

## Decisiones arquitectónicas
- **Helper privado vs 3 helpers:** 1 helper gana (shortest diff). Si un sweep diverge en el futuro, split según comentario ponytail.
- **Opts object vs posicionales:** objeto tipado con `Prisma.OrderWhereInput`/`OrderStatus`/`NotificationType` — legible, soporta `afterTransition` opcional sin overloads.
- **Warn unificado:** `warnPrefix + id` centralizado; mensajes originales preservados vía `warnPrefix` por caller (no genérico).
- **Secuencial preservado:** comentario mutex `better-sqlite3` movido al helper (fuente única).

## No-objetivos
- No toca `precio-sugerido`, no añade Reputación/Métricas, UI sigue en español, no nuevas deps ni interfaces.

## Verificación (final, validado en main @ 16c6ad5 tras repair 2026-08-25)
- `Remove-Item -Recurse -Force apps/web/node_modules` + `apps/api/node_modules` + `npm install` (re-hoist workspaces, elimina `.vite` stale).
- `npm run test:api`: **47 suites, 714 tests PASSED**, 0 fail (47 passed, 714 total).
- `npm run test:web`: **43 suites, 548 tests PASSED**, 0 fail (43 passed, 548 total) — corrige diagnóstico `ridiculous-cyan-krill` (7 entries incompletas + `configLoader: 'native'` fallando antes de `vi.mock`).
- `npx prisma generate` no requerido (client hoisted en `node_modules/.prisma` sigue vigente); `npx tsc --noEmit` sin errores implícito en jest.
- Reviewer PASS + diff neto -22L + no new deps re-confirmados.

## Riesgo / Reversión
- Riesgo bajo: refactor sin lógica nueva. Si drift futuro (ej. disputa necesita más pasos), separar helper en 2 según comentario ponytail.
- Reversión: `git revert` del único commit.
