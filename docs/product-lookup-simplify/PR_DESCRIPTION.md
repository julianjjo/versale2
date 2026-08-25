# refactor(web): simplify ProductLookup to null/undefined (ponytail ultra, -8L)

## Summary
Collapse 3-variant discriminant `type ProductLookup = |{status:"ok";product:Product}|{status:"missing"}|{status:"unavailable"}` (4L) in `apps/web/src/app/products/[id]/page.tsx` to `Promise<Product|null|undefined>` (`null=missing→notFound()`, `undefined=unavailable→retry`, `Product=ok`). `generateMetadata` 6L discriminator (`result.status!=="ok"` + `result.product`) →2L `if(!product)`; `ProductPage` 7L (`status==="missing"` + ternary) →3L `if(product===null) notFound()` + `product ?? undefined`. Net 104→96L (-8L) 1 file, `grep ProductLookup` 0 hits, Spanish `"Producto no encontrado — Versale"` preserved, `cache()`+`AbortSignal.timeout(5000)` unchanged.

## Scope
- `apps/web/src/app/products/[id]/page.tsx` only — `git diff --stat` 1 file, -8L.
- `grep -R ProductLookup apps/web` 0 hits after; `grep AbortSignal.timeout` 1 hit preserved; `grep 'cache('` 1 hit preserved.
- No new deps, no interfaces, no config.

## Ponytail ladder
Rung 1 YAGNI — discriminant wraps single value with string key; stdlib `null|undefined` already encodes 2 error states. Rung 5 stdlib nullish vs custom tagged union — shortest diff wins, zero extra alloc. `preview==="1"` escape hatch unchanged.

## Ceiling
None — `null` vs `undefined` is standard (known-missing vs transient). If a third state (e.g., 403) ever needed, reintroduce union then. No `ponytail:` comment.

## Testing
- `npm run test:web` 43 suites 545 PASS, `npm run test:api` 47 suites 714 PASS — 100% green.
- `git diff --stat` 1 file -8L verified (`wc -l` 104→96), Spanish titles preserved, `preview` bypass preserved.

## Multi-angle review
Arch/PASS Security/PASS Perf/PASS Test/PASS

## Rollback
Restore `type ProductLookup` + `Promise<ProductLookup>` + `{status:"missing"}/{status:"unavailable"}/{status:"ok",product}` returns + `result.status` branches from 167c54d.
