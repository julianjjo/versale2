# Cache Hot Catalog — Design

## Goal
Reduce hot catalog load via edge/browser caching (ponytail ultra).

## API — GET /products (findAll)
- Add `Cache-Control: public, max-age=30, stale-while-revalidate=60`
- Public data only; no user auth. Safe to cache at CDN/browser.

## API — GET /products/facets (getFacets)
- Same header. Facets change rarely, SWR tolerates staleness.

## API — GET /products/suggested-price
- Same header. Derived from public aggregates, no PII.

## Scope Excluded
- Private routes (/mine, admin/*, pause, favorites) — no cache.
- Keeps auth correctness; only public GETs cached.

## Web — ProductsBrowser
- `useQuery(["products", filters], staleTime: 30_000)`
- Prevents refetch on focus/mount within 30s; aligns with API max-age.
- `keepPreviousData` already; facets already 5m staleTime.

## Invalidation
- SWR 60s allows background revalidate; mutations unaffected.
- No manual purge needed for ultra scope.

## Testing Strategy
- API: controller metadata reflects @Header on three methods.
- Web: no behavior change beyond dedup window.
- DB-safe: jest --runInBand single worker avoids SQLITE_BUSY.

## Risks
- Stale results <60s acceptable for catalog (not orders/cart).
- CDN respects public header; no private leak.

## Verification
- Check response headers on catalog endpoints.
- Verify web query not refetching within 30s.
