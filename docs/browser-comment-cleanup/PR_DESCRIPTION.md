# refactor(web): remove explanatory comments from products-browser (ponytail ultra, -65L)

## Qué
- `apps/web/src/components/products/products-browser.tsx`: elimina ~65L de bloques de comentarios explicativos (`//` y ` {/* ... */}`), sin tocar lógica.

## Por qué (ponytail ultra)
- Los comentarios duplican lo que el código ya expresa (`SORT_OPTIONS`, `filtersFromQuery`, `isSortByValue`, `PRODUCT_CATEGORIES`, etc.) y ruido histórico de decisiones estabilizadas. El código queda legible sin ellos; YAGNI.

## Alcance
- 1 archivo, -65L net.
- Sin cambios de `import`/`export`, sin cambios de comportamiento ni de UI (español preservado).
- Mantiene `SORT_OPTIONS`, `SIZES`, `CONDITION_OPTIONS`, `PRODUCT_CATEGORIES`, `filtersFromQuery`, `queryFromFilters`, `isSortByValue`, `ProductCard`, labels en español.

## Verificación
- `npm run test:web` 43/545
- `npm run test:api` 47/714
- `git diff --stat` 1 file

## Riesgo
- Bajo. Solo documentación inline; lógica y tests intactos.

Refs: `docs/browser-comment-cleanup/design.md`
