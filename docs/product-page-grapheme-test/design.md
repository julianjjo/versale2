# Product page grapheme test — ponytail debt

## Problema

`apps/web/src/app/products/[id]/__tests__/product-page.test.tsx:204` marcaba `// ponytail: slice tolerante — longitud y sufijo, no igualdad de grafema`. `apps/web/src/app/products/[id]/page.tsx` ya usa `truncateGrapheme` con `Intl.Segmenter` (grapheme-safe), pero el test solo verifica `endsWith("...")` y `length<=160`, tolerante a que el emoji `🎉` (2 code units) sea cortado en half surrogate `�` — no detectaría regresión a `str.slice(0,157)+"..."`.

## Arquitectura

- Single file winner: `apps/web/src/app/products/[id]/__tests__/product-page.test.tsx`
- Reemplazar tolerancia por igualdad grapheme: calcular `expected` con mismo `Segmenter` que `truncateGrapheme` (es, grapheme) y `expect(metadata.description).toBe(expected)`. Mantener checks existentes (length, og equality) como redundancia.
- Eliminar `// ponytail:` comment — debt saldada, test ya no es tolerante.

## Data flow

- Test `nunca deja un surrogate huérfano` → `description = "a"*156 + "🎉" + "b"*50` → `generateMetadata` → `truncateGrapheme` vía Segmenter → `metadata.description` debe ser `graphemeCount<=157` + `"..."` sin `�`.
- Helper local `graphemeTruncate` replica lógica `page.tsx` para expected (no importa test vs src, ambos usan Segmenter).

## Componentes

- `product-page.test.tsx` línea 204: borrar ponytail, añadir `Segmenter` expected y `toBe` strict.
- Sin cambios en `page.tsx` (ya grapheme-safe).

## Testing strategy

- `npm run test:web` → `product-page.test.tsx` 1 test más estricto, sigue 865→865 pero con `toBe` en vez de `endsWith` suelto.
- Manual: con `description` que corta en emoji, `slice` daría `a*156+"�..."` (roto), `Segmenter` da `a*156+"..."` (emoji removido limpio). Test fallaría con slice, pasa con grapheme.

## Riesgos

- Ninguno. Test más estricto solo; si `Intl.Segmenter` no existe (Node <16) fallback a `[...str]` igual que `page.tsx`.

## Ponytail ceiling

- `// ponytail: slice tolerante` eliminado — test ya es grapheme-strict; si descripción pasa a 500 chars, upgrade a `Intl.Segmenter` con `max 160` ya está.
