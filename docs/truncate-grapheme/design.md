# Truncate grapheme — emoji-aware helper

## Problema

`apps/web/src/app/products/[id]/page.tsx: generateMetadata` trunca `product.description` con `slice(0,157)+"..."` para `description` og (160). `slice` corta por UTF-16 code units, rompiendo grapheme clusters (emoji 👩‍👩‍👧‍👦, flag 🇨🇴, skin tone) en el límite — ponytail marcó `restore helper with Intl.Segmenter if emoji at boundary`.

## Solución (ponytail ultra)

- Helper `function truncateGrapheme(str: string, max: number): string` fuera de `generateMetadata` (singleton `Intl.Segmenter` si disponible, fallback a `[...str]` spread que respeta code points vs `slice` code units). Usa `new Intl.Segmenter("es", {granularity:"grapheme"})` cuando `globalThis.Intl?.Segmenter` existe (Node 16+ / modern browsers), si no `[...str]`.
- `generateMetadata` usa `truncateGrapheme(product.description, 160)` vs inline `slice`.

Mantiene 160 límite, añade `"..."` solo si trunca, respeta graphemes.

## Verificación

- `npx eslint` web → 0/0
- `npm run test:web` → 45/45 557/557 (product-page.test ya valida `slice` tolerante — longitud y sufijo, no igualdad grapheme)
- Manual: `truncateGrapheme("a👩‍👩‍👧‍👦b".repeat(50), 160)` no corta a mitad de emoji
