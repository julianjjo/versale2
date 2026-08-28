# Products browser debounce — ponytail debt no-trigger

## Problema

`apps/web/src/components/products/products-browser.tsx:202` marcaba `// ponytail: 300ms live search, submit fallback` sin upgrade path explícito → `no-trigger` en `PONYTAIL-DEBT.md` (8/18). El `300ms` vive como default en `useDebouncedSearch(delay=300)` no como constante visible en el consumidor, y el fallback `submit` no está documentado como techo.

## Arquitectura

- Single file winner: `apps/web/src/components/products/products-browser.tsx`
- Extraer `const LIVE_SEARCH_DEBOUNCE_MS = 300` junto al `// ponytail:` y pasar explícito `useDebouncedSearch(undefined, LIVE_SEARCH_DEBOUNCE_MS)`.
- Actualizar ponytail a `// ponytail: 300ms live search via useDebouncedSearch, submit fallback; upgrade: server search index if catalog >10k` — convierte `no-trigger` en `with-trigger` (tune debounce o index).

No tocar `useDebouncedSearch` — ya es genérico con `delay` param.

## Data flow

- `ProductsBrowserContent` → `LIVE_SEARCH_DEBOUNCE_MS` → `useDebouncedSearch` → `debouncedSearch` → `applyFilters` (live) + `form onSubmit` (fallback) — sin cambio de comportamiento, solo explicitud.

## Componentes

- `products-browser.tsx:202-203` — constante + ponytail con upgrade + llamada explícita.
- `PONYTAIL-DEBT.md` — no-trigger 8→7.

## Testing strategy

- `npm run test:web` — products-browser no tiene test unitario directo, pero `test:web` 865 pass debe seguir.
- Manual: escribir en buscador → debounce 300ms → `?search=` en URL; `Enter` (submit) aplica inmediato sin esperar debounce.
- `grep -rn ponytail` → `products-browser` ahora con `if catalog >10k` → no-trigger reduce.

## Riesgos

- Ninguno. Cambio de legibilidad, mismo delay.

## Ponytail ceiling

- `// ponytail: 300ms live search via useDebouncedSearch, submit fallback; upgrade: server search index if catalog >10k` — techo explícito, upgrade a índice servidor si catálogo escala.
