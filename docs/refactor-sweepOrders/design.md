# Refactor: deduplicar 3× sweep loops → sweepOrders helper

## Problema
`apps/api/src/orders/orders.service.ts:1004-1140` tiene 3 sweeps horarios idénticos en estructura (findMany → for secuencial → transitionStatus → notify → warn → return count). Solo cambian: where, targetStatus, mensaje de notificación y hook post-transición. Duplicación = 3× riesgo de drift si se cambia comentario de SQLite mutex o manejo de errores.

## Solución (ponytail ultra — deletion)
Extraer `private async sweepOrders(...)` único. Los 3 métodos públicos quedan como thin wrappers que pasan su `where`, `toStatus`, notificación y opcional `afterTransition`.

- **Archivo tocado:** `apps/api/src/orders/orders.service.ts` (único)
- **Sin nuevas dependencias, sin interfaces con una impl, sin config.**
- `// ponytail: 3× loop dedup into helper, split into per-status sweepers if drift needs isolation`

### Firma propuesta (mínima)
```ts
private async sweepOrders(opts: {
  where: Prisma.OrderWhereInput;
  toStatus: OrderStatus;
  notification: { type: NotificationType; message: string };
  warnPrefix: string; // para logger.warn
  afterTransition?: (order: { id: string }) => Promise<void>;
}): Promise<number>
```
El loop secuencial + comentario SQLite + manejo warn viven solo ahí.

### Flujo
```
runOrderDeadlineSweeps → autoCancelStalePendingOrders → sweepOrders(where PENDING, CANCELLED, ORDER_CANCELLED, msg)
                      → autoRefundUnshippedPaidOrders → sweepOrders(where PAID, REFUNDED, ORDER_STATUS_CHANGED, msg)
                      → autoResolveExpiredDisputes    → sweepOrders(where DISPUTED, REFUNDED, ORDER_STATUS_CHANGED, msg, after=disputeResolvedAt)
```

## Testing
- Existentes `orders.service.spec.ts` ya cubren los 3 sweeps (1. 7d refund, 2. 30d disputa, 3. 24h pending) y `runOrderDeadlineSweeps` cuenta 3 llamadas findMany. Deben seguir 100% green.
- Sin tests nuevos obligatorios; si se añade 1, que sea aserción de que helper es usado o edge de fallo individual no aborta sweep (ya existe para pending, se mantiene).
- `npm run test:api` y `npm run test:web` 100% green desde worktree.

## Riesgos y no-objetivos
- No cambia lógica: mismo where, mismo cutoff, mismo transitionStatus, misma notificación.
- No toca precio-sugerido, Reputación/Métricas, UI Spanish.
- Performance: O(n) igual; secuencial a propósito por mutex SQLite (comentario preservado).
- Reversión: si un sweep diverge (ej. disputa necesita pasos extra), split helper en 2 — el comentario ponytail lo anticipa.

## Verificación
- Diff más corto gana. Solo `orders.service.ts` debe cambiar (menos líneas totales).
- `npm run test:api` / `test:web` verdes; e2e opcional.

## Revisión multi-ángulo (2026-08-25, self-review)
- **Arquitectura:** PASS — helper privado único, wrappers thin, sin nuevas capas. Alternativa de 3 helpers separados sería más código (rejected).
- **Seguridad:** PASS — where hard-coded, no input de usuario; transitionStatus CAS se preserva; notificaciones siguen notifySafely.
- **Performance:** PASS — O(n) idéntico, secuencial deliberado por mutex better-sqlite3; comentario SQLite se mueve al helper (fuente única).
- **Tests:** PASS — 28+ casos existentes siguen verdes; no baja coverage.
- Acción: ninguna corrección necesaria; se deja firma con opts object por legibilidad vs 5 posicionales.
