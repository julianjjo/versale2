# SEO JSON-LD Product/Offer — Design

## Objective
Google Rich Results for Product detail (`/products/[id]`). Single server-rendered `<script type="application/ld+json">` with schema.org Product + Offer. No API change, no new route.

## Architecture
- Helper `buildProductJsonLd(product, siteUrl)` in `apps/web/src/lib/seo.ts` — pure function, no I/O.
- Injected in `apps/web/src/app/products/[id]/page.tsx` (server component) via `dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}`.
- Falls back to `SITE_URL` from `@/lib/site` (`NEXT_PUBLIC_SITE_URL` or `http://localhost:3000`). No extra fetch.

## Data Flow
`lookupProduct(id)` → `Product` → `buildProductJsonLd(product, SITE_URL)` → JSON object → `JSON.stringify` → `<script>`. Preview mode (`?preview=1`) skips lookup, no JSON-LD. 404/API-down → no script.

## Schema Mapping
- `@context: https://schema.org`, `@type: Product`, `name=title`, `description`, `image=[urls]` (first or array), `url=${siteUrl}/products/${id}`
- `offers: { @type: Offer, price, priceCurrency: "ARS", availability, url, seller: { @type: Organization, name } }`
- Availability: `AVAILABLE→InStock`, `SOLD→SoldOut`, `WITHDRAWN→Discontinued`, default `OutOfStock`.

## Components
One helper + one insertion. No client effect, no hydration mismatch.

## Testing
- `lib/seo.test.ts`: 5 unit cases — AVAILABLE/InStock, SOLD/SoldOut, WITHDRAWN/Discontinued, unknown→OutOfStock, image/URL/seller shape.
- Extend `products/[id]/page.test.tsx`: script tag renders when product resolved, absent on 404/API-down, JSON parses, `</script>` injection escaped.

## Security
`JSON.stringify` escapes `</script>` → `\u003c`. No PII beyond public listing. No user input interpolated raw.

## Performance
Pure transform <1KB, zero network, server-only, cacheable via page.

## A11y/SEO
Valid schema per Google Product validator. `priceCurrency` required, `availability` as full URL, `url` canonical. Spanish UI untouched.

## Non-Goals
No breadcrumb, no aggregateRating, no review markup — add when data stable.
