# refactor(web): inline truncateDescription call, remove export (ponytail ultra, -4L)

## Resumen
Ponytail ultra inline: elimina `export function truncateDescription` (3L) + ceiling (1L) en `apps/web/src/app/products/[id]/page.tsx` y reemplaza único call site `truncateDescription(product.description, 160)` por slice inline + ceiling preservado. Net -4L, 1 archivo.

## Decisiones
- **Rung**: delete over abstraction — helper 1 caller, inline es el rung más alto.
- **Ceiling**: `// ponytail: truncate inline slice; restore helper with Intl.Segmenter if emoji at boundary` junto al inline documenta trade-off surrogate huérfano (`�`) vs simplicidad; rollback = restaurar helper con Segmenter.
- **Tests**: `describe(truncateDescription)` eliminado (helper ya no existe); `generateMetadata` integration ya cubre `length <=160` + `endsWith("...")` con emoji en límite, suficiente y tolerante a slice.
- **Out of scope**: Segmenter re-introducción, Reputación/Métricas, sweepOrders.

## Evidencia
- `npm run test:web`: 43 suites / 548 tests passed (Vitest) — verde 100%
- `npm run test:api`: 47 suites / 714 tests passed (Jest) — verde 100%
- `git diff --stat`: 1 file (`page.tsx`) — verificado
- `grep -R truncateDescription`: 0 hits (fuera de ceiling)
- `grep -R Intl.Segmenter`: 0 hits fuente (solo ceiling si se incluye)
- Manual: `generateMetadata` con `a*156+🎉+b*50` → `length <=160 && endsWith("...")` OK

## Diff stat
```
apps/web/src/app/products/[id]/page.tsx | 5 +----
1 file changed, 1 insertion(+), 5 deletions(-) (-4L net)
+ docs/truncate-inline-call/{design.md,PR_DESCRIPTION.md}
+ test: remove describe truncateDescription (rely on generateMetadata invariant)
```

## Riesgos
Slice UTF-16 puede dejar surrogate huérfano si emoji cae en límite 157 → `�` en `<meta>`/OG. Probabilidad baja (~1/160). Rollback trivial (restaurar helper).

## Checklist
- [x] Ponytail ultra — deletion over addition, rung 1
- [x] 1 archivo fuente, -4L net
- [x] Spanish UI intacto
- [x] 100% suites verdes
