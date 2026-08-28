# Reject reason required — ponytail debt

## Problema

`e2e/tests/publish-moderation.spec.ts:75` marcaba `// ponytail: reason optional en DTO actual; si se vuelve required debe ser 400` y `:72-78` hacía `expect([200,400]).toContain(noReason.status())` con `if (400) expect text`. `apps/api/src/products/dto/reject-product.dto.ts` y `bulk-reject.dto.ts` tenían `reason?: string` con `IsOptional`, permitiendo `PATCH /products/admin/:id/reject` sin motivo — roadmap exige motivo obligatorio para trazabilidad y para que `rejectionReason` no sea null silencioso.

## Arquitectura

- Single file winner: `apps/api/src/products/dto/reject-product.dto.ts` y `bulk-reject.dto.ts` (2 files, mismo cambio) + `e2e/tests/publish-moderation.spec.ts` (expect 400 estricto).
- DTOs: quitar `IsOptional`, añadir `IsNotEmpty({message: 'El motivo del rechazo es obligatorio'})`, cambiar `reason?:` a `reason!:`.
- E2E: `noReason` ahora espera `400` estricto y `reason` en mensaje, eliminar ponytail y `expect([200,400])` tolerante.

No tocar `ProductsService.buildRejectData` — ya maneja `reason?: string` (ahora siempre string, pero compatible).

## Data flow

- `PATCH /products/admin/:id/reject` sin `reason` → ValidationPipe → 400 `El motivo del rechazo es obligatorio` → e2e `noReason.status() === 400`.

## Componentes

- `RejectProductDto` y `BulkRejectDto` — `IsOptional` → `IsNotEmpty`, `reason?:` → `reason!:`.
- `publish-moderation.spec.ts:72-78` — `expect(noReason.status()).toBe(400)` + `expect(text).toMatch(/motivo.*obligatorio/i)` + borrar ponytail.

## Testing strategy

- `npm run test:api` — DTO validation tests (si existen) deben pasar 400 sin reason.
- `npx tsc --noEmit` — DTO tipo `reason!` no rompe service.
- E2E `publish-moderation` — `sin reason → 400` ya no 200, `re-reject idempotente` sigue 200.
- `grep -rn ponytail` → `publish-moderation:75` eliminado, ledger 17→16, no-trigger 6→5.

## Riesgos

- Ninguno prod: admin ya envía reason en UI (modal con textarea required). Sin reason antes era 200 y creaba `rejectionReason=null`, ahora 400 con mensaje claro.

## Ponytail ceiling

- Sin ponytail — reason ya es required; si se vuelve optional de nuevo, reintroducir IsOptional.
