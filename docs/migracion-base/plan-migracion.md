# Migración base — Enum `ProductStatus` y checkout a prueba de doble venta

> Hito 1, ítems **1.1 + 1.2** de `docs/funcionalidades-propuestas.md` (decisión cerrada:
> es **una sola migración**, no dos implementaciones).

## Problema

Hoy el estado de stock de un producto se dispersa en columnas booleanas/timestamp
sueltas (`soldAt`, junto a `pausedAt` e `isApproved`). Cada consulta compone a mano la
regla "¿está disponible?", lo que invita a derivas entre catálogo, carrito, checkout y
moderación. Además, la única garantía anti-doble-venta es la re-lectura dentro de la
transacción + `updateMany` condicional sobre `soldAt` — correcto, pero acoplado a una
columna timestamp que no expresa el ciclo de vida.

## Objetivo

1. **Enum `ProductStatus { AVAILABLE, SOLD, WITHDRAWN }`** como única fuente de verdad
   del ciclo de vida de stock.
2. **`rejectionReason`** ya existe (migración `20260812172855_add_rejection_and_sold_columns`);
   esta migración lo documenta y lo deja intacto — pertenece al ciclo de moderación,
   deliberadamente separado del ciclo de stock (decisión del roadmap, ítem 1.7).
3. **Índices Prisma** actualizados a la nueva columna (`status` reemplaza `soldAt` en
   los índices compuestos del catálogo).
4. **Checkout atómico**: dentro de la `$transaction` existente, marcar `SOLD` con
   `updateMany({ where: { id, status: 'AVAILABLE' } })` y verificar `count === 1` por
   producto — evita TOCTOU / doble venta.
5. **`quantity = 1` forzada** en CartItem/OrderItem (ropa usada = prenda única).
6. **Bloqueo de compras no `AVAILABLE`**: carrito, checkout y edición rechazan todo
   producto cuyo estado no sea `AVAILABLE`.

## Decisiones de diseño

### D1 — `status` reemplaza a `soldAt` (no conviven)

`soldAt DateTime?` se **elimina**. Mantener ambas columnas crea dos fuentes de verdad
que inevitablemente derivan. Si más adelante se necesita la fecha exacta de venta, la
fila `Order` que compró la prenda ya la registra (`Order.createdAt`; llegar a ella
desde un ítem requiere el join `OrderItem.order`).

Backfill en la migración SQL (una sola pasada, SQLite):

```sql
ALTER TABLE "Product" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'AVAILABLE';
UPDATE "Product" SET "status" = 'SOLD' WHERE "soldAt" IS NOT NULL;
-- SQLite reconstruye la tabla para soltar la columna (prisma migrate lo genera).
```

### D2 — `pausedAt` permanece ortogonal; `WITHDRAWN` queda reservado

`pausedAt` es el toggle temporal del vendedor (pausar/reactivar, con bulk), ya probado
en producción de tests. `WITHDRAWN` se define en el enum pero **ningún código lo escribe
en este hito**: queda reservado para el retiro definitivo que se cableará en 1.3 ("Mis
publicaciones"). Mezclar ambos ahora cambiaría la semántica y el copy de una feature
funcionante sin necesidad. El checkout igualmente re-afirma `pausedAt: null` en el
`updateMany` (re-lectura fresca anti-carrera ya existente).

### D3 — Regla de traducción mecánica

| Antes                  | Después                          |
| ---------------------- | -------------------------------- |
| `soldAt: null`         | `status: ProductStatus.AVAILABLE` |
| `soldAt: { not: null }` | `status: ProductStatus.SOLD`     |
| `product.soldAt` (truthy) | `product.status !== ProductStatus.AVAILABLE` |

`WITHDRAWN` nunca se escribe en este hito, así la traducción preserva el comportamiento
exacto. El enum se importa de `@prisma/client` (generado), igual que `NotificationType`.

### D4 — `quantity = 1` ya forzada, se blinda en la escritura

`MAX_ITEM_QUANTITY = 1` + `@Max(1)` en los DTOs de carrito ya rechazan cantidad > 1 con
400. Se añade blindaje en `createOrder`: los `OrderItem` se escriben con `quantity: 1`
literal (clamp defensivo, no confía en el snapshot del carrito), y el total se calcula
con esa misma constante.

### D5 — Índices

```prisma
@@index([isApproved, status, pausedAt, createdAt])  // antes: [isApproved, soldAt, pausedAt, createdAt]
@@index([isApproved, status, pausedAt, price])      // antes: [isApproved, soldAt, pausedAt, price]
```

El catálogo filtra `isApproved + status + pausedAt` y ordena por `createdAt`/`price`:
misma forma, columna nueva. SQLite no soporta índices parciales vía Prisma, así que la
condición vive en el `WHERE` y el índice compuesto la cubre.

## Flujo de datos del checkout (post-migración)

```
POST /orders
  └─ $transaction(async tx => {
       1. Lee carrito + productos (snapshot).
       2. Por ítem: rechaza si !isApproved / status !== AVAILABLE /
          auto-compra / pausedAt (mensajes específicos en español).
       3. Crea Order + OrderItems (quantity: 1 literal).
       4. updateMany({ where: { id: { in }, status: AVAILABLE, pausedAt: null },
                       data: { status: SOLD } })
          → si count !== productIds.length ⇒ throw ⇒ ROLLBACK completo.
       5. Vacía carrito.
     })
```

Dos checkouts concurrentes sobre la misma prenda: el `updateMany` condicional es el
punto de serialización — solo uno ve `count === 1`; el otro revierte íntegro
(decisión cerrada 1.2: sin órdenes parciales).

La cancelación de orden (comprador o admin) libera la prenda con
`updateMany({ where: { id: { in }, status: SOLD }, data: { status: AVAILABLE } })` —
condicional sobre `SOLD` para que, cuando 1.3 cable `WITHDRAWN`, una cancelación nunca
resucite un retiro definitivo del vendedor.

Nota de tests: los specs web que hoy fabrican fixtures con `soldAt` (string ISO) pasan
a `status: 'SOLD'` / `'AVAILABLE'` en esta misma migración.

## Alcance de archivos

- **API**: `schema.prisma`, nueva migración SQL, `products.service.ts`, `cart.service.ts`,
  `favorites.service.ts`, `orders.service.ts` y sus specs.
- **Web**: `lib/types.ts`, `product-detail.tsx`, `cart/page.tsx`, `mis-productos/page.tsx`,
  `admin/products/page.tsx` y specs — todos lecturas de `soldAt` → `status`.
- **E2E**: sin cambios de código (solo comentarios en `e2e/utils/purchasable.ts`).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
| --- | --- |
| Doble venta por carrera | `updateMany` condicional + verificación `count` dentro de la transacción (testeado). |
| Datos huérfanos tras backfill | Backfill determinista `soldAt → SOLD`; `WITHDRAWN` no existe aún; verificación post-migración en tests de integración. |
| Deriva de reglas "¿disponible?" | Constantes compartidas (`PUBLICLY_VISIBLE`, `ProductStatus`) — una sola definición. |
| Regresión en UI "Vendido" | Specs web actualizadas; badge pasa de `!!soldAt` a `status === 'SOLD'`. |
