# Confirmación post-checkout (ítem 7)

> Hito 1, ítem 7 de `docs/todo-implementacion.md`. Tras pagar, el comprador
> debe aterrizar en la página del pedido que acaba de crear — no en el
> historial.

## Cambio

`apps/web/src/app/cart/page.tsx`: el mutation de checkout ahora captura la
respuesta de `POST /orders` (que devuelve el pedido creado con su `id`) y
redirige a `/orders/{id}` en lugar de `/orders`.

La página destino ya mostraba todo lo que la confirmación necesita:

- **Número**: encabezado `Pedido #{id.slice(0,8)}`.
- **Estado**: badge con etiqueta del enum (`Pendiente` al crear; el timeline
  de estados cubre el ciclo posterior).

## Pruebas

- Unit (`cart.test.tsx`): "redirige a /orders/[id]" — el push va a
  `/orders/order1`, no a `/orders`.
- E2E (`shopping.spec.ts`, flujo de compra): tras hacer click en "Pagar", se
  espera `URL /orders/<id>` y se afirma que el heading `Pedido #…` y el badge
  de estado (`Pendiente`) son visibles.
