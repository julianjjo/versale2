# Reseñas verificadas — elegibilidad por entrega y unicidad fuerte

> Hito 1, ítem **1.6** de `docs/funcionalidades-propuestas.md`.

## Problema

Hoy cualquiera autenticado puede reseñar cualquier producto aprobado (el
`create()` de `ReviewsService` no pregunta si el autor compró algo), y los
" duplicados" no se rechazan: un segundo POST sobre el mismo (usuario, producto)
actualiza silenciosamente la reseña previa. La señal de confianza "compra
verificada" es inflable y una carrera entre dos POSTs concurrentes puede crear
duplicados reales.

## Cambios

### C1 — Elegibilidad: solo compras entregadas

`create()` exige que exista un `OrderItem` cuyo `Order` cumpla:

```
order.userId = usuario actual  AND  order.status = DELIVERED  AND  productId = producto reseñado
```

Sin ese registro → `400` con mensaje en español ("solo tras entrega").
Decisión cerrada del roadmap: **DELIVERED exclusivamente** — ni PENDING ni PAID
ni SHIPPED habilitan reseñar. El badge `verifiedPurchase` (mostrado en la ficha)
conserva su semántica actual (`VERIFIED_PURCHASE_STATUSES`, solo presentación) y
no cambia en este hito.

La auto-reseña del vendedor sigue bloqueada (guard existente, sin cambios).

### C2 — Duplicados: rechazo explícito + índice único

- App: si ya existe reseña del (usuario, producto), el POST devuelve ahora `400`
  "Ya has reseñado este producto" — antes actualizaba silenciosamente. La UI
  edita vía `PATCH /reviews/:id` (verificado en `product-detail.tsx`), así que
  ningún flujo dependía del update-implícito.
- DB: `@@unique([userId, productId])` en `Review` — cierra la carrera entre dos
  POSTs concurrentes que el chequeo app-level no puede serializar. El error
  Prisma `P2002` se traduce al mismo mensaje 400 en español.

### Migración

`20260822004500_review_unique_user_product`: deduplica conservando la reseña más
reciente por (userId, productId) — sus votos útiles caen en cascada con las
filas eliminadas — y crea `Review_userId_productId_key`. SQLite reconstruye sin
tabla nueva: DELETE + CREATE UNIQUE INDEX.

## E2E

El seed de e2e pasa a incluir un pedido **DELIVERED** del usuario sembrado
(`user@e2e.test`) sobre "Vintage Denim Jacket", para que el flujo existente
"publicar/editar/eliminar reseña" siga siendo alcanzable bajo la nueva regla.
Los tests de admin/pedidos crean sus propios compradores y pedidos y los
identifican por id, así que el pedido sembrado no interfiere.

## Tests API (contrato)

- Rechaza compra no entregada: sin OrderItem, con orden PENDING, PAID o SHIPPED
  → 400; con DELIVERED → crea.
- Rechaza duplicado: segunda creación sobre el mismo (usuario, producto) → 400;
  carrera simulada (`P2002`) → 400 con el mismo mensaje.
- Auto-reseña del vendedor sigue rechazada.
