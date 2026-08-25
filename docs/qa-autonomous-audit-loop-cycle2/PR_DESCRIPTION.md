# PR — fix(qa-cycle2): corrige 5 bugs CDP (M-C1, M-C2, M-C3, m-C1, m-C2)

**Branch:** `qa-fix-cycle2` · **Base:** `2865ec6` · **Worktree:** `C:\Users\julian.mican\Documents\Julian\qa-fix-cycle2`
**Fecha:** 2026-08-25 03:59 UTC
**Auditoría:** Ciclo2 agresivo (Chrome DevTools vía Playwright CDP) sobre 5 suspects que en ciclo1 pasaron superficial.

## Resumen

Ciclo2 re-auditó 5 suspects con edges agresivos (large image 5MB+6 files, draft cross-tab, rapid favorite 3x, review 2nd attempt, concurrent POST /orders SOLD race) + re-crawl BFS 12 rutas. Halló **5 bugs (0 critical, 3 major, 2 minor)**; este PR los corrige todos con diff ponytail ultra (sin nuevas deps) y deja **0 pendientes**.

## Tabla de severidad

| ID | Severidad | Ubicación | Síntoma | Fix | Estado |
|----|-----------|-----------|---------|-----|--------|
| **M-C1** | **Major** | `apps/api/src/auth/auth.service.ts:55-93` | `signup` race: dos `POST /auth/signup` mismo email concurrentes → `P2002 @@unique(email)` no capturado → 500 en vez de 409 | `try {create} catch P2002 → ConflictException` import `Prisma` + `translatePrismaError` | ✅ Cerrado |
| **M-C2** | **Major** | `apps/api/src/products/products.service.ts:237-347` | `top_rated` sorteaba per-page (10 ya paginados por `createdAt`) no global por `averageRating` → `page=2` con 5★ que debía estar en `page=1` | Branch `isTopRated`: `findMany` sin `skip/take` → `withAverageRating` global → `sort` global → `slice(skip,skip+limit)`; `ponytail: O(n)` | ✅ Cerrado |
| **M-C3** | **Major** | `apps/api/src/reviews/reviews.service.ts:268-274` | `getHelpfulSummary(reviewId,true/false)` usaba boolean stale del caller; rapid toggle 3x dejaba `votedByMe` desincronizado | `getHelpfulSummary(reviewId,userId)` re-query `count+findUnique → votedByMe: !!mine` | ✅ Cerrado |
| **m-C1** | **Minor** | `apps/api/src/uploads/uploads.controller.ts:19` | `FilesInterceptor limits.fileSize 5MB` Multer `LIMIT_FILE_SIZE` mapeado a 400 no 413 → frontend `uploadErrorMessage` caía a fallback | `MulterLimitFilter @Catch(multer.MulterError)` mapea `LIMIT_FILE_SIZE → PayloadTooLargeException(413)` + `@UseFilters` | ✅ Cerrado |
| **m-C2** | **Minor** | `apps/web/src/app/sell/page.tsx:87,161` | Draft `versale:sell-draft:v1` solo `StorageEvent` (otras tabs, async) sin `BroadcastChannel+CustomEvent` como `tokenStore` | `DRAFT_EVENT`/`DRAFT_CHANNEL` + `emitDraftChange()` en `writeDraft`/`clearDraft`; `useEffect` suscribe `storage + CustomEvent + BroadcastChannel` | ✅ Cerrado |

## Fixes (tabla)

| Fix | Archivos | Líneas ponytail | Root cause |
|-----|----------|-----------------|------------|
| M-C1 | `auth.service.ts:1-2,67-83` | 6 | `findUnique → create` race sin catch P2002 |
| M-C2 | `products.service.ts:315-347` | 12 | `SORT_ORDER_BY[TOP_RATED]=createdAt` + sort per-page |
| M-C3 | `reviews.service.ts:227,261,268-274` + `reviews.service.spec.ts:562-675` | 8 + spec | Boolean param stale vs DB real |
| m-C1 | `uploads.controller.ts:1-25,31-33` | 8 | Multer corta antes de `validateFiles` |
| m-C2 | `sell/page.tsx:87-112,174-196` | 14 | Solo StorageEvent, falta BC |

## Evidencia (paths)

```
docs/qa-autonomous-audit-loop-cycle2/
├── findings.md               # Hallazgos + Fixes M-C1..m-C2 + cuantitativo
├── PR_DESCRIPTION.md         # este archivo
└── evidence/
    ├── console-dump.json     # [] 0 console.error / pageerror / Runtime.exceptionThrown (3 tests)
    ├── network-har.json      # [] 0 5xx, 0 dup /api
    ├── crawl-result.json     # visited 12 rutas, 8-14 interactives
    ├── edge-result.json      # cartAddCount 0, offline true, throttling true (ciclo1 re-validado)
    ├── trace-summary.json    # longTasks 0, JSHeapUsedSize ~18MB
    └── cycle2-edges.json     # largeImage/batch/draft/favorite/review/concurrent/paused
```

Ciclo1 evidence en `docs/qa-autonomous-audit-loop/evidence/` **no sobrescrito**.

## Tests

| Suite | Comando | Resultado | Evidencia |
|-------|---------|-----------|-----------|
| **API** | `npm run test:api` (desde root `npm run test:api`) | **707/707** (47 suites) | Jest run 26.9s, sin nuevos fallos (logs Nest WARN esperados: R2/Brevo) |
| **Web** | `npm run test:web` | **546/546** (43 files) | Vitest 43.6s |
| **CDP smoke** | `npx playwright test cdp-runtime-audit --reporter=list` | **3/3 PASS** (40.3s: 5.2s + 10.1s + 19.3s) | `runtime audit`, `edge cases (doble click/offline/throttling)`, `BFS crawl 12 rutas` |
| **tsc** | `apps/web tsc --noEmit` | **0 errors** | `apps/api` 5 pre-existentes no introducidos por este PR |

Repro:

```bash
git checkout qa-fix-cycle2
npm run test:api   # expect 707/707
npm run test:web   # expect 546/546
npx playwright test cdp-runtime-audit --reporter=list  # expect 3/3 PASS
```

## Diff mínimo (ponytail ultra)

- Sin nuevas dependencias, sin MCP, reusa `cdp-audit.ts` existente.
- Total ciclo2: **5 ficheros prod + 1 spec** (`auth`, `products`, `reviews`, `uploads`, `sell` + `reviews.spec`) + `docs/cycle2`.
- Commit único: `fix(qa-cycle2): corrige 5 bugs CDP (M-C1 signup race, M-C2 top_rated global sort, M-C3 helpful stale, m-C1 413, m-C2 draft BC)`.

## Estado final

- **Ciclo1 (base 2865ec6):** 7 bugs cerrados (m-B1/B6/B7/B8 + 3 otros).
- **Ciclo2 (este PR):** 5/5 cerrados (3 major + 2 minor).
- **Total post-merge:** **12 bugs cerrados**, **0 critical/major/minor pendientes** en `qa-fix-cycle2` (5 suspects + 6 edges E8-E13 + 12 rutas BFS).
- **3rd cycle targets propuestos (no tocados):** payments MP webhook idempotency, reports/questions flood, notifications bell CLS/longtask — para `cdp-cycle2-audit.spec.ts`.

## Checklist merge

- [x] `npm run test:api` 707/707
- [x] `npm run test:web` 546/546
- [x] `npx playwright test cdp-runtime-audit` 3/3 PASS
- [x] `findings.md` actualizado con Fixes m-C1/m-C2 (file:line, root cause, validation)
- [x] `stage 4+` + push `qa-fix-cycle2` (hash reportado en PR)
