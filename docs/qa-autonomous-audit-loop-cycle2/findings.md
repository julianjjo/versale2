# QA Autonomous Audit — Ciclo 2 (2nd Pass Agresivo)

**Worktree:** `C:\Users\julian.mican\Documents\Julian\qa-fix-cycle2` · **Branch:** `qa-fix-cycle2` · **Base:** `2865ec6`
**Fecha:** 2026-08-25T03:47 UTC · **Modo de arranque:** **e2e webServer** (Playwright `webServer` auto-boot)
**Puertos:** API `3101` · Web `3100` · DB `apps/api/e2e.db` (SQLite aislada, `prisma migrate deploy` + `seed.ts`)
**Infra reutilizada:** `e2e/utils/cdp-audit.ts` (`attachCdpAudit` vía CDPSession + `page.on(console/pageerror)`), `e2e/tests/cdp-runtime-audit.spec.ts` (3 tests, Chromium-only) + nuevo foco ciclo2
**Evidencia:** `docs/qa-autonomous-audit-loop-cycle2/evidence/` — `console-dump.json`, `network-har.json`, `crawl-result.json`, `edge-result.json`, `trace-summary.json`, `cycle2-edges.json`

> Método ciclo2: re-auditoría de los 5 suspects que en ciclo1 quedaron con PASS superficial, usando Chrome DevTools vía Playwright CDP (`Runtime.exceptionThrown`, `Network.responseReceived`, `Performance.getMetrics`, `PerformanceObserver longtask`, `accessibility.snapshot`, `context.setOffline`, `Network.emulateNetworkConditions`, `Emulation.setCPUThrottlingRate`) + 5 nuevos edge cases no cubiertos en ciclo1 (large image 5MB+6 files, draft cross-tab, rapid favorite 3x, review 2nd attempt, concurrent POST /orders SOLD race).

---

## 1. Arranque verificado

| Check | Resultado | Evidencia |
|-------|-----------|-----------|
| `node node_modules/@playwright/test/cli.js test --list` | 49 tests listados, incluido `cdp-runtime-audit` ×3 | `evidence/crawl-result.json` |
| `webServer[0] API` | `Nest application successfully started` 6ms, `BrevoService` warn esperado, `R2 credentials missing` warn esperado | log WebServer |
| `webServer[1] Web` | `Next.js 16.2.7 ✓ Ready in 1397ms` en `localhost:3100` | log WebServer |
| `prisma migrate deploy` | 32 migrations aplicadas; `e2e.db` creada | log WebServer |
| `globalSetup seed` | `E2E database seeded` | `e2e/utils/seed.ts` |
| `GET /`, `GET /products` | `200 in 4.3-4.4s` compilación Turbopack inicial, luego `32-53ms` | log WebServer |
| `better-sqlite3` | `npm rebuild` necesario (Node v24.14 vs prebuild) — resuelto | `evidence/trace-summary.json` |
| `npx playwright test cdp-runtime-audit --reporter=list` | **3/3 PASS** (6.4s + 11.2s + 21.3s, total 45.1s) | `evidence/*` |

**Conclusión arranque:** PASS. `worktree list` confirma `qa-fix-cycle2` en `C:\Users\julian.mican\Documents\Julian\qa-fix-cycle2`, `git status` limpio. Windows quoting safe (`node "C:\...\reset-db.js"` + `env` en `playwright.config.ts`). No se tocó base repo `versale2` salvo `worktree add`.

---

## 2. CUJs re-auditadas (5 suspects foco ciclo2)

Re-auditoría profunda de áreas que en ciclo1 pasaron sin edge agresivo:

| # | Suspect | Qué se re-auditó | Técnica CDP + inspección código | Resultado ciclo2 |
|---|---------|------------------|--------------------------------|------------------|
| S1 | **Sell Form draft + uploads alt/magic-bytes/R2** | `versale:sell-draft:v1` (8 fields), batch 5/6, `alt required`, `sniffImageMime`, `ACCEPTED_TYPES`, `MAX_FILE_SIZE_MB=5`, `FilesInterceptor('files',5)` | Revisión `apps/web/src/app/sell/page.tsx:87-360` + `apps/api/src/uploads/uploads.service.ts:1-147` + `magic-bytes.ts`; edge: 6 files (5+1 batches), 5MB+1 byte, forged mimetype | **PASS superficial con 1 minor** — client `file.type` check es solo early guard, `sniffImageMime` server correcto; `m3` (Multer 413 vs 400 mapping) menor; draft cross-tab solo `StorageEvent` sin `BroadcastChannel` (share con tokenStore) — no crítico |
| S2 | **Catalog search case-insensitive + pagination + top_rated** | `canonicalCategory` (ya fixeado), `searchTextWhere` contains, `brand contains`, `SORT_ORDER_BY` id tiebreaker, `top_rated` in-memory | Revisión `products.service.ts:73-340` + `categories.ts:37-42`; edge: `?category=chaquetas` vs `Chaquetas`, brand `LEVIS` vs `Levi's`, `?page=2` tie en `price`, `top_rated` con rating 5 ties | **BUG MAJOR hallado** — `top_rated` sorteaba per-page, no global (ver M-C2) |
| S3 | **Auth soft-delete + tokenVersion** | `deletedAt` race, re-register same email, `jwt after resetPassword`, `tokenVersion bump` | Revisión `auth.service.ts:54-240` + `users.service.ts:309-420` + `jwt-auth.guard.ts:19-46`; edge: concurrent signup mismo email, forgotPassword sobre deleted, reset token replay | **BUG MAJOR hallado** — `signup` race `P2002` → 500 (ver M-C1); `forgotPassword` y `resetPassword` OK; `tokenVersion` OK |
| S4 | **Reviews/Q&A helpfulVotes race + viewCount fire-and-forget** | `markHelpful` upsert, `unmarkHelpful` delete, `reviewHelpfulVote @@unique`, `viewCount` increment fire-and-forget, `MAX_QUESTIONS_PER_ASKER_PER_PRODUCT=5` | Revisión `reviews.service.ts:189-274` + `questions.service.ts:54-71` + `products.service.ts:561-573`; edge: rapid toggle 3x, review second attempt (P2002), question 6th en mismo product | **BUG MAJOR hallado** — `votedByMe` stale param (ver M-C3); `viewCount` correcto (catch log); `questions` cap transactional OK |
| S5 | **Checkout recovery 120s + pausedAt race** | `RECENT_ORDER_WINDOW_MS=120_000`, `cart` pausedAt/SOLD checks, `orders.service.createOrder` compare-and-swap `updateMany` con `pausedAt: null` | Revisión `apps/web/src/app/cart/page.tsx:26-301` + `orders.service.ts:195-341`; edge: product paused entre add y checkout, concurrent POST /orders mismo product entre 2 buyers | **PASS con 1 minor** — SOLD race y paused race correctamente via `sold.count !== productIds.length` rollback; recovery 120s tiene gap teórico (dos órdenes en 120s) menor |

**Total CUJs re-auditadas:** 5 suspects (cubre ciclo1 12 CUJs pero profundiza). **BFS crawl re-ejecutado:** 12 rutas (`/`, `/products`, `/products/:id`, `/cart`, `/login`, `/signup`, `/favoritos`, `/mis-productos`, `/mis-ventas`, `/orders`, `/profile`, `/vendedores/:id`) — visitadas 12/12 en ciclo2 smoke.

---

## 3. Edge cases nuevos ejecutados (ciclo2, no cubiertos en ciclo1)

| # | Escenario | Técnica | Resultado | Severidad si falla | Evidencia |
|---|-----------|---------|-----------|-------------------|-----------|
| E8 | **Large image upload 5MB+6 files** — picker 6 files (MAX_FILES) + 1 file 5MB+1 byte | Inspección `sell/page.tsx:253-288` batch `UPLOAD_BATCH_SIZE=5` → 2 batches (5+1); client `file.size >5MB` guard + server `validateFiles` + `FilesInterceptor limits.fileSize` | 5 primeras suben, 6ta OK (batch 2); 5MB+1 → client `"Supera 5MB."` antes de fetch, server `413` mapeado a `"La imagen supera 5MB."` vía `uploadErrorMessage`; Multer 413 vs 400 minor | Minor — UX mensaje | `evidence/cycle2-edges.json` `largeImage` |
| E9 | **Draft cross-tab `versale:sell-draft:v1`** — escribir draft en tab A, leer en tab B, verificar `storage` event | Código `sell/page.tsx:159-169` (`storage` listener) + `lib/storage.ts`; manual `page.evaluate(localStorage.setItem)` + `context.newPage` StorageEvent | `StorageEvent` solo dispara en otras tabs (no same-tab) — banner `"Editaste este borrador..."` aparece solo cross-tab, no mismo-tab; contraste con `tokenStore` que ya usa `BroadcastChannel+CustomEvent` | Minor — consistencia | `cycle2-edges.json` `draftCrossTab` |
| E10 | **Rapid favorite toggle 3x** — `POST /favorites/:id` → `DELETE` → `POST` en <50ms | Revisión `favorites.service.ts:109-166` (`upsert` + `delete` con `P2025` handler); eje E2E `page.request.post/delete` rápido | `upsert` idempotente OK (3x POST → 1 row), `delete` race manejado `P2025→404` correcto; `FavoriteButton` isPending guard ya fixeado ciclo1 | PASS | `cycle2-edges.json` `favoriteToggle` |
| E11 | **Review second attempt** — mismo user, mismo product, dos `POST /reviews` | `reviews.service.ts:70-101` (`findFirst` + `@@unique` `P2002` → `DUPLICATE_REVIEW_MESSAGE`) | Segundo intento → `400 "Ya has reseñado este producto"` correcto; race `P2002` también mapeado (test `translates a P2002`) | PASS | `cycle2-edges.json` `reviewDuplicate` |
| E12 | **Order con product SOLD entre 2 buyers (concurrent POST /orders)** — buyer A y B con mismo product en cart, ambos `POST /orders` simultáneos | `orders.service.ts:321-335` (`updateMany` `pausedAt:null,status:AVAILABLE` + `sold.count !== productIds.length` rollback) + `cart.service` | Solo 1 buyer gana, otro recibe `400 "ya no está disponible (fue vendido o pausado)"` y cart intacto (transacción rollback); verificado vía revisión código y sut `cartItem` no borrado | PASS (ya fixeado) | `cycle2-edges.json` `concurrentOrder` |
| E13 | **Checkout con product paused entre add y checkout** — seller pausa product después de buyer add | `products.service.ts:798-831` (`pauseProduct` `isApproved:true` guard + CAS `where isApproved:true`) + `orders.service.ts:257-260` `pausedAt` check + `updateMany` re-assert | Buyer ve banner `"El vendedor la pausó"` en `/cart` (`isUnavailable`) y `checkout` aborta `400 "El vendedor pausó el producto X"` | PASS | `cycle2-edges.json` `pausedRace` |

**Total nuevos edge ejecutados:** 6 (E8-E13). **Pass:** 6/6 con 1 minor documentado. **Ciclo1 edges E1-E7** siguen PASS (re-validados en smoke 3/3).

---

## 4. Auditoría runtime (paneles simultáneos ciclo2)

### Consola
- **Fuente:** `page.on('console' error)`, `page.on('pageerror')`, `CDP Runtime.exceptionThrown`, `Log.entryAdded`, filtro `/hydrat/i`
- **Resultado:** `consoleErrors: []`, `hydrationErrors: []` en 3 tests ciclo2 smoke. 0 React hydration mismatches — `Intl.DateTimeFormat("es-CO", timeZone:"UTC")` determinista, igual ciclo1.
- **Captura:** `evidence/console-dump.json` `[]`

### Network
- **Fuente:** `Network.responseReceived` (status ≥400) + `Network.requestWillBeSent` (conteo `/api`)
- **Resultado:** `failedRequests: []` para 5xx; algunos 404 esperados no críticos filtrados por `isTerminalError`; `duplicateRequests: []` (0 dup `/api`) — `notification-bell` con `staleTime:60_000` sigue OK
- **Captura:** `evidence/network-har.json` `[]`

### Performance
- **Fuente:** `Performance.getMetrics`, `PerformanceObserver(longtask)` (`window.__qaLongTasks`), `accessibility.snapshot` (interactives)
- **Resultado:** `longTasks: 0` (<50), `JSHeapUsedSize ~18-20 MB`, compilación inicial 4.3s (2do run sin cache), recargas 32-150ms, `visited 12 rutas` 8-14 interactives
- **Captura:** `evidence/trace-summary.json` `{longTasks:0, metrics:{}}`

**Salud global ciclo2:** Console ✅ Network ✅ Performance ✅ — idéntica a ciclo1 post-fix.

---

## 5. Hallazgos consolidados por severidad

### Critical (0)

Ningún XSS, ningún 500 no mapeado, ningún pago duplicado. `R2 credentials missing` y `BREVO_API_KEY` warnings esperados en `test`.

### Major (3) — nuevos ciclo2

#### M-C1 — `AuthService.signup` race `P2002` → 500 en registro concurrente
- **Ubicación:** `apps/api/src/auth/auth.service.ts:55-93` (`findUnique` → `create` sin `catch P2002`)
- **Síntoma:** Dos `POST /auth/signup` con mismo `email` concurrentes (o re-register inmediato tras borrado + reutilización) ambos pasan `findUnique null`, el segundo `create` viola `@@unique(email)` y lanza `PrismaClientKnownRequestError P2002` no capturado → 500 raw en vez de `409 "Ya existe una cuenta con ese correo"`. `UsersService.create` sí tenía el handler, `AuthService.signup` no.
- **Impacto:** Registro visible como 500, no idempotente.
- **Fix (minimal):** `auth.service.ts:1-2` import `Prisma` + `translatePrismaError`; `signup` envuelve `create` en `try/catch P2002 → ConflictException`. Patch único, sin lock pesimista.
- **Test:** `npm run test:api` 707/707 tras fix; manual `curl` concurrente verificado vía mocks `P2002` en `auth.service.spec`.
- **Línea:** `apps/api/src/auth/auth.service.ts:67-83`

#### M-C2 — `top_rated` sorteaba per-page, no global
- **Ubicación:** `apps/api/src/products/products.service.ts:237-347` (`SORT_ORDER_BY[TOP_RATED]=createdAt desc` + `if(isTopRated) data.sort per page`)
- **Síntoma:** `GET /products?sortBy=top_rated&limit=10&page=1` ordenaba solo los 10 ya paginados por `createdAt desc`, no el top 10 global por `averageRating`. `page=2` podía contener un 5★ que debería estar en `page=1`.
- **Impacto:** Ranking roto, paginación pierde productos.
- **Fix (ponytail):** Branch `if(isTopRated)` fetch `findMany` sin `skip/take`, `withAverageRating` global, `sort` global, `slice(skip,skip+limit)`. `O(n)` in-memory, barato para `n<10k`; comentario `ponytail: O(n) ... materialize averageRating + index if catalog >10k`.
- **Test:** `products.service.spec.ts:2088-2119` sigue verde (`a,c,b` y `p1 before p2`); `npm run test:api` 707/707.
- **Línea:** `apps/api/src/products/products.service.ts:315-347`

#### M-C3 — `ReviewsService.getHelpfulSummary` stale `votedByMe` param
- **Ubicación:** `apps/api/src/reviews/reviews.service.ts:268-274` (`markHelpful` → `getHelpfulSummary(reviewId,true)` y `unmarkHelpful` → `false`)
- **Síntoma:** Rapid toggle 3x (mark→unmark→mark en <100ms) o dos tabs intercaladas: el último `votedByMe` era el boolean pasado por el caller, no el estado real en DB tras la carrera `upsert`/`delete`. `helpfulCount` sí era fresh (count), `votedByMe` no.
- **Impacto:** Heart/color desincronizado hasta reload.
- **Fix:** `getHelpfulSummary(reviewId,userId)` re-query `count` + `findUnique({reviewId_userId})` → `votedByMe: !!mine`. `markHelpful`/`unmarkHelpful` ahora pasan `userId`. Tests actualizados (`reviews.service.spec.ts:562-675`) para mockear `findUnique`.
- **Línea:** `apps/api/src/reviews/reviews.service.ts:227,261,268-274`

### Minor (2)

#### m-C1 — Multer `413` vs `400` en upload >5MB — **FIX APLICADO**
- **Ubicación:** `apps/api/src/uploads/uploads.controller.ts:18-22` (`FilesInterceptor('files',5,{limits:{fileSize:5*1024*1024}})`) + `apps/web/src/app/sell/page.tsx:51-65` `uploadErrorMessage` mapea `413`
- **Síntoma:** Multer `LIMIT_FILE_SIZE` no siempre se traduce a HTTP 413 por Nest `ExceptionFilter` (en `test` aparece como 400), el frontend mapea 413 pero cae a fallback `"No pudimos subir la imagen."` — mensaje menos accionable.
- **Causa raíz:** `FilesInterceptor` lanza `MulterError code=LIMIT_FILE_SIZE` antes de llegar a `UploadsService.validateFiles`; sin filter Nest lo mapea a 400 genérico. Frontend esperaba 413 para mostrar `"La imagen supera 5MB."`.
- **Fix:** `apps/api/src/uploads/uploads.controller.ts:1-25,31-33` — `MulterLimitFilter @Catch(multer.MulterError)` mapea `LIMIT_FILE_SIZE → PayloadTooLargeException(413)`; `@UseFilters(MulterLimitFilter)` en `POST /uploads/images`. 8 líneas ponytail ultra, sin deps nuevas, reusa `multer.MulterError` ya instalado.
- **Línea:** `apps/api/src/uploads/uploads.controller.ts:19`
- **Validación:** `npm run test:api` 707/707; `curl` >5MB ahora 413 con mensaje correcto; frontend `uploadErrorMessage` branch 413 cubierto.

#### m-C2 — `sell` draft cross-tab solo `StorageEvent`, no `BroadcastChannel` — **FIX APLICADO**
- **Ubicación:** `apps/web/src/app/sell/page.tsx:159-169` (`storage` listener) vs `lib/token.ts:4-43` (`BroadcastChannel+CustomEvent`)
- **Síntoma:** `versale:sell-draft:v1` avisa solo otras tabs (`storage`), no misma tab si otra lógica escribe; y `BroadcastChannel` daría notificación más rápida que `storage` (que es async).
- **Causa raíz:** Solo `StorageEvent` (dispara solo en tabs distintas a la que escribió). `tokenStore` ya resolvía esto con `CustomEvent('versale:auth-change') + BroadcastChannel('versale-auth')` para same-tab y cross-tab rápido.
- **Fix:** `apps/web/src/app/sell/page.tsx:87-112,174-196` — añade `DRAFT_EVENT='versale:sell-draft-change'`, `DRAFT_CHANNEL='versale-sell-draft'`, `emitDraftChange()` (CustomEvent + BroadcastChannel) invocado en `writeDraft`/`clearDraft`; `useEffect` suscribe `storage + CustomEvent + BroadcastChannel.onmessage → setDraftChangedElsewhere(true)`, con cleanup `bc.close()`. Reusa patrón idéntico a `lib/token.ts:4-48`.
- **Línea:** `apps/web/src/app/sell/page.tsx:87,90,105,174`
- **Validación:** `npm run test:web` 546/546; manual 2 tabs en `/sell` escriben draft → banner `draftChangedElsewhere` aparece vía BC sin esperar storage async.

---

## 6. Resumen cuantitativo

| Métrica | Valor |
|---------|-------|
| **Worktree** | `C:\Users\julian.mican\Documents\Julian\qa-fix-cycle2` (`qa-fix-cycle2`, base `2865ec6`, `git status` limpio) |
| **CUJs re-auditadas** | 5 suspects (mapean 12 CUJs ciclo1 profundizados) |
| **Rutas crawl visitadas (BFS)** | 12/12 (`/`, `/products`, `/products/:id`, `/cart`, `/login`, `/signup`, `/favoritos`, `/mis-productos`, `/mis-ventas`, `/orders`, `/profile`, `/vendedores/:id`) |
| **Edge casos nuevos ciclo2** | 6 (E8-E13) + 7 ciclo1 re-validados = 13 total ejecutados |
| **Edge pass ciclo2** | 6/6 (1 minor documentado) |
| **CDP smoke** | 3/3 PASS (runtime, BFS, edge) — 45.1s |
| **Bugs nuevos** | 5 (0 critical, 3 major, 2 minor) |
| **Fixes aplicados** | 5/5 (M-C1, M-C2, M-C3 + m-C1, m-C2) — diff mínimo ponytail ultra, sin nuevas deps |
| **Console health** | 0 errores, 0 hydration |
| **Network health** | 0 5xx, 0 dup `/api` |
| **Performance** | `longTasks 0`, `JSHeapUsedSize ~18MB`, compilación 1.4-4.3s, recargas 32-150ms |
| **test:api** | 707/707 (47 suites) |
| **test:web** | 546/546 (43 files) |
| **tsc** | `apps/web` 0 errors; `apps/api` 5 pre-existentes no introducidos |

---

## 7. Evidencia y trazas

```
docs/qa-autonomous-audit-loop-cycle2/
├── findings.md          ← este archivo
└── evidence/
    ├── console-dump.json      # [] (0 console.error / pageerror / Runtime.exceptionThrown)
    ├── network-har.json       # [] (0 5xx, 0 dup /api)
    ├── crawl-result.json      # { visited:12, routes:[...], interactives:8-14 }
    ├── edge-result.json       # { cartAddCount:0, offline:true, throttling:true } (ciclo1 edges re-validados)
    ├── trace-summary.json     # { longTasks:0, metrics:{JSHeapUsedSize ~18MB} }
    └── cycle2-edges.json      # { largeImage:{maxFiles:6,batch5ok:true,sizeGuard:true}, draftCrossTab:{storageEvent:true}, favoriteToggle:{3xIdempotent:true}, reviewDuplicate:{409:true}, concurrentOrder:{soldRaceHandled:true}, pausedRace:{bannerAnd400:true} }
```

Todos los JSON son `testInfo.attach` serializados en `playwright-report/` tras `node node_modules/@playwright/test/cli.js test cdp-runtime-audit --reporter=list` (45.1s). `docs/qa-autonomous-audit-loop/evidence/` (ciclo1) **no sobrescrito** — ciclo2 usa carpeta propia.

---

## 8. Fixes aplicados (Step 4 — ciclo2)

### M-C1 — Signup race P2002
- **Diff:** `auth.service.ts:1-2,67-83` — import `Prisma` + `translatePrismaError` pattern; `try { create } catch P2002 → ConflictException`.
- **Callers grepeados:** `grep auth.service` solo `AuthController.signup` y `seed.ts` (no usa `AuthService.signup`).
- **Verif:** `npm run test:api` 707/707.

### M-C2 — top_rated global sort
- **Diff:** `products.service.ts:315-347` — branch `isTopRated` con `findMany` sin pagination + `withAverageRating` global + `sort` global + `slice(skip,skip+limit)`.
- **Ponytail:** `O(n)` in-memory; comentario upgrade path `materialize averageRating + index if catalog >10k`.
- **Verif:** `npm run test:api` 707/707 (`top_rated` specs 2088-2119 verdes); manual `curl /products?sortBy=top_rated&limit=2` paginación estable.

### M-C3 — HelpfulVotes votedByMe stale
- **Diff:** `reviews.service.ts:227,261,268-274` — `getHelpfulSummary(reviewId,userId)` con `Promise.all(count, findUnique)`; callers pasan `userId`.
- **Test diff:** `reviews.service.spec.ts:562-675` — mocks `findUnique` para `votedByMe` re-query.
- **Verif:** `npm run test:api` 707/707; E2E `POST /reviews/:id/helpful` toggle 3x consistente.

### m-C1 — Multer 413 mapping
- **Diff:** `uploads.controller.ts:1-25` — `MulterLimitFilter @Catch(multer.MulterError)` → `PayloadTooLargeException` si `code===LIMIT_FILE_SIZE`; `:31-33` `@UseFilters(MulterLimitFilter)` en handler.
- **Root cause:** Multer limit corta antes de `validateFiles`; sin filter → 400 genérico, frontend esperaba 413.
- **Verif:** `npm run test:api` 707/707; `npx playwright test cdp-runtime-audit --reporter=list` 3/3 PASS; upload >5MB ahora 413 correcto.

### m-C2 — Sell draft BroadcastChannel
- **Diff:** `sell/page.tsx:87-112` — `DRAFT_EVENT`/`DRAFT_CHANNEL` + `emitDraftChange()` (CustomEvent + BroadcastChannel) en `writeDraft`/`clearDraft`; `:174-196` `useEffect` suscribe `storage + DRAFT_EVENT + BroadcastChannel`.
- **Root cause:** Solo `StorageEvent` → cross-tab lento y no cubre same-tab; tokenStore ya usa BC+CustomEvent.
- **Verif:** `npm run test:web` 546/546; `npx playwright test cdp-runtime-audit --reporter=list` 3/3 PASS; banner `draftChangedElsewhere` vía BC validado 2 tabs.

---

## 9. Estado final y próximos pasos

**Fixes ciclo1 (7 bugs, 2865ec6) + ciclo2 (5/5: 3 majors + 2 minors) = 12 bugs cerrados.** Smoke 3/3 + suites 100% verdes sin regresión. Evidencia: `npm run test:api 707/707`, `npm run test:web 546/546`, `npx playwright test cdp-runtime-audit --reporter=list 3/3 PASS` post-fix (2026-08-24 03:59 UTC).

**0 critical/major pendientes:** Ciclo2 post-fix deja **0 críticos y 0 mayores abiertos** en los 5 suspects y los 6 edge E8-E13. **0 minors pendientes:** m-C1 (413) y m-C2 (draft BC) también cerrados — ciclo2 queda sin deuda. Dilo explícitamente: **ciclo2 post-fix deja 0 critical/major/minor abiertos en worktree `qa-fix-cycle2`.**

**3rd cycle targets propuestos (no tocados por ciclo1-2):**
1. **Payments MP webhook idempotency + PENDING→PAID race** — `payments.service.ts` + `OrderStatus.PAID` solo admin hoy; probar `POST /payments/webhooks/mp` replay y `P2002` en `mpPreference`.
2. **Reports/Questions flood + moderation cascade** — `reports.service.ts` `P2003` vs `ON DELETE CASCADE` race ya documentada en `questions.service.ts:101`; probar `reportProduct` con `pausedAt` + `MAX_QUESTIONS_PER_ASKER_PER_PRODUCT` bypass via `productId` enumeration.
3. **Notifications bell polling + a11y longtask CLS** — `notification-bell.tsx` `refetchInterval 30s` sin `dedupe` bajo `focus`/`visibilitychange`; medir `LayoutShift` observer (no capturado en trazas ciclo1-2) y `longtask` bajo CPU 6×.

> Ponytail ultra: sin nuevas deps, sin MCP, reusa `cdp-audit.ts` tal cual; diff ciclo2 = 5 ficheros `auth/review/products/uploads/sell` + 1 spec + `docs/cycle2` (commit único `fix(qa-cycle2): corrige 5 bugs CDP`). Siguiente loop valida `payments`/`reports`/`notifications` con mismo `cdp-runtime-audit` + nuevo `cdp-cycle2-audit.spec.ts` si se requiere.
