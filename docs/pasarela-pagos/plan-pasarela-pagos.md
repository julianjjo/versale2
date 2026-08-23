# Pasarela de pagos — MercadoPago (ítem 16)

> Hito 3, ítem 16 de `docs/todo-implementacion.md`.

## Decisión cerrada

Checkout pagado con **MercadoPago en modo sandbox**, integrado por
redirección (`init_point` de una preferencia) y confirmación por **webhook
verificado contra la API de MP**. La idempotencia del webhook vive en la base
de datos: `Payment.paymentId` es `@unique`, así que los reintentos de MP no
pueden marcar un pedido PAID dos veces.

## Arquitectura

- **Módulo nuevo** `apps/api/src/payments/`: `PaymentsController` +
  `PaymentsService`. Importa `OrdersModule` (que ahora exporta
  `OrdersService`) para mover el pedido a PAID por el camino canónico
  (`transitionStatus`: CAS + estampa `paidAt`), nunca con un update directo.
- **Schema**: modelo `Payment { paymentId @unique, orderId, status, amount,
  rawPayload }` + migración `20260822080000_payments_mercadopago`.
  `rawPayload` guarda la respuesta completa de MP para auditoría/soporte.
- **Web**: tarjeta "Pago de tu pedido" en `/orders/[id]` para pedidos
  `PENDING` propios; botón crea la preferencia y redirige a `initPoint`.

## Flujo de datos

1. Comprador con pedido `PENDING` pulsa "Pagar con MercadoPago" →
   `POST /payments/mp/preference { orderId }` (JWT requerido).
2. API valida dueño + estado `PENDING`, arma la preferencia con los ítems
   reales de la orden (precios del server, nunca del cliente),
   `external_reference = orderId`, y devuelve `init_point`
   (`sandbox_init_point` tiene prioridad).
3. Web redirige a MP. El comprador paga en sandbox y vuelve por las
   back_urls (`/orders/[id]` o `/cart`).
4. MP notifica `POST /payments/webhooks/mp` (público, sin JWT). El body NO se
   confía: la API re-consulta `GET /v1/payments/{data.id}` con
   `MP_ACCESS_TOKEN` server-side.
5. Si el pago está `approved`, coincide el monto con `totalAmount` de la
   orden y el `paymentId` no existe aún: se inserta la fila `Payment`
   (el índice único serializa webhooks concurrentes) y la orden pasa a PAID
   vía `OrdersService.updateOrderStatus`, con notificación al comprador.

## Decisiones de seguridad

- **Verificación server-side, no firma**: en vez de validar la firma del
  webhook, se re-consulta el pago contra `api.mercadopago.com` autenticando
  con el token del server — un atacante no puede falsificar lo que la API de
  MP responde. No se necesita `MP_WEBHOOK_SECRET`.
- **El body nunca decide**: solo se usa `data.id`; todo lo demás viene de la
  respuesta verificada de MP.
- **Guardia de monto**: si `transaction_amount < totalAmount` (pago
  manipulado/parcial), se registra la fila para auditoría pero NO se marca el
  pedido PAID. Comparación en centavos (`Math.round(x * 100)`) por ser `Float`.
- **Sin credenciales no hay simulación**: sin `MP_ACCESS_TOKEN` ambos
  endpoints fallan claro con 503; jamás se simula un pago exitoso.
- **Timeouts**: `AbortSignal.timeout(10s)` en ambos llamados a MP.

## Idempotencia

1. Reintento posterior del mismo pago: `findUnique(paymentId)` existe →
   `{ processed: false, duplicate: true }`, sin tocar la orden.
2. Carrera de dos webhooks simultáneos: ambos pasan el `findUnique`, pero el
   segundo `create` viola el índice único. Solo se tratan como duplicado los
   errores P2002 (o su mensaje de unique constraint); cualquier otro error de
   BD se relanza — un fallo de red no debe enmascararse como "duplicado".
3. Orden ya PAID (pagada por otro medio): el camino canónico rechaza la
   transición ilegal PENDING→PAID… no aplica: solo se llama cuando la orden
   sigue PENDING; si cambió mientras tanto, `transitionStatus` hace CAS y
   falla con 400 sin corromper nada.

## Desarrollo local (ngrok)

```bash
ngrok http 3001   # URL pública → panel de MP (sandbox):
                  # https://<sub>.ngrok.app/payments/webhooks/mp
```

`apps/api/.env.example` documenta `MP_ACCESS_TOKEN` (credenciales de prueba
del panel de desarrolladores de MP).

## Pruebas (contrato Done-when: webhooks evitan pagos duplicados)

`payments.service.spec.ts` cubre:

- Primera notificación `approved` → fila Payment creada + orden PAID.
- Reintento con el mismo `paymentId` → `duplicate: true`, cero writes.
- Carrera concurrente (create viola índice único) → `duplicate: true`,
  cero writes sobre la orden.
- Error de BD no-P2002 en el create → se relanza (no se enmascara).
- Pago `rejected` → sin cambios de estado ni filas.
- Notificación sin `data.id` → 400.
- Verificación contra `GET /v1/payments/{id}` (único fetch) — el body nunca
  se confía.
- Preferencia: 503 sin token, 403 pagando pedido ajeno, 400 pedido no
  PENDING.
- Guardia de monto: pago approved por menos del total → fila auditada, orden
  sigue PENDING.
