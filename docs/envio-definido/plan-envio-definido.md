# Envío definido (ítem 13)

> Hito 1, ítem 13 de `docs/todo-implementacion.md` / decisión cerrada 2.3 de
> `docs/funcionalidades-propuestas.md`.

## Decisión cerrada

La transición a `SHIPPED` es **del vendedor dueño** de los productos de la
orden. El admin conserva todas las demás transiciones y solo puede marcar
envío por su cuenta como **fallback en pedidos mixtos** (varios vendedores),
donde ningún vendedor individual podría hacerlo. Envío pagado por el
comprador e incluido en el precio; sin número de tracking obligatorio en esta
fase.

## Estado (preexistente + este cambio)

- **Vendedor**: `PATCH /orders/mine/sales/:id/ship` (`shipOwnSale`) ya
  verificaba dueño de TODOS los ítems, estado `PAID`, con CAS contra carreras
  y notificación al comprador. Este flujo es el camino principal y no cambió.
- **Este cambio**: el endpoint genérico admin
  (`updateOrderStatus` → `PATCH /orders/admin/:id/status`) ahora rechaza
  `SHIPPED` con 403 «Marcar el envío es responsabilidad del vendedor dueño»
  cuando la orden es de un solo vendedor. En pedidos mixtos lo permite como
  fallback — sin esto, una orden multi-vendedor quedaría imposibilitada de
  enviarse nunca.

## Términos visibles

`/terminos` documenta la política: envío incluido en el precio pagado por el
comprador, responsabilidad exclusiva del vendedor, reembolso automático a los
7 días sin envío, ventana de disputa de 48h tras la entrega.

## Pruebas (contrato Done-when: permisos de transición)

- Admin → SHIPPED en pedido de un solo vendedor: 403, sin write
  ('rechaza al admin marcar SHIPPED en un pedido de un solo vendedor').
- Admin → SHIPPED en pedido mixto: permitido como fallback.
- Vendedor dueño de todos los ítems: envía OK (preexistente,
  'should mark a paid order as shipped…', actualizado para mockear orden
  mixta coherente con el fallback).
- Vendedor sin ítems / pedido mixto para un vendedor individual: 403
  (preexistentes).
- Pedido no pagado: 400 (preexistente).
