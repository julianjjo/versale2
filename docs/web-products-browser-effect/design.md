# Web products-browser effect — eliminar cascading renders + lint clean

## Problema

`apps/web: npx eslint .` reporta **1 error, 4 warnings**:

- `products-browser.tsx:203` `react-hooks/set-state-in-effect` — `useEffect` hace 2 `setState` sincrónicos (`setSyncedSignature` + `setForm`) cuando `appliedSignature` cambia, causando cascading renders.
- `products-browser.tsx:229` unused disable directive.
- `products-browser.tsx:240` missing deps `applyFilters, filters`.
- `profile/__tests__/profile.test.tsx:34` unused `importOriginal`.
- `sitemap.ts:34` unused `SITEMAP_MAX_URLS`.

## Solución (ponytail)

1. `products-browser.tsx`: eliminar estado duplicado `syncedSignature`; reemplazar con `useEffect(() => setForm(appliedForm), [appliedSignature])` — un solo `setForm`, sin `syncedSignature`. `appliedForm` es derivado estable vía `JSON.stringify`, efecto solo corre cuando la URL realmente cambia (back/forward o `applyFilters`), no en cada render de form editable. Envuelve `applyFilters` en `useCallback` con deps estables (`ownsUrl, router, pathname, query`) y agrega `applyFilters, filters` a deps del efecto `debouncedSearch` — elimina ambos warnings `exhaustive-deps` y el `unused directive`.
2. `profile.test.tsx`: eliminar `const { importOriginal } = ...` no usado.
3. `sitemap.ts`: eliminar `const SITEMAP_MAX_URLS` no usado (valor ya hardcodeado en `slice(0, 500)`).

## Verificación

- `cd apps/web && npx eslint .` → **0 errors, 0 warnings**
- `npm run test:web` → 44/44 554/554
- `npm run test:api` → 727 (sin regresión)
