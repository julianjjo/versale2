# Moderación manual (ítem 6)

> Hito 1, ítem 6 de `docs/todo-implementacion.md` / decisión cerrada 1.7 de
> `docs/funcionalidades-propuestas.md`: **todo manual** mientras sea 1 dev;
> revisar auto-aprobación cuando exista verificación de email real (bloque 3.2).

## Estado

La funcionalidad vive en `apps/web/src/app/admin/products/page.tsx` y en los
endpoints admin de `products.controller.ts`. Este documento la especifica y
fija su contrato de pruebas.

## Grilla admin (`/admin/products`)

- Lista con paginación real (`Pager`, 20 por página, contadores por bucket
  pendientes/aprobados/rechazados) — el "lazy load" del roadmap: las páginas
  se traen on-demand, no la tabla completa.
- Miniaturas con `loading="lazy" decoding="async"` desde el segundo card.
- Acciones por fila: Aprobar / Rechazar / Eliminar, con reglas de elegibilidad
  espejo del backend (nunca sobre `SOLD`; ya rechazada no se rechaza otra vez).
- Selección en lote con Aprobar/Rechazar seleccionadas, mismo techo de 200 ids
  que `bulk-reject.dto.ts`.
- El motivo del rechazo guardado se muestra en la fila ("Motivo del rechazo:
  …") — un rechazo silencioso es un vendedor perdido.

## Rechazo con motivo

- Endpoint: `PATCH /products/admin/:id/reject` con body `{ reason? }`
  (`RejectProductDto`: string opcional ≤500). También
  `PATCH /products/admin/bulk-reject` para el lote.
- `ProductsService.rejectProduct` persiste `isApproved: false`,
  `rejectedAt: now`, `rejectionReason: reason ?? null` sobre productos no
  vendidos.
- El motivo viaja al vendedor por `GET /products/mine` (banda "Rechazado" +
  motivo, regla cerrada del ítem 2) y queda visible en la grilla admin.

## Pruebas (contrato Done-when: el PATCH guarda y expone el motivo)

- API controller (`products.controller.spec.ts`): PATCH pasa el `reason` al
  servicio y responde con `rejectionReason`.
- API service (`products.service.spec.ts`): 'should reject a product with a
  reason' verifica el `update` con `data.rejectionReason` y que el resultado
  lo expone; 'without a reason' fija `null`.
- Web admin grid (`admin-products.test.tsx`): 'expone el motivo del rechazo
  guardado por el PATCH' — la fila muestra el motivo persistido.
- Web vendedor (`mis-productos.test.tsx`): la banda muestra el motivo al
  dueño del listing.
