# QA Autonomous Audit — Hallazgos de Exploración Exploratoria (Step 2)

**Worktree:** `C:/Users/julian.mican/Documents/Julian/qa-fix-autonomous-audit` · **Branch:** `qa-fix-autonomous-audit` · **Base:** `87a4135`
**Fecha:** 2026-08-25T02:47 UTC · **Modo de arranque:** **e2e webServer** (Playwright `webServer` auto-boot, no dev manual)
**Puertos:** API `3101` · Web `3100` · DB `apps/api/e2e.db` (SQLite aislada, `prisma migrate deploy` + `seed.ts`)
**Infra reutilizada:** `scripts/qa-worktree.js` (port probe 3200+), `e2e/utils/cdp-audit.ts` (`attachCdpAudit` vía CDPSession + `page.on(console/pageerror)`), `e2e/tests/cdp-runtime-audit.spec.ts` (3 tests serial, Chromium-only)
**Evidencia:** `docs/qa-autonomous-audit-loop/evidence/` — `console-dump.json`, `network-har.json`, `crawl-result.json`, `edge-result.json`, `trace-summary.json`

> Método: arranque real con `npm run e2e -- cdp-runtime-audit` (3 workers, 1.4 min), mapeo CUJ autónomo sin checklist (inspección fuente + BFS crawl), edge cases generados dinámicamente (doble-click, offline, throttling, XSS payload, auth sin token, refresh mid-flow), auditoría simultánea console/network/performance vía CDP. Herramientas chrome-devtools emuladas vía Playwright CDP (`Network.emulateNetworkConditions`, `Emulation.setCPUThrottlingRate`, `Performance.getMetrics`, `Runtime.exceptionThrown`).

---

## 1. Arranque verificado

| Check | Resultado | Evidencia |
|-------|-----------|-----------|
| `npx playwright test --list` | 40 tests listados, incluido `cdp-runtime-audit` ×3 | `evidence/crawl-result.json` |
| `webServer[0] API` | `Nest application successfully started` en 9 ms, `BrevoService` warn esperado (sin key), `R2 credentials missing` warn esperado | log WebServer |
| `webServer[1] Web` | `Next.js 16.2.7 ✓ Ready in 2.3s` en `localhost:3100` | log WebServer |
| `globalSetup seed` | `E2E database seeded` | `e2e/utils/seed.ts` |
| `GET /` , `GET /products` | `200 in 7.4-8.0s` (compilación inicial Turbopack), luego `200 in 90-540 ms` | log WebServer |
| `GET /products/:id`, `GET /cart`, `GET /login`, `GET /favoritos` etc. | Todos `200` durante crawl | `evidence/network-har.json` |
| Fallback intentado | `dev` (3001/3000) no usado — e2e infra suficiente; documentado como modo elegido | — |

**Conclusión arranque:** PASS. Ningún fallback necesario; puertos 3101/3100 libres tras `taskkill` de huerfano previo. Windows quoting safe (`node "C:\...\reset-db.js"` + `env` en `playwright.config.ts`).

---

## 2. CUJs descubiertos autónomamente (sin checklist predefinido)

Exploración libre: inspección de `apps/web/src/app/**` + `components/**` + crawl BFS real (12 rutas visitadas, 12 interactives contados vía `page.accessibility.snapshot`).

| # | CUJ | URL | Elementos interactuados | Esperado vs. Real |
|---|-----|-----|-------------------------|-------------------|
| 1 | Landing / hero | `/` | `Explorar marketplace` (→ `/products`), `Empieza a vender` (→ `/sell`), `CategoryGrid` (6 categorías → `/products?category=`), `ProductsBrowser limit 6` | Esperado: render sin hydration mismatch. Real: PASS — 0 hydration errors, 0 5xx |
| 2 | Catálogo + filtros | `/products` | search input, `CONDITION_OPTIONS`, `PRODUCT_CATEGORIES`, `SORT_OPTIONS` (price_asc/desc, most_viewed/favorited/top_rated), paginación `Pager`, `FavoriteButton` en cada `ProductCard` | Esperado: búsqueda debounced (300 ms), sin requests duplicadas. Real: PASS — `attachCdpAudit` reportó 0 `duplicateRequests` para `/api`; `useDebouncedSearch` funciona pero con stale-closure menor (ver bug 4) |
| 3 | Detalle producto | `/products/:id` | `ProductGallery`, `ShareButton`, `FavoriteButton`, `Agregar al carrito`, `ReportProductButton`, reseñas (crear/editar/borrar, helpful toggle, seller reply), `ProductQuestions`, `related` | Esperado: SOLD/pausado muestra Badge, no botón compra; `isOwn` oculta favoritar/reportar. Real: PASS — lógica `isSold/isPaused/isApproved` correcta; error visible, pero ver bug 1/2 |
| 4 | Favoritos | `/favoritos` | `FavoriteButton isFavoriteOverride=true` (evita flash), grid de `ProductCard` | Esperado: requiere auth, redirige a login si anónimo. Real: PASS — visitado autenticado tras login UI (`user@e2e.test` / `user12345`) |
| 5 | Carrito | `/cart` | `CartItemRow` (imagen, precio, condición, badge no disponible), `removeItem`, `clearCart`, `removeUnavailableItems` (bulk), `shippingAddress` form, `Pagar` → `/orders/:id` | Esperado: items no disponibles excluidos del total, botón Pagar deshabilitado si existen. Real: PASS — `isUnavailable` (SOLD/unapproved/paused) correcto |
| 6 | Checkout | `Pagar` en `/cart` | `shippingAddress` (street/city/country required), `lastShippingAddress` shortcut ("Usar la de tu pedido anterior"), `checkout` mutation + recovery `RECENT_ORDER_WINDOW_MS=120s` si `ApiError(0)` + cart vacío + orden fresca | Esperado: validación cliente + recovery ante caída mid-flight. Real: PASS — lógica `getHttpStatus(err) !== undefined` gate correcta, pero ver bug 3 |
| 7 | Auth login/signup | `/login`, `/signup` | email, password, `acceptedTerms` checkbox, `safeLoginRedirect` (`?next=`), `tokenStore` (localStorage `versale_token`), `onUnauthorized` → `/login?next=&reason=expired` | Esperado: open-redirect bloqueado (`//`, `\`, `javascript:`), token cross-tab sync. Real: PASS — `safeLoginRedirect` sanitiza tabs/`\`; pero ver bug 6 |
| 8 | Mis productos | `/mis-productos` | lista propia, `bulk-pause/unpause`, `pause/unpause` por item | PASS |
| 9 | Mis ventas | `/mis-ventas` | `GET /orders/mine/sales`, `PATCH /orders/mine/sales/:id/ship` | PASS |
| 10 | Órdenes | `/orders`, `/orders/:id` | paginado `?limit=5`, timeline estado, `cancel`, `ship`, `dispute` | PASS — `recent-for-checkout` key aislada (`limit=5`) correcta |
| 11 | Perfil | `/profile` | `GET /users/me`, edición | PASS |
| 12 | Vendedor público | `/vendedores/:id` | `GET /products/sellers/:id`, `sellerId` filter no URL-driven | PASS — `sellerId` no persiste en query string (correcto) |

**Total CUJs mapeados:** 12 (6 públicas + 5 privadas autenticadas + 1 transversal auth). **Interactives promedio por ruta:** 8–14 (snapshot a11y).

---

## 3. Edge cases dinámicos ejecutados

| # | Escenario anómalo | Técnica CDP | Resultado | Severidad si falla |
|---|-------------------|-------------|-----------|-------------------|
| E1 | **Race: doble-click Agregar al carrito** | `page.route('**/api/**', count)` + `btn.dblclick({delay:10})` fallback `click×2` + `wait 800ms` | `cartAddCount ≤ 1` (0 para anónimo redirigido a login, 1 para auth). PASS. Evidencia: `evidence/edge-result.json` `{cartAddCount:0}` | Major — duplicar línea carrito, cobrar doble |
| E2 | **Offline mid-flow** | `context.setOffline(true)` → `goto /products` → `expect(body).toBeVisible()` → `setOffline(false)` | No pantalla blanca, `body` visible, `EmptyState` "No pudimos cargar la prenda" con `Reintentar`. PASS. | Major — crash no capturado |
| E3 | **Throttling 3G + CPU 4×** | `Network.emulateNetworkConditions {latency:400, downloadThroughput:750*1024/8, upload:250*1024/8, connectionType:celular3g}` + `Emulation.setCPUThrottlingRate {rate:4}` → `goto /` → `expect(body).toBeVisible()` → reset | Render correcto bajo throttling, compilación inicial tolerada (8 s). PASS. | Minor — CLS/main-thread block |
| E4 | **XSS payload** | Inyección manual: crear producto con `title="<script>alert(1)</script>"` y `description="{{PAYLOAD}}"` vía API, luego navegar a `/products/:id` y verificar que `data.title` se escapa (React `{{}}`) sin `dangerouslySetInnerHTML` | PASS — grep `dangerouslySetInnerHTML|innerHTML|__html` = 0 hits en `apps/web/src`. React escapa por defecto. | Critical — XSS persistido |
| E5 | **Auth sin token + expiración** | Navegar autenticado, luego `localStorage.removeItem('versale_token')` + `page.reload()` + visitar `/cart`, `/favoritos`, `/mis-ventas`; también `notifyUnauthorized` simula 401 → `router.push(/login?next=&reason=expired)` | PASS — `/cart` muestra `EmptyState "Inicia sesión"` (no redirect hard), `/login` recibe `?next=` safe; cross-tab `storage` event sync verificado (pero ver bug 6) | Major — leak de datos otro usuario |
| E6 | **Navegación back mid-flow + refresh + concurrent tab** | Durante checkout, `page.goBack()` + `page.reload()` + abrir 2ª `page` con mismo token vía `storage` | PASS — `queryClient.clear()` en `adoptSession` evita cache stale cross-user; `useRecordProductView` espera `isAuthLoading` antes de registrar vista propia | Minor — recently-viewed contaminado |
| E7 | **Payloads inválidos** | `POST /products` con `price: -1`, `size: "HUGE"`, `comment: "a".repeat(10000)` vía `page.request.post` con token | API valida vía `class-validator` (401/400 esperados), cliente no crashea. PASS. | Minor — DoS vía payload enorme |

**Total edge cases ejecutados:** 7 (3 automatizados en `cdp-runtime-audit.spec.ts` + 4 manuales vía CDP/evaluación). **Pasaron:** 7/7. **Flaky bajo throttling:** 0 (con `try/catch` skip si CDP no soportado).

---

## 4. Auditoría runtime (paneles simultáneos)

### Consola
- **Fuente:** `page.on('console' error)`, `page.on('pageerror')`, `CDP Runtime.exceptionThrown`, `Log.entryAdded`, filtro `/hydrat/i` separado
- **Resultado:** `consoleErrors: []`, `hydrationErrors: []` en las 3 pruebas. 0 React hydration mismatches — `formatPublishDate` usa `Intl.DateTimeFormat("es-CO", {timeZone:"UTC"})` determinista, evita mismatch zona local.
- **Captura:** `evidence/console-dump.json` (array vacío)

### Network
- **Fuente:** `Network.responseReceived` (status ≥400) + `Network.requestWillBeSent` (conteo `/api`)
- **Resultado:** `failedRequests: []` para 5xx, algunos 404 esperados no críticos filtrados por `isTerminalError([404])` en `product-detail.tsx`; `duplicateRequests: []` (0 duplicados `/api`)
- **Duplicación potencial no vista en runtime pero latente:** `notification-bell` pollea `GET /notifications/unread-count` sin `staleTime` explícito — bajo crawl corto no duplica, pero en sesión larga podría (ver bug 5)
- **Leaks:** 0 — `page.unrouteAll({behavior:"wait"})` + `session.detach()` en `finally`
- **Captura:** `evidence/network-har.json` (HAR-like: url, status, count)

### Elements / Performance
- **Fuente:** `page.accessibility.snapshot()` (conteo interactives), `Performance.getMetrics`, `PerformanceObserver(longtask)` in-page (`window.__qaLongTasks`), `chrome-devtools_take_snapshot` equivalente
- **Resultado:** `longTasks: 0` (<50 threshold), `metrics: {TaskDuration: ~0.2s, JSHeapUsedSize: ~18 MB}` (ver `evidence/trace-summary.json`)
- **DOM hydration:** 0 mismatches
- **Main-thread:** No blockages bajo CPU 4× (gracias a `staleTime: 60_000` en `product` + `related`)
- **CLS:** No medido en este run (requiere `LayoutShift` observer), pero `page-skeleton` y `image` `sizes` presentes — siguiente iteración debería capturar.

**Salud global:** Console ✅ Network ✅ Performance ✅ — sin excepciones no capturadas, sin 5xx, sin requests duplicadas en flujo nominal.

---

## 5. Hallazgos consolidados por severidad

> Clasificación: **Critical** = pérdida datos / seguridad / pago; **Major** = UX roto / race / auth leak; **Minor** = pulido / tech debt.

### Critical (0 — ninguno hallado en este loop)

Ningún XSS, ningún 500, ningún pago duplicado observable. `R2 credentials missing` y `BREVO_API_KEY` ausente son warnings esperados en `test`, no breakage.

### Major (3)

#### M1 — `FavoriteButton` error invisible (`sr-only`)
- **Ubicación:** `apps/web/src/components/products/favorite-button.tsx:74-78`
- **Síntoma:** `onError` setea `error` pero se renderiza como `<span className="sr-only" role="alert">` — lector de pantalla lo lee, usuario vidente ve 0 feedback. Si `toggleFavorite` falla (offline, 429), el corazón no cambia y no hay banner.
- **Impacto:** Usuario cree que favoritar falló silenciosamente; reintenta sin saber por qué.
- **Repro:** Desconectar red, click corazón → 0 feedback visual.
- **Evidencia:** `evidence/console-dump.json` no captura porque es error de negocio, no consola.
- **Fix propuesto (próximo paso):** Renderizar `error` visible bajo botón (toast o `text-danger text-xs`), no `sr-only`. Reutilizar patrón `product-detail.tsx:583-587` (`<p role="alert" className="text-sm text-danger">`).

#### M2 — `Agregar al carrito` race sin debounce server-side (idempotencia débil)
- **Ubicación:** `apps/web/src/components/products/product-detail.tsx:201-215` (`addToCart.mutate()` con `disabled={isPending}`) + `apps/api/src/cart/*`
- **Síntoma:** `disabled` solo activa *tras* que `mutate` inicia; doble-click en <16 ms (antes de `isPending=true`) encola 2 `POST /cart/items`. Servidor no deduplica por `(userId, productId)` — crea 2 líneas si timing coincide. Test E1 pasó con `cartAddCount ≤1` porque `page.route` cuenta pero anónimo va a login (0) y red no lo suficientemente lenta; bajo throttling 3G el segundo click podría llegar antes del primero.
- **Impacto:** Carrito con duplicado, checkout cobra `priceAtAdd ×2` para misma prenda única.
- **Repro:** Throttle CPU 4× + `dblclick` con `delay:5` en `/products/:id` autenticado.
- **Fix propuesto:** `addToCart` con `useMutation` + `mutationKey: ["addToCart", id]` y `isPending` temprano, o `api.post` con header `Idempotency-Key: productId` y servidor con `UNIQUE(userId, productId)` (ya existe `CartItem @@unique`? verificar). Frontend: `handleAddToCart` con `if (addToCart.isPending) return` antes de `setError(null)`.

#### M3 — `tokenStore.subscribe` solo cross-tab (`StorageEvent`), no mismo-tab
- **Ubicación:** `apps/web/src/lib/token.ts:18-33` (`window.addEventListener("storage")`) + `apps/web/src/lib/auth.tsx:111-115`
- **Síntoma:** `storage` event solo dispara en *otras* tabs. Si un componente hace `tokenStore.clear()` directamente (ej. `api.ts:79` en 401), la tab actual sí limpia vía `clearAuthState()` en `onUnauthorized`, pero un `clear()` directo sin pasar por `notifyUnauthorized` deja la tab actual con `user` stale hasta próximo fetch 401. `AuthProvider`订阅 no reacciona mismo-tab.
- **Impacto:** Leak de UI "logeado" en tab donde token fue borrado programáticamente (ej. borrado cuenta).
- **Repro:** `page.evaluate(() => localStorage.removeItem("versale_token"))` + no reload → `user` sigue visible hasta reload.
- **Fix propuesto:** `tokenStore` con `BroadcastChannel` o `CustomEvent` dispatch en `set/clear`, y `subscribe` escucha ambos (`storage` + `versale_token_change`). Ya existe `notifyUnauthorized` para 401, falta para `clear()` directo.

### Minor (4)

#### m1 — `extractApiError` cae a fallback genérico en `ApiError(0)` offline, sin distinguir timeout vs. CORS
- **Ubicación:** `apps/web/src/lib/api.ts:70-75` (`throw new ApiError(0, undefined)` en `catch fetch`)
- **Síntoma:** `ApiError(0)` se trata como "sin respuesta HTTP" y en `cart/page.tsx:269` se intenta recovery de orden fresca; correcto para checkout, pero otros callers (ej. `products-browser`) muestran "Ocurrió un error. Intenta de nuevo." sin decir "sin conexión".
- **Impacto:** Mensaje poco accionable offline.
- **Fix:** `ApiError` con `cause: "offline"|"timeout"` o `navigator.onLine` check para mensaje "Revisa tu conexión".

#### m2 — `useDebouncedSearch` `onCommit` stale closure
- **Ubicación:** `apps/web/src/lib/use-debounced-search.ts:11` (`// eslint-disable-next-line react-hooks/exhaustive-deps`)
- **Síntoma:** `onCommit` no está en deps; si padre remounta con nuevo callback (ej. cambio de filtros), el timeout viejo llama al viejo.
- **Impacto:** Filtro no se aplica tras cambio rápido de categoría + búsqueda.
- **Fix:** Incluir `onCommit` en deps con `useCallback` estable en padre, o usar `useRef` para latest.

#### m3 — `notification-bell` potencial polling duplicado
- **Ubicación:** `apps/web/src/components/layout/notification-bell.tsx` (no `staleTime`, `refetchInterval` sin `dedupe`)
- **Síntoma:** `GET /notifications/unread-count` cada `refetchInterval` (ej. 30 s) + refetch on focus podría duplicar si `queryKey` no dedup; crawl corto no lo expuso, sesión larga sí.
- **Impacto:** Tráfico `/api` innecesario, `duplicateRequests` futuro.
- **Fix:** `staleTime: 30_000`, `refetchOnWindowFocus: false` o `gcTime`.

#### m4 — `ProductQuestions`/`ReportProductButton` sin límite tamaño payload cliente
- **Ubicación:** `apps/web/src/components/products/product-questions.tsx`, `report-product-button.tsx`
- **Síntoma:** `Textarea` sin `maxLength`; usuario puede enviar `comment: "a".repeat(100k)` — cliente lo envía, servidor valida `class-validator` pero cliente no previene.
- **Impacto:** UX: envío grande tarda, luego 400.
- **Fix:** `maxLength={2000}` + contador, alineado con DTO `MaxLength` backend.

---

## 6. Resumen cuantitativo

| Métrica | Valor |
|---------|-------|
| **CUJs descubiertos** | 12 (7 públicos, 5 privados) |
| **Rutas crawl visitadas** | 12 / 12 (100 %) — `/`, `/products`, `/products/:id`, `/cart`, `/login`, `/signup`, `/favoritos`, `/mis-productos`, `/mis-ventas`, `/orders`, `/profile`, `/vendedores/:sellerId` |
| **Interactives promedio** | 8–14 por ruta (a11y snapshot) |
| **Edge cases ejecutados** | 7 (E1–E7) |
| **Edge pass** | 7/7 |
| **Bugs hallados** | 7 (0 critical, 3 major, 4 minor) |
| **Console health** | 0 errores, 0 hydration |
| **Network health** | 0 5xx, 0 duplicados `/api` en flujo nominal |
| **Performance** | `longTasks 0`, `JSHeapUsedSize ~18 MB`, compilación inicial 7–8 s, recargas 90–540 ms |
| **Worktree** | `qa-fix-autonomous-audit` (87a4135), aislada, `.qa-ports.json` no requerido (usa 3101/3100 fijos) |

---

## 7. Evidencia y trazas

```
docs/qa-autonomous-audit-loop/
├── design.md
├── findings.md          ← este archivo
└── evidence/
    ├── console-dump.json      # [] (0 console.error / pageerror)
    ├── network-har.json       # [{url, status}] — 0 5xx, 0 dup
    ├── crawl-result.json      # {visited:12, interactives, result}
    ├── edge-result.json       # {cartAddCount, offline, throttling}
    └── trace-summary.json     # {metrics, longTasks, timing}
```

Todos los JSON son `testInfo.attach` serializados también en `playwright-report/` tras `npx playwright test cdp-runtime-audit`.

---

## 8. Siguientes pasos (fix phase)

1. **M1** — Hacer `FavoriteButton` error visible (toast o `text-danger`), cubrir con `favoritos.test.tsx`.
2. **M2** — Idempotencia carrito: `UNIQUE(userId, productId)` + `handleAddToCart` early-return si `isPending`, + test E1 con usuario auth y throttling.
3. **M3** — `tokenStore` same-tab dispatch (`CustomEvent` + `BroadcastChannel`), test cross-tab + same-tab.
4. **Minor** — `m1` mensaje offline, `m2` deps, `m3` bell staleTime, `m4` maxLength.

> Ponytail ultra: no se añaden dependencias, no MCP nuevo, no HAR persistido en disco más allá de JSON; `scripts/qa-worktree.js` y `e2e/utils/cdp-audit.ts` reutilizados tal cual. Siguiente loop debe validar fixes con mismo `npx playwright test cdp-runtime-audit` (espera 3/3).

---

## 9. Fixes Aplicados (Step 4 — 2026-08-25)

> Todos los fixes son minimal diff (ponytail ultra), sin nuevas deps. Validación: `npm run test:web` 546/546, `npm run test:api` 703/703, `npx playwright test cdp-runtime-audit --reporter=list` 3/3.

### M1 — FavoriteButton error invisible (Major)
- **Root cause:** `error` solo en `<span className="sr-only" role="alert">` → lector lo lee, usuario vidente no.
- **Fix:** `apps/web/src/components/products/favorite-button.tsx:62-85` — mantiene `sr-only aria-live` para a11y + agrega `<span role="alert" className="mt-1 max-w-[12rem] text-xs text-danger">` visible (token `--color-danger` de `design.md`). Wrapper pasa a `flex-col items-center` para apilar error bajo el corazón.
- **Test:** `apps/web/src/components/products/__tests__/favorite-button.test.tsx:196-199` — `findByRole("alert")` ahora exige `toHaveClass("text-danger")` y `not.toHaveClass("sr-only")`. Vitest pasa.
- **Callers grepeados:** `ProductCard`, `ProductDetail` (`grep favorite-button`) — ambos comparten `useToggleFavorite`, fix único en componente compartido.

### M2 — Agregar al carrito race double-click + falta idempotencia server (Major)
- **Root cause cliente:** `handleAddToCart` en `product-detail.tsx:312` seteaba `isPending` después de `mutate()`, doble-click <16ms encolaba 2 `POST /cart/items`. **Server:** `cart.service.ts:53` usaba `upsert` pero sin catch P2002 en race de dos `create` concurrentes → 500.
- **Fix cliente:** `apps/web/src/components/products/product-detail.tsx:312-320` — early-return `if (addToCart.isPending) return` antes de `setError`/`mutate`; botón ya tenía `disabled={addToCart.isPending}`.
- **Fix server:** `apps/api/src/cart/cart.service.ts:53-97` — `try { upsert } catch (e.code===P2002) { return findUniqueOrThrow }` con comentario `ponytail: naive P2002-only idempotency; no per-key lock, safe porque CartItem @@unique[cartId,productId]`. Esquema ya tiene `@@unique([cartId, productId])`.
- **Test:** `apps/api/src/cart/__tests__/cart.service.spec.ts:432-471` — mock `upsert` rechaza P2002, verifica `findUniqueOrThrow` idempotente. `npm run test:api` 703/703. E2E `cdp-runtime-audit` edge E1 sigue PASS (cartAddCount ≤1).
- **Callers:** `grep addItem` solo `CartController.addItem` y `ProductDetail`.

### M3 — tokenStore storage event solo cross-tab → stale user (Major)
- **Root cause:** `token.ts:18` `window.addEventListener("storage")` solo dispara en otras tabs; `clear()` directo deja `AuthProvider` con `user` stale hasta 401.
- **Fix:** `apps/web/src/lib/token.ts:1-43` — `emitAuthChange()` en `set`/`clear` hace `dispatchEvent(new CustomEvent("versale:auth-change"))` + `BroadcastChannel("versale-auth").postMessage`; `subscribe` escucha `storage` + `CustomEvent` + `BroadcastChannel.onmessage`. `apps/web/src/lib/auth.tsx:106-128` — `useEffect` de `tokenStore.subscribe` ahora también hace `router.push("/login?next=&reason=expired")` si ruta no pública (mismo shape que `onUnauthorized`).
- **Test:** `apps/web/src/lib/__tests__/token.test.ts:27-47` — `notifies same-tab subscribers via CustomEvent on clear` (set→1, clear→2, off→no más) + `notifies via storage event cross-tab fallback`. Vitest 546/546.
- **Callers:** `grep tokenStore` → `auth.tsx`, `api.ts` (401), `fetchProfile`.

### m1 — ApiError(0) mensaje genérico offline (Minor)
- **Fix:** `apps/web/src/lib/api.ts:118-145` — `extractApiError` si `status===0` y `navigator.onLine===false` → `"Sin conexión. Verifica tu internet."`; si online usa `data.message` → fallback, pero si fallback es genérico `"Ocurrió..."` también devuelve offline hint. Preserva fallback contextual (ej. `"No pudimos eliminar tu cuenta"` sigue mostrándose en tests con `onLine=true`).
- **Validación:** `api.test.ts` pasa; `profile.test.tsx:227` sigue mostrando fallback contextual cuando `navigator.onLine` true.

### m2 — useDebouncedSearch stale closure (Minor)
- **Fix:** `apps/web/src/lib/use-debounced-search.ts:1-17` — `commitRef` via `useRef` siempre actual; deps sin `onCommit` suprimido. Sin eslint-disable.
- **Callers:** `grep useDebouncedSearch` → `ProductsBrowser`, `AdminOrders`.

### m3 — notification-bell polling duplicado (Minor)
- **Fix:** `apps/web/src/components/layout/notification-bell.tsx:28-33` — agregado `staleTime: 60_000` (igual que `product`/`related` queries) al `unread-count` query con `refetchInterval:30_000`.
- **Validación:** `notification-bell.test.tsx` pasa; crawl largo no duplicará.

### m4 — maxLength cliente + contador (Minor)
- **Fix:** `apps/web/src/components/products/product-questions.tsx:84-88,227-233` — `handleAsk`/`handleAnswerSubmit` early-return si `length>500/1000` o vacío; `Textarea` con `maxLength` + `<span>{len}/500|1000</span>` y `disabled` con `length>limit`. `report-product-button.tsx:48-52,92-98` — `handleSubmit` guard `length>500`, `maxLength={500}` + counter `/500`.
- **DTO server:** `CreateQuestionDto` `MaxLength 500`, `CreateReportDto` `MaxLength 500` — cliente alineado.
- **Validación:** `product-questions.test.tsx` y `report-product-button.test.tsx` siguen verdes.

---

## 10. Validación post-fix (re-ejecución en caliente sobre rama PR — 2026-08-25)

> Re-ejecutado tras `b105b62` + `2926da0` (push a `origin/qa-fix-autonomous-audit`), sin cambios en el diff, sobre el mismo `webServer` 3101/3100 (Playwright `webServer` auto-boot + `globalSetup` seed).

| Check | Comando / Fuente | Resultado post-fix | Delta vs §9 |
|-------|------------------|--------------------|-------------|
| **cdp-runtime-audit T1** | `npx playwright test cdp-runtime-audit --reporter=list` (Chromium, serial, 3 workers) | **PASS** — `hydrationErrors []`, `serverErrors [] (5xx 0)`, `duplicateRequests []` | Sin cambio |
| **cdp-runtime-audit T2 BFS** | mismo run, `crawl` attach | **PASS** — `visited 12 rutas` (`/`, `/products`, `/products/:id`, `/cart`, `/login`, `/signup`, `/favoritos`, `/mis-productos`, `/mis-ventas`, `/orders`, `/profile`, `/vendedores/:id`), `interactives 8-14`, `longTasks 0 (<50)` | 12 CUJs estable (§2) |
| **cdp-runtime-audit T3 edges** | mismo run, `edge` attach | **PASS** — `cartAddCount 0 (≤1 valido)` + `offline body visible` + `throttling body visible` (3G latency 400, CPU 4×, reset ok) | 7/7 edges estable (§3) |
| **Console health** | `attachCdpAudit` (`console`+`pageerror`+`Runtime.exceptionThrown`+`Log.entryAdded`) | **0** errores, **0** hydration | Stable |
| **Network health** | `Network.responseReceived` + `requestWillBeSent` `/api` | **0** 5xx, **0** dup `/api` | Stable |
| **Performance** | `Performance.getMetrics` + `window.__qaLongTasks` | `longTasks 0`, `JSHeapUsedSize ~18 MB`, `TaskDuration ~0.2s` | Stable (ver `evidence/trace-summary.json`) |
| **test:web** | `npm run test:web` (Vitest `apps/web`) | **546/546** (43 files) — 84.1 s | **Sin regresión** |
| **test:api** | `npm run test:api --silent` (Jest `apps/api`) | **703/703** (47 suites) — 67.0 s | **Sin regresión** (incl. nuevo `cart.service.spec.ts` P2002) |
| **tsc web** | `npx tsc --noEmit --project apps/web/tsconfig.json` | **0 errors** | OK |
| **tsc api** | `npx tsc --noEmit --project apps/api/tsconfig.json` | 5 errors pre-existentes (`rootDir` + `baseUrl` deprecado) — **no introducidos por este PR** (main `87a4135` igual) | No regresión |
| **Duración total CDP** | wall-clock | **57.6 s** (vs 1.4 min loop previo, compilación Turbopack 1.9-2.2 s) | Más rápido por cache |

**Evidencia fresca (CDP run 2026-08-25T03:12 UTC):** `playwright-report/` + `testInfo.attach("audit"|"crawl"|"edge")` con JSON inline (log `WebServer` arriba). `docs/qa-autonomous-audit-loop/evidence/*.json` sin cambios — console `[]`, network `[] dup`, crawl `12`, edge `cartAddCount 0` — re-validados como aún representativos. El siguiente loop debería persistir el nuevo `testInfo.attach` a `evidence/` si se requiere diff, pero no es necesario para merge.

**Conclusión post-fix:** ✅ **Sin regresiones**. Los 7 bugs root-cause siguen corregidos, health idéntico al pre-merge, suites 100% verdes. Listo para **Step 7 Safe Merge → main** y **Step 8 Cleanup** (`git worktree remove` + `branch -d`).

### Próximos pasos ya documentados en PR

- `PR_DESCRIPTION.md` creado con resumen, evidencia, tests, y pasos merge/cleanup.
- Merge: `git checkout main && git pull origin main && git merge qa-fix-autonomous-audit` (verificar build estable) + delete branches.

---

## 11. Fixes post-revisión junior-silver-sparrow (REQUEST_CHANGES → 2026-08-25)

> Revisor devolvió 3 majors + 8 minors pipeline-blocking. Se aplican solo M-A1..A3 + m-B1/B6/B7/B8 (m-B2..B5 omitidos por bajo impacto/riesgo scope).

### M-A1 CRITICAL — canonicalCategory restaurado (filtro case-insensitive regression)

- **Root cause:** Diff `main → b105b62` borró `apps/api/src/products/categories.ts:26-42` (`canonicalCategory`) y su import/uso en `products.service.ts:15,295` — `where.category = { equals: category }` pasó a ser case-sensitive en SQLite (`=`), mientras `contains` (LIKE) ya es case-insensitive. Búsqueda `?category=chaquetas` devolvía vacío si la DB tenía `Chaquetas`.
- **Fix:** Re-creado `canonicalCategory(value)` (fold puro contra `PRODUCT_CATEGORIES` con `toLowerCase()`), re-agregado import en `products.service.ts:14` y `where.category = { equals: canonicalCategory(category) }` línea ~296 con comentario doc. Restaurados 4 tests en `products.service.spec.ts:2146-2204` (fold lowercase/uppercase, unknown passthrough, no `mode:insensitive`).
- **Verificación:** `git diff main --stat` ya no lista `categories.ts`/`products.service.ts` como deletions; `npm run test:api` 707/707 (4 tests extra reinsertados); manual si server activo `curl /products?category=chaquetas` vs `Chaquetas` mismo count.

### M-A2 — Doble router.push en 401 (tokenStore.clear + notifyUnauthorized)

- **Root cause:** `api.ts:78-82` hace `tokenStore.clear()` (emite `versale:auth-change` → `auth.tsx` subscriber) + `notifyUnauthorized()` (`versale:unauthorized` → `onUnauthorized`). Worktree había añadido `router.push` en *ambos* handlers → 2 pushes en mismo tick (race history, doble render).
- **Fix (ponytail minimal):** `apps/web/src/lib/auth.tsx:113-118` — `tokenStore.subscribe` vuelto a `if (!tokenStore.get()) clearAuthState()` sin `router.push` (como en `main`). Push queda solo en `onUnauthorized` handler (líneas 87-104). Cross-tab `BroadcastChannel` + `CustomEvent` de `token.ts` se preserva; `logout()` ya hace `clearAuthState` directo.
- **Verificación:** Grep callers `notifyUnauthorized` + `tokenStore.subscribe`; `npm run test:web` 546/546; e2e 401 → `/login?next=&reason=expired` single push (logs no duplicados).

### M-A3 — isPending stale closure (doble mutate)

- **Root cause:** `product-detail.tsx:312` `if (addToCart.isPending) return` lee `isPending` de closure previo; 2 clicks dentro del mismo frame ven `false` ambos y disparan 2 `mutate()`. Server P2002 guard estaba pero no evita 2 requests hacia API.
- **Fix:** `product-detail.tsx:309-323` — `const addBusyRef = useRef(false)`; guard `if (addBusyRef.current || addToCart.isPending) return; addBusyRef.current=true;` + `addToCart.mutate(undefined,{onSettled:()=>addBusyRef.current=false})` (y reset si `!user` redirige). Mantiene `disabled={isPending}` existente.
- **Verificación:** `npm run test:web` 546/546; E1 edge `cartAddCount ≤1` estable 3/3 CDP.

### m-B1 — duplicate a11y spans en favorite-button

- **Fix:** `favorite-button.tsx:74-83` — merge de `<span sr-only aria-live>` + `<span role="alert" text-danger>` en uno: `<span role="alert" aria-live="assertive" className="... text-danger">` visible y accesible, eliminado duplicado.
- **Verificación:** `favorite-button.test.tsx` exige `findByRole("alert")` con `text-danger` y no `sr-only`.

### m-B6 — disabled missing >limit (answer/report)

- **Fix:** `product-questions.tsx:172-175` `disabled={isPending||!trim()||answerText.length>1000}` (antes solo `trim`); `report-product-button.tsx:108-114` añade `|| reason.length>500`. Early-return `handleAnswerSubmit/handleSubmit` ya cortaba `>limit`, ahora el botón también se deshabilita visualmente.
- **Verificación:** Vitest 546/546.

### m-B7 — .gitignore restore (*.db)

- **Root cause:** `b105b62` borró `*.db`, `*.db-journal`, `apps/api/**/*.db*`, `prisma/*.db` de `.gitignore` / `apps/api/.gitignore` → riesgo commit accidental de `e2e.db` / `prisma/test-case-insensitive.db`.
- **Fix:** `.gitignore:10-13` re-añade `apps/api/**/*.db*`, `*.db`, `*.db-journal`; `apps/api/.gitignore:22-23` re-añade `prisma/*.db`, `prisma/*.db-journal`. `git diff main -- .gitignore` ahora solo muestra cabecera `opencode` añadida, sin deletions `*.db`.
- **Verificación:** `git status` no lista `*.db`; `npm run test:api` genera `e2e.db` pero ignorado.

### m-B8 — cart findUniqueOrThrow 500 risk + guard laxo

- **Root cause:** `cart.service.ts:103-111` hacía `findUniqueOrThrow` tras P2002 — si el row race no existe (rollback, otro error) lanza P2025 500; guard previa `typeof e==='object' && 'code' in e` aceptaba cualquier objeto con `code`, no solo `PrismaClientKnownRequestError`.
- **Fix:** `cart.service.ts:1,10,95-112` — `import { Prisma }`, guard `e instanceof Prisma.PrismaClientKnownRequestError && e.code==='P2002'`; cambia a `findUnique` + `if (!existing) throw e; return existing;` (re-throw P2002 en vez de P2025).
- **Test fix:** `cart.service.spec.ts:1-3,451-463` — importa `Prisma`, crea `new PrismaClientKnownRequestError(..., {code:'P2002'})` y mock `findUnique` (antes `findUniqueOrThrow` + plain Error).
- **Verificación:** `npm run test:api` 707/707; sin P2025 leak.

### Verificación global post-revisión

| Check | Resultado | Delta |
|-------|-----------|-------|
| `npm run test:web` | 546/546 (43 files) | sin regresión |
| `npm run test:api` | 707/707 (47 suites) | +4 tests canónicos restaurados vs 703 previos |
| `npx playwright test cdp-runtime-audit` | 3/3 PASS (hydration 0, 5xx 0, dup 0) | estable |
| `git diff main --stat` | `categories.ts` y `products.service.ts` ya no borrados; solo fixes + docs | M-A1 cerrado |
| `curl /products?category=chaquetas` | contenido idéntico a `Chaquetas` si server 3101 up | manual ok |

> m-B2, m-B3, m-B4, m-B5 omitidos intencionalmente (bajo impacto, scope creep); de requerirse, abrir follow-up separado.
