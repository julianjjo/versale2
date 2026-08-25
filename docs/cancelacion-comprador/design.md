# Cancelación del comprador — Design

## Objetivo
Permitir que el comprador cancele su propio pedido PENDING/PAID via `PATCH /orders/:id/cancel`.

## Arquitectura
- Servicio: `OrdersService.cancelOwnOrder(userId, id)` — `findUnique` → 404 si no existe, 403 si `order.userId !== userId`, delega a `transitionStatus(order, CANCELLED)` que valida `ALLOWED_STATUS_TRANSITIONS` (PENDING|PAID → CANCELLED) y hace CAS `update({where:{id,status:current}, data:{status:CANCELLED}})`. Si cancela, `$transaction` relista productos SOLD→AVAILABLE y notifica vendedores via `notifySellersOfCancellation` (deduplicado por sellerId, `createMany`).
- Reutiliza `OrderStatus` enum, `NotificationType.ORDER_CANCELLED`. Sin migración. Sin reembolso, sin email (Brevo no-op), sin ventana extra más allá del check de estado.
- Controller: `@Patch(':id/cancel')` en `OrdersController` (guard `JwtAuthGuard` a nivel clase) → `cancelOwnOrder(req.user.id, id)`. Ruta declarada antes de `admin/*` y `mine/sales/*`; no colisiona con `:id` por ser `:id/cancel` (2 segmentos vs 1).

## Data flow
```
Web: orders/[id]/page.tsx  --PATCH /orders/:id/cancel-->  Controller  -->  Service.cancelOwnOrder  -->  Prisma
     confirm() → api.patch → queryClient.invalidateQueries([order, orders, admin-*, products, product]) → badge CANCELLED
```

## Componentes
- **API**: `apps/api/src/orders/orders.service.ts` (cancelOwnOrder, transitionStatus, notifySellersOfCancellation), `apps/api/src/orders/orders.controller.ts` (PATCH :id/cancel).
- **Web**: `apps/web/src/app/orders/[id]/page.tsx` — `canCancel = userId===owner && nextStatusesFor(status).includes(CANCELLED)` → Button `variant="danger"` "Cancelar pedido" → `confirm()` → `api.patch(...)` → estados `cancelSuccess`/`cancelError` con `role="alert|status"` y mensajes en español.

## Contrato API
- `PATCH /orders/:id/cancel` — Auth: JWT. Req: sin body. Res: `Order` con `status=CANCELLED`. Errores: 404 no existe, 403 otro dueño, 400 transición ilegal o conflicto CAS ("Este pedido cambió de estado...").

## Testing
- Service unit (`__tests__/orders.service.spec.ts`): 8 casos cancelOwnOrder — PENDING→CANCELLED relista, PAID→CANCELLED, dedup vendedores, conflicto CAS, 403 otro dueño, 400 SHIPPED, 400 doble cancel, 404.
- Controller (`__tests__/orders.controller.spec.ts`): delega `cancelOwnOrder(req.user.id, id)`, ruteo `:id/cancel` no colisiona con `mine/sales/:id/ship`.
- Web (`apps/web/.../order-detail-page.test.tsx`): botón visible PENDING/PAID+owner, oculto SHIPPED/CANCELLED/otro usuario, flujo confirm→patch, success→mensaje+botón desaparece, error→role alert, conflicto→refetch y botón desaparece.
- E2E: reutiliza flujo existente orders.

## Review multi-ángulo
- **Seguridad**: ownership check explícito antes de transición, guard JWT, CAS evita TOCTOU (admin ship vs buyer cancel).
- **Performance**: 1 findUnique + 1 update (o tx con 2 writes si libera prendas), usa `@@index(userId,createdAt)` existente.
- **A11y**: confirm nativo, mensajes `role="alert"`/`role="status"`, labels en español, botón `disabled` durante `isPending`.
- **Ponytail**: sin DTO nuevo, sin migración, sin lib, `confirm()` en vez de Modal, reutiliza `transitionStatus`/`nextStatusesFor`.
