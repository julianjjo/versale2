# Disputas y reembolsos (ítem 12)

> Hito 1, ítem 12 de `docs/todo-implementacion.md` / decisiones cerradas 2.2
> (+ 2.1 se redacta sobre este mecanismo, no se construyen dos).

## Reglas cerradas (roadmap)

- **7 días**: pago `PAID` sin envío → reembolso automático (vendedor
  desaparecido). Única transición automática que mueve dinero.
- **48 horas** desde `DELIVERED`: ventana del comprador para disputar.
- **Una sola disputa por orden**, para siempre (`disputedAt` permanece tras
  la resolución — el histórico sella el anti-abuso).
- **Fotos obligatorias** (1–6) como evidencia; reutilizan `/uploads/images`,
  que ya valida magic bytes (ítem 9).
- **30 días**: disputa sin resolución → reembolso automático al comprador
  (último recurso). Toda disputa abierta requiere resolución humana o
  expiración; nada más mueve dinero solo.

## Estados y máquina

`OrderStatus` suma `DISPUTED` y `REFUNDED`. Transiciones nuevas:

| Desde | Hacia | Quién |
|---|---|---|
| DELIVERED | DISPUTED | comprador (ventana 48h, una vez) |
| DISPUTED | REFUNDED | admin (a favor del comprador) o cron de expiración |
| DISPUTED | DELIVERED | admin rechaza la disputa |
| PAID | REFUNDED | cron del timeout de 7 días |

`REFUNDED` libera las prendas igual que `CANCELLED` (vuelven a `AVAILABLE`).
Es terminal. La extensión de la compra verificada no cambia: un pedido
reembolsado ya no cuenta entre los estados que acreditan compra.

## Columnas nuevas en `Order`

`paidAt`, `deliveredAt`, `disputedAt`, `disputeExpiresAt`,
`disputeResolvedAt`, `disputeReason`, `disputePhotos` (JSON
`[{url, alt}]`) + índices `(status, paidAt)` y
`(status, disputeExpiresAt)` para los barridos.

## Cron

`@nestjs/schedule` (`ScheduleModule.forRoot()`). `OrdersService` corre cada
hora (`runOrderDeadlineSweeps`):

1. `autoRefundUnshippedPaidOrders()`: `PAID` con `paidAt ≤ now − 7d` →
   `REFUNDED` + notificación + relistado. Un fallo puntual no aborta el
   barrido.
2. `autoResolveExpiredDisputes()`: `DISPUTED` con `disputeExpiresAt ≤ now` →
   `REFUNDED` + `disputeResolvedAt`.

Ambos métodos son públicos y testables directamente con fechas simuladas en
los mocks.

## Endpoints

- `POST /orders/:id/dispute` (comprador dueño): `{ reason (20–1000), photos
  (1–6 URLs del bucket R2) }`.
- Resolución por admin: `PATCH /orders/admin/:id/status` (el endpoint
  genérico ya cableado en la grilla admin) moviendo `DISPUTED → REFUNDED`
  o `→ DELIVERED`; `transitionStatus` sella `disputeResolvedAt` al salir de
  `DISPUTED` — admin y cron comparten el mismo camino y el mismo sello.

## UI

- Labels/badges/timeline nuevos: «En disputa» (warning), «Reembolsado»
  (danger) + textos de reassurance.
- Detalle del pedido (comprador): tarjeta "¿Algo salió mal?" dentro de la
  ventana, con motivo + subida de fotos vía `/uploads/images`; estado de la
  disputa (en revisión/resuelta + motivo declarado) visible para comprador
  y admin.

## Pruebas (contrato Done-when: 7d / 48h / 30d)

- **Timeout 7d**: 'reembolsa pedidos PAID con paidAt de más de 7 días' —
  verifica el corte exacto del sweep (~7 días), `REFUNDED`, relistado y
  notificación; 'no toca pedidos PAID dentro de los 7 días'.
- **Ventana 48h**: 'acepta una disputa dentro de las 48h' / 'rechaza una
  disputa fuera de la ventana de 48h'; además una-por-orden, fotos
  obligatorias y pedido ajeno.
- **Expiración 30d**: 'reembolsa al comprador cuando la disputa vence sin
  resolución' + 'deja intactas las disputas aún dentro de los 30 días';
  resolución admin sella `disputeResolvedAt`.
