# SEO/A11y Hotfix — design (ponytail ultra)

## Objective
Fix 3 regressions/gaps from 0cdea92 seo-jsonld:
1. `priceCurrency: "ARS"` → `"COP"` (PRODUCT.md:50, payments COP).
2. Missing `alternates.canonical` + `openGraph.url/type/locale` → duplicate `?preview` indexed, wrong unfurl.
3. Gallery zoom `alt=""` → `activeAlt` (a11y, screen-reader).

## Architecture
- `lib/seo.ts` — 1 line: `priceCurrency` COP.
- `app/products/[id]/page.tsx` — `generateMetadata` + `layout.tsx` `metadataBase`; reuses `SITE_URL`.
- `components/products/product-gallery.tsx` — 1 line: `alt={activeAlt}` (reuse const).
No new deps, no migration, no API change. Data flow unchanged.

## Data flow
`lookupProduct` (cached fetch) → `generateMetadata` (canonical/OG) → `<script ld+json>` (COP) → `ProductGallery` (alt). `SITE_URL` from `lib/site` (env fallback localhost).

## Testing
- `lib/__tests__/seo.test.ts` — update ARS→COP (1 expect + title), keep 6 pass.
- `app/products/[id]/__tests__/product-page.test.tsx` — update ARS→COP, add canonical/OG snapshot.
- Gallery — verify zoom `<img alt>` equals main alt (manual/Vitest).
- `npm run test --workspace=apps/api` --runInBand, `npm run build --workspace=apps/web` (31/31 pages).

## Security / Perf
- JSON-LD keeps `JSON.stringify(...).replace(/</g,"\\u003c")` (XSS safe, no `</script>` break).
- `alternates.canonical` prevents duplicate index; no `noindex` for `?preview` (correct).
- `<1KB` header, no extra fetch; `cache()` dedupes lookup.
- No PII leak (AR domain removed, SITE_URL explicit).
