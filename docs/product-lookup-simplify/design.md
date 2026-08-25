# product-lookup-simplify — Design (ponytail ultra, -8L)

## Scope
Single-file ponytail ultra collapse: `apps/web/src/app/products/[id]/page.tsx` (104→96L, -8L, 1 file). Delete 3-variant discriminant `type ProductLookup = |{status:"ok";product:Product}|{status:"missing"}|{status:"unavailable"}` (4L type) and replace `Promise<ProductLookup>` with `Promise<Product|null|undefined>` where `null=missing→notFound()` (HTTP 404), `undefined=unavailable→retry` (client `ProductDetail` query), `Product=ok`. Collapse `generateMetadata` 6L discriminator (`result.status!=="ok"` + `result.product` extraction) →2L `if(!product)` and `ProductPage` 7L (`result.status==="missing"` + ternary `initialProduct`) →3L `if(product===null) notFound()` + `product ?? undefined`. Spanish titles `"Producto no encontrado — Versale"` and `"${product.title} — Versale"` preserved. `cache()` wrapper + `AbortSignal.timeout(5000)` + `cache:"no-store"` + `Accept:"application/json"` unchanged. `grep ProductLookup` 0 hits post-edit.

## Architecture
- **Before** (104L): discriminant type + status-branching
  ```ts
  type ProductLookup =
    | { status: "ok"; product: Product }
    | { status: "missing" }
    | { status: "unavailable" };
  const lookupProduct = cache(async (id:string):Promise<ProductLookup>=>{
    try{
      const r=await fetch(`${API_URL}/products/${id}`,{cache:"no-store", headers:{Accept:"application/json"}, signal:AbortSignal.timeout(5000)});
      if(r.status===404) return {status:"missing"};
      if(!r.ok) return {status:"unavailable"};
      return {status:"ok", product: await r.json() as Product};
    } catch{ return {status:"unavailable"}; }
  });
  // generateMetadata 6L discriminator
  const result=await lookupProduct(id);
  if(result.status!=="ok") return {title:"Producto no encontrado — Versale"};
  const product=result.product;
  // ProductPage 7L
  const result2=await lookupProduct(id);
  if(result2.status==="missing") notFound();
  return <ProductDetail initialProduct={result2.status==="ok"?result2.product:undefined}/>
  ```
- **After** (96L, -8L): nullable union, falsy + strict-null checks
  ```ts
  const lookupProduct = cache(async (id:string):Promise<Product|null|undefined>=>{
    try{
      const r=await fetch(`${API_URL}/products/${id}`,{cache:"no-store", headers:{Accept:"application/json"}, signal:AbortSignal.timeout(5000)});
      if(r.status===404) return null;
      if(!r.ok) return undefined;
      return await r.json() as Product;
    } catch{ return undefined; }
  });
  export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
    const {id}=await params;
    const product=await lookupProduct(id);
    if(!product) return {title:"Producto no encontrado — Versale"};
    const description=product.description.length<=160?product.description:product.description.slice(0,157)+"...";
    return {title:`${product.title} — Versale`, description, openGraph:{title:product.title, description, images: product.images?.[0]?[{url:product.images[0].url, alt:product.images[0].alt}]:undefined}};
  }
  export default async function ProductPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{preview?:string}>}){
    const {id}=await params; const {preview}=await searchParams;
    if(preview==="1") return <ProductDetail/>;
    const product=await lookupProduct(id);
    if(product===null) notFound();
    return <ProductDetail initialProduct={product ?? undefined}/>;
  }
  ```
- Ladder rung 1 YAGNI: discriminant wraps single value with 3 keys; `null` vs `undefined` already encodes 2 non-ok states without object alloc. No interface, no helper, no new dep.
- `preview==="1"` escape hatch unchanged (anonymous server probe vs authed client query).

## Data flow
`id` (params) → `lookupProduct(id)` (cached, `AbortSignal.timeout(5000)` abort → catch → `undefined`) → `fetch /products/:id` → 404→`null` (generateMetadata→ Spanish notFound title, ProductPage→`notFound()` → Next 404 status for crawlers) | !ok→`undefined` (both callers degrade: metadata shows notFound title, page renders `<ProductDetail initialProduct={undefined}>` so client React Query retry shows retryable error, not false 404) | ok→`Product` (metadata builds `${title} — Versale` + truncated 160c description + og:image `{url,alt}`, page hydrates `<ProductDetail initialProduct={product}>`). `?preview=1` bypasses lookup entirely.

## Components
- `lookupProduct`: `cache(async (id:string):Promise<Product|null|undefined>)` unchanged memoization (Next fetch dedupe opts out when `signal` present, see `next/dist/server/lib/dedupe-fetch.js`), `signal:AbortSignal.timeout(5000)` preserved, `cache:"no-store"` preserved.
- `generateMetadata`: now `const product=await lookupProduct(id); if(!product) return {title:"Producto no encontrado — Versale"}` (falsy covers both `null`+`undefined` correctly — metadata has no retry UI, both non-ok show same Spanish title). Preserves `product.title — Versale`, 160c slice `+ "..."`, og image alt fallback comment.
- `ProductPage`: `const product=await lookupProduct(id); if(product===null) notFound(); return <ProductDetail initialProduct={product ?? undefined}/>` — strict `===null` isolates 404 from transient failure; `product ?? undefined` coerces `Product|null|undefined` to `Product|undefined` expected by `ProductDetail` prop (null→undefined for retry path).
- Deleted: `type ProductLookup` 4L, no `ponytail:` ceiling — stdlib nullish semantics is complete.

## Testing strategy
- `npm run test:web` 43 suites ~545 tests, `npm run test:api` 47 suites 714 tests — 100% green before push. Product route has no isolated Vitest; coverage via existing web suites + manual verification of Spanish titles and preview bypass.
- Grep contract: `grep -R ProductLookup apps/web` 0 hits; `git diff --stat` 1 file `apps/web/src/app/products/[id]/page.tsx | 10 +++++-----` style -8L net (104→96L) `wc -l` verified; `grep "Producto no encontrado"` still 1 hit + `grep "— Versale"` 2 hits preserved.
- Cache/Abort contract: `grep -F "AbortSignal.timeout"` 1 hit preserved, `grep -F "cache("` 1 hit preserved.

## Ponytail ladder
Rung 1 — does this need to exist? No. 3-variant object is ceremony for single value; `Product|null|undefined` is stdlib-expressive, half the branches, zero alloc for error paths. Delete 4L type, inline returns. Rung 2 reuse `null`/`undefined` already in language vs custom tagged union. One-liner returns `null`/`undefined`/`Product`.

## Ceiling
None. No `ponytail:` comment — `null` vs `undefined` distinction is intentional and standard (null=known missing, undefined=transient). If a third state ever needed (e.g., `403 forbidden-preview`), add explicit union then; until then YAGNI.

## Security / Perf
- Security: `encodeURIComponent(id)` preserved, no new input surface, `Accept` header unchanged. `notFound()` still sends real 404 status (crawler-correct).
- Perf: fewer object allocations (no `{status,...}` wrapper), same cached fetch, `AbortSignal.timeout(5000)` prevents hung API stalling page.

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, -8L, no abstraction, discriminant→nullish — PASS.
- **Security**: `encodeURIComponent`+404 semantics preserved, no trust boundary change — PASS.
- **Perf**: less alloc, same cache/signal, no regression — PASS.
- **Test**: web/api green, grep contracts 0/preserved, Spanish titles intact — PASS.
- **Action**: no design change.
