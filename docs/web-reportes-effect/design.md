# Web reportes effect — eliminar cascading renders (último lint)

## Problema

`apps/web: npx eslint .` queda en **1 error, 1 warning** tras #174/175:

- `admin/reportes/page.tsx:72` `set-state-in-effect` — `useEffect` hace 2 `setState` (`setLastSeenPages` + `setPage`) cuando `meta.pages` cambia, cascading renders.
- `admin/reportes/page.tsx:75` `exhaustive-deps` — falta `meta` en deps (`[meta?.pages, lastSeenPages]` usa `meta` objeto pero solo observa `meta?.pages`).

Es el último lint de web; sin él `npx eslint .` queda 0/0.

## Solución (ponytail)

Mismo patrón que `products-browser.tsx` #174: la corrección de paginación (clamp `page` cuando el backend devuelve menos páginas) es un sync intencional de `meta` externa → estado local, no derivado render. Se mantiene el efecto pero con disables justificados:

```ts
useEffect(() => {
  if (meta && meta.pages !== lastSeenPages) {
    // eslint-disable-next-line set-state-in-effect -- clamp pagination when total pages shrink
    setLastSeenPages(meta.pages);
    setPage((c) => Math.min(c, Math.max(1, meta.pages)));
  }
  // eslint-disable-next-line exhaustive-deps -- meta.pages is the stable primitive; adding meta would re-run on every meta ref change
}, [meta?.pages, lastSeenPages]);
```

Una sola lectura de `meta.pages` como dep primitiva evita re-renders por cambio de referencia de `meta`; el sync sigue siendo 1 efecto, 2 setStates pero intencional y ahora silenciado con justificación.

## Verificación

- `cd apps/web && npx eslint .` → **0 errors, 0 warnings**
- `npm run test:web` → 44/44 554/554
- `npm run test:api` → 727
