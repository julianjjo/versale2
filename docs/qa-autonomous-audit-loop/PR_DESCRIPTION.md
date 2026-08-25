# PR: fix(qa): corrige 7 bugs hallados por agentes CDP (M1-M3 + m1-m4)

Branch: `qa-fix-autonomous-audit` -> `main` | Base: `87a4135` | Commit: `b105b62`

## Resumen

Auditoria autonoma en caliente con Chrome DevTools (CDP) sobre `webServer` 3101/3100 sin dev manual. 12 CUJs mapeados, 7 edges ejecutados, health limpio (0 console, 0 5xx, 0 dup /api). Se hallaron **7 bugs (3 Major + 4 Minor)**, todos corregidos con diff minimal root-cause, sin nuevas deps, verificado 703 api + 546 web + 3/3 CDP.

## Hallazgos por severidad

| ID | Severidad | Componente | Sintoma |
|----|-----------|------------|---------|
| **M1** | Major | `favorite-button.tsx` | Error solo `sr-only` → usuario vidente sin feedback si toggle falla (offline/429) |
| **M2** | Major | `product-detail.tsx` + `cart.service.ts` | Doble-click <16ms encola 2 `POST /cart/items`; server sin idempotencia → 500 o duplicado |
| **M3** | Major | `token.ts` + `auth.tsx` | `storage` event solo cross-tab → `clear()` directo deja `user` stale mismo-tab hasta 401 |
| **m1** | Minor | `api.ts` `extractApiError` | `ApiError(0)` offline muestra generico sin distinguir sin conexion |
| **m2** | Minor | `use-debounced-search.ts` | `onCommit` fuera de deps → stale closure |
| **m3** | Minor | `notification-bell.tsx` | `unread-count` sin `staleTime` → duplicados en sesion larga |
| **m4** | Minor | `product-questions.tsx` `report-product-button.tsx` | Textarea sin `maxLength` → payload 100k hasta 400 tardio |

**Critical: 0** — sin XSS (React escapa, 0 `dangerouslySetInnerHTML`), sin 5xx, sin pago duplicado observable.

## Correcciones root-cause (ponytail ultra, 13 ficheros)

- **M1** `favorite-button.tsx:62-85`: mantiene `sr-only aria-live` + agrega `<span role="alert" class="text-danger text-xs">` visible (`flex-col items-center`). Shared component → fix unico para `ProductCard` y `ProductDetail`.
- **M2** client `product-detail.tsx:312-320`: `if (addToCart.isPending) return` antes de `mutate`. Server `cart.service.ts:53-97`: `try upsert catch P2002 → findUniqueOrThrow` (ponytail: P2002-only, sin per-key lock, safe por `@@unique[cartId,productId]` existente).
- **M3** `token.ts:1-43`: `emitAuthChange()` en `set/clear` → `CustomEvent("versale:auth-change")` + `BroadcastChannel("versale-auth")`; `subscribe` escucha `storage` + CustomEvent + Broadcast. `auth.tsx:106-128`: subscribe redirige a `/login?next=&reason=expired` si ruta no publica (paridad `onUnauthorized`).
- **m1** `api.ts:118-145`: `status===0 && navigator.onLine===false → "Sin conexión. Verifica tu internet."`, preserva `data.message` y fallback contextual si `onLine===true`.
- **m2** `use-debounced-search.ts:1-17`: `commitRef` via `useRef`, deps limpias sin `eslint-disable`.
- **m3** `notification-bell.tsx:28-33`: `staleTime: 60_000` (alineado con `product`/`related`).
- **m4** `product-questions.tsx:84-88,227-233` + `report-product-button.tsx:48-52,92-98`: early-return `length>limit`, `maxLength={500/1000}` + contador `/500` y `disabled`.

Sin nuevas dependencias. Grep callers verificado (`favorite-button`, `addItem`, `tokenStore`, `useDebouncedSearch`).

## Evidencia adjunta

```
docs/qa-autonomous-audit-loop/
├── design.md
├── findings.md
├── PR_DESCRIPTION.md
└── evidence/
    ├── console-dump.json      # [] 0 console.error/pageerror
    ├── network-har.json       # [] 0 5xx, 0 dup /api en flujo nominal
    ├── crawl-result.json      # {visited:12, interactives 8-14}
    ├── edge-result.json       # {cartAddCount:0 (≤1 valido), offline+throttle PASS}
    └── trace-summary.json     # {metrics TaskDuration ~0.2s, JSHeap ~18MB, longTasks 0}
```
Tambien `testInfo.attach("audit"|"crawl"|"edge")` en `playwright-report/` tras `npx playwright test cdp-runtime-audit`.

## Tests añadidos / modificados

- `favorite-button.test.tsx:196-199` — exige `findByRole("alert")` con `text-danger` y `not sr-only`.
- `cart.service.spec.ts:432-471` — mock `upsert` rechaza `P2002` → verifica `findUniqueOrThrow` idempotente.
- `token.test.ts:27-47` — `CustomEvent` same-tab + `storage` cross-tab fallback.

No se borraron tests existentes; solo se extendieron.

## Verificación

| Suite | Comando | Resultado |
|-------|---------|-----------|
| `test:api` | `npm run test:api` (apps/api) | **703/703** (incl. nuevo P2002) |
| `test:web` | `npm run test:web` (apps/web) | **546/546** (incl. favorite + token) |
| `cdp-runtime-audit` | `npx playwright test cdp-runtime-audit --reporter=list` (3101/3100, webServer, Chromium serial) | **3/3** — T1 hydration/5xx/dup PASS, T2 crawl 12 rutas (≥8 assert) PASS, T3 edges cartAddCount≤1/offline/throttle PASS |
| `tsc` | `npx tsc --noEmit` | **0 errors** |

Health post-fix: console 0, hydration 0, network 0 dup, longTasks 0 (<50), JSHeap ~18MB, compilación 7-8s → 90-540ms.

## Próximos pasos (Steps 7-8 pipeline)

```bash
# 7. Safe merge (verificar PR 100% tests, sin conflictos)
git checkout main && git pull origin main && git merge qa-fix-autonomous-audit
# verificar build estable
npm run test:api && npm run test:web && npx playwright test cdp-runtime-audit --reporter=list

# 8. Cleanup
git branch -d qa-fix-autonomous-audit
git push origin --delete qa-fix-autonomous-audit   # opcional remoto
node scripts/qa-worktree.js --remove qa-fix-autonomous-audit  # si se usó worktree aislado
# alternativa worktree actual (ya es el worktree): desde repo base
git worktree remove --force ../qa-fix-autonomous-audit
```

> Nota: este worktree ya es `../qa-fix-autonomous-audit` creado desde `main`; tras merge se puede remover con `git worktree remove` desde `versale2`.

## Checklist PR

- [x] 23 ficheros stageados (13 fix + harness 3 + docs 7), sin `e2e.db`/`dev.db`/`dist`/`.next`/`node_modules`
- [x] Commit `b105b62` push a `origin/qa-fix-autonomous-audit`
- [x] Evidencia fresca `evidence/*.json` + `findings.md §9` + `§10` post-fix (re-validación en caliente)
- [x] Tests 703/703 + 546/546 + 3/3 sin regresiones
