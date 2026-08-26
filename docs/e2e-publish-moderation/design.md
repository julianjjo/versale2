# E2E: Publicación y moderación — pending, reject, bulk, pause, límite

## Objetivo
Cubrir gap P1: invisibilidad PENDING, approve/reject(+reason), bulk, pause/unpause, 403 edición ajena, bloqueo SOLD, límite 20 (429), filtro categoría. `author-admin` solo cubría approve simple.

## Arquitectura
- Playwright serial (`mode:serial`), `e2e/tests/publish-moderation.spec.ts` ~250L, sin nuevas deps.
- API directa (`/products`, `/products/mine`, `/products/admin/all`, `/admin/:id/approve|reject`, `bulk-approve|reject`, `/:id/pause|unpause`, `bulk-pause|unpause`, `GET /products?search|category`) — determinista, evita UI copy español salvo validación DTO.
- Reusa `purchasable.ts` (`API_URL`, `createBuyer`, `getToken`, `E2E_USERS`, `E2E_SHIPPING_ADDRESS`, `hdr` pattern) + `login` local; `worktree isolation`.
- `// ponytail: 20× loop O(n) serial, fast API; global lock not needed`.

## Flujo
seller POST → PENDING invisible en GET /products?search=, visible en /mine (PENDING) y /admin/all → admin PATCH approve→visible / reject{reason}→REJECTED+reason, 400 sin reason → bulk approve/reject 2× → approve→pause→not public/mine PAUSED→unpause→visible + bulk 2× + 403 pause ajeno → edit own pending 200, 403 ajeno, SOLD(purchasable→cart→order)→edit 400 → crear 20→21st 429, pause1→21st 200 → GET ?category=Chaquetas solo esa, POST categoría inválida 400.

## Testing
- 8 tests serial, sufijos únicos, buyers efímeros para aislamiento.
- Asserts: status codes + `data[]`/`meta.total` + `rejectionReason` + `isApproved/pausedAt` + 403/400/429.
- Si falla: fix `products.service.ts`/`controller.ts` (DTO required reason, guards) y re-run workers=1.
- `npm run test:api` + `test:web` sin regresión.
<!-- ponytail: ultra-minimal 20L, sin infra, reuse purchasable helpers -->
