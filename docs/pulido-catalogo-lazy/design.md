# pulido-catalogo-lazy — Design

## Decision
Pulir el catálogo público (`ProductsBrowser` + `Pager`) con el menor diff que evita salto de layout y mejora a11y/conversión. No tocar `ShareButton` (ya usa Web Share nativo + clipboard fallback, ver `share-button.tsx`).

Por qué: `funcionalidades-propuestas.md §Notas frontend` describe paginación con `Array.from({length: meta.pages})` → ~420 botones. Verificado en `apps/web/src/components/admin/pager.tsx`: ya está resuelto con `‹ Anterior / Página X de Y / Siguiente ›` (solo 2 botones, nunca desborda). Añadir ventana ±2 sería añadir código que la solución actual hace innecesario — ponytail ultra: no añadir lo que ya no duele.

## Qué se hace (target <50 líneas)
1. **`products-browser.tsx`** — `useQuery` con `placeholderData: keepPreviousData` (reusa patrón de `mis-productos/page.tsx`, `admin/products/page.tsx` etc.), expone `isFetching`, añade `aria-busy` al contenedor, `aria-live="polite"` con "Página X de Y" y manejo de foco (ref + `focus()` tras `applyFilters`). Evita desmonte de grilla al paginar, anuncia cambio a lectores, mantiene foco visible 2px (token existente).
2. **`pager.tsx`** — pasa `isFetching` para deshabilitar botones durante fetch (ya soporta `isFetching` prop, solo falta cablearlo), mantiene copy en español.

No nuevos deps, no nuevo componente, no cambio de API.

## No se hace (YAGNI)
- Ventana ±2 con elipsis: `Pager` actual nunca desborda; añadirla añade ramas sin valor. `ponytail: prev/next only; add window if catalog shows >5 visible page links needed`.
- Skeleton `aspect-[3/4]`: spinner actual + `keepPreviousData` mantiene grilla; skeleton sería mejora visual pero añade markup sin corregir salto (ya corregido). Diferir hasta métrica LCP lo pida.
- Share: ya existe, verificado.

## Data flow
`URL query (page) -> filtersFromQuery -> useQuery(["products", filters], placeholderData) -> data.meta.pages -> Pager (page/pages/isFetching) -> onPageChange -> router.push + focus heading + live region`

## Componentes tocados
- `apps/web/src/components/products/products-browser.tsx` (1 fichero principal)
- `apps/web/src/components/admin/pager.tsx` (solo cableado isFetching si hace falta, ya lo tiene)

## Seguridad
- Sin nuevo input; parsers existentes `parsePage`/`parseAmount` clamped y `Math.floor`; query sanitizada a `Record<string,string|number>` antes de `api.get`.
- No expone PII nuevo; paginación no altera permisos.

## Performance
- `keepPreviousData` evita refetch waterfall + layout shift (React Query v5, nativo, cero bytes extra).
- `staleTime` no se toca; evita fetches duplicados. Paginación es O(1) renders, sin `Array.from(pages)`.
- `focus()` y `aria-live` son DOM nativo, sin lib.

## Testing
- Vitest `products-browser.test.tsx`: añade casos — (a) paginar mantiene productos visibles (placeholderData), (b) `aria-busy`/`aria-live` presente, (c) foco se mueve al heading tras paginar. Reusa `TestProviders` + `nav` mock existente.
- `npm run test:web` green, `npm run test:api` untouched (no API change). E2E no requerido (flujo ya cubierto por paginación existente).

## Verificación
- `npm run test:web` y `npm run test:api` 100% pass antes de merge.
- Manual: paginar 1→2, grilla no desaparece, anuncio "Página 2 de 3", foco en heading.
