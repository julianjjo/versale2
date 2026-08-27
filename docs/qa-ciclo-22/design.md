# QA Ciclo 22 — Cobertura 100% AbortSignal + Hydration UTC

## Hallazgos consolidados (CDP multi-agente, 22 iteraciones)

### Network (HAR, duplicadas/fugas)
- 22 CUJs auditados: catálogo, detalle, seller, cart, favoritos, orders, mis-productos/ventas, verify-email, admin (users/dash/products/orders/reportes/preguntas/reviews)
- Patrón: `queryFn: async () => api.get(...)` sin `signal` → pending duplicates al navegar rápido.
- Evidencia: HAR con 4-6 GET solapados al tipear búsqueda, paginar, cambiar tabs antes de resolver.

### Console (excepciones no capturadas)
- `api.ts` JSON.parse sin guard → SyntaxError huérfano con HTML error page.
- `sitemap.ts` console.warn en ruta producción.

### Elements (hidratación/DOM)
- `products-browser`, `admin/products`, `mis-productos`, `admin/reportes` con `setState` en render para clampar paginación.
- Fechas con `toLocaleDateString/String` sin `timeZone: UTC` → mismatch SSR vs cliente (order detail, admin Q&A/reportes).

### Performance (bloqueos main thread)
- Doble commit por render-phase setState + JSON.stringify por render.

## Priorización
- P1 Network abort (22 fixes) → 100% `queryFn: async ({signal})` + `api.*(...,{signal})` + `AbortError` re-throw.
- P1 Console JSON guard + sitemap silence.
- P1 Elements render-phase → `useEffect` + `eslint-disable` + `[meta?.pages, lastSeenPages]`.
- P1 Elements hydration → `timeZone: "UTC"` en todas las fechas listadas.
- P2 cart double-submit guard.

## Validación
- `test:web` 554/554 en cada iteración (follow-ups adaptan expectativas a `expect.objectContaining({signal})`).
- CDP re-ejecución por PR: Network sin pending, Console limpia, Elements sin hydration warning, Performance sin doble-commit.

## Estado actual
- `grep -rn "queryFn: async () =>" apps/web/src` → 0 (100% cobertura).
- `grep -rn "toLocale.*es-CO" | grep -v timeZone` → solo casos con timeZone en siguiente línea (falso positivo por línea).
- Próximo ciclo: mantener gate — cualquier nuevo `useQuery` debe incluir `signal`.
