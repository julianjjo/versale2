# E2E: Ciclo de vida completo del pedido — disputas, crons y envío vendedor

## Objetivo
Cubrir P1 sin E2E: PENDING→PAID→SHIPPED→DELIVERED→DISPUTED↔REFUNDED, shipOwnSale con guarda mixta, notificaciones, y crons 7d/30d. Hoy solo existe mock Jest.

## Arquitectura
- Playwright serial (`test.describe.configure serial`) como `shopping.spec.ts`.
- API directa (`/orders`, `/orders/admin/:id/status`, `/orders/mine/sales/:id/ship`, `/orders/:id/dispute`, `/notifications`, `/orders/mine/sales`, `GET /products?search=` para relist) — UI solo si aporta señal.
- Helpers existentes: `purchasable.ts` (`createPurchasableProduct`, `createBuyer`, `E2E_SHIPPING_ADDRESS`, `API_URL`), `seed.ts` (`E2E_USERS`), fixture `auth.ts` opcional. Sin nuevas deps.
- Fotos disputa: `https://localhost/e2e-dispute.jpg` (pasa `IsBucketImageUrlConstraint` sin `R2_PUBLIC_BASE_URL`: permite localhost https).
- Crons no expuestos por HTTP: backdate vía `PrismaClient` directo (`file:apps/api/e2e.db` via `PrismaBetterSqlite3`) y verificación de estado por `GET /orders/:id`. Documentado `ponytail:`.

## Flujo
```
buyer POST /orders (PENDING) → admin PATCH PAID (paidAt) → seller PATCH /mine/sales/:id/ship (SHIPPED+notif ORDER_SHIPPED)
→ GET /notifications verifica → admin PATCH DELIVERED (deliveredAt) → GET /orders/mine/sales visible
→ buyer POST /:id/dispute (DISPUTED, fotos) → 409 dup → admin PATCH REFUNDED (relista AVAILABLE, check GET /products)
↔ variante DISPUTED→DELIVERED
Guardas: 403 mixed-seller ship, 400 >48h, 400 sin fotos, 409 única disputa
Crons: backdate paidAt-8d y disputeExpiresAt pasado; ponytail: sweeps no HTTP, DB assertion + comentario.
```

## Componentes
- `e2e/tests/order-lifecycle.spec.ts` — único archivo, helpers locales `approve`, `createAsSeller`, `addToCart`.
- Reutiliza transacción existente SOLD↔AVAILABLE y `ORDER_SHIPPED` en `orders.service.ts`. Sin cambio de app salvo bugfix si 403/409/relist diverge.

## Testing
- Serial evita SOLD cruzado; cada test crea productos únicos (sufijo aleatorio) y buyers efímeros.
- Assertions: status code + `GET /orders/:id` + catálogo + notifs.
- Crons: backdate con Prisma, `expect(status).toBe(PAID/DISPUTED)` con `ponytail: cron no expuesto — verificaría REFUNDED tras sweep`.
- `npm run e2e` debe pasar con el resto de specs; `npm run test:api` sin regresión.
