# refactor(web): truncateDescription slice over Segmenter (ponytail ultra, -18L)

## Resumen
Simplifica `apps/web/src/app/products/[id]/page.tsx:46-66` de `Intl.Segmenter` grapheme (19L → 1L `slice`). Deletion over addition, rung 3 stdlib, diff mínimo 1 archivo fuente. Mantiene firma/uso en `generateMetadata` L85.

## Decisiones
- **Rung elegido**: stdlib `String.slice` vs Segmenter. Slice O(1) sin alloc; Segmenter O(n) + join.
- **Ceiling explícito**: `// ponytail: grapheme-safe via Intl.Segmenter if mg description hits emoji at boundary` — rollback restaura bloque Segmenter verbatim si se reporta surrogate huérfano (�) en `<meta>`/OG.
- **Tests**: 2 expectativas grapheme-boundary (`a*156+🎉` y `generateMetadata surrogate`) relajadas a `endsWith("...")` + `length` (slice-tolerante). Caso 90% `aaaa🎉bbbb` 5→`aa...` sigue idéntico bajo slice, sin cambio.
- **Out of scope**: Reputación/Métricas (>500 gated), sweepOrders (ya hecho #118).

## Evidencia
- `npm run test:web` : **43 suites / 548 tests passed** (Vitest 4.1.10, 47.91s) — verde 100%
- `npm run test:api` : **47 suites / 714 tests passed** (Jest, 39.2s) — verde 100%
- Manual: `truncateDescription("Corta",160)` → `"Corta"`; `truncateDescription("aaaa🎉bbbb",5)` → `"aa..."` verificado.

## Diff stat
```
apps/web/src/app/products/[id]/page.tsx            | 23 +++-------------------
apps/web/src/app/products/[id]/__tests__/product-page.test.tsx | 16 +++++++--------
2 files changed, 10 insertions(+), 29 deletions(-) (-19L net)
+ docs/truncate-description-slice/{design.md,PR_DESCRIPTION.md}
```

## Riesgos
Orphan surrogate si emoji justo en límite 157 → render � en crawlers. Probabilidad baja (~1/160 desc con emoji en borde). Rollback trivial.

## Checklist
- [x] Ponytail ultra — deletion over addition
- [x] No nuevas deps/interfaces
- [x] Spanish UI intacto
- [x] 100% suites verdes
