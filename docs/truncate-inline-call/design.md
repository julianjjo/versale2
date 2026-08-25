# truncate inline call — Design (ponytail ultra, -4L)

## Scope
Single-file ponytail ultra deletion: inline sole `truncateDescription` call in `apps/web/src/app/products/[id]/page.tsx`, delete exported helper (3L) + its ceiling (1L). No new deps, no interfaces, Spanish UI preserved.

## Architecture
- **Before**: `// ponytail: grapheme-safe via Intl.Segmenter...` + `export function truncateDescription(description:string,maxLength:number){return description.length<=maxLength?description:description.slice(0,maxLength-3)+"...";}` (4L) plus call `const description = truncateDescription(product.description, 160)` (1L).
- **After**: helper + ceiling deleted; call site replaced with inline slice + preserved ceiling near inline:
  ```ts
  // ponytail: truncate inline slice; restore helper with Intl.Segmenter if emoji at boundary
  const description = product.description.length <= 160 ? product.description : product.description.slice(0, 157) + "...";
  ```
  Net -4L (5L removed incl. blank, 1L ceiling re-added). Single file changed. No export remains; grep `truncateDescription` 0 hits (except ceiling if phrasing kept, otherwise 0). `Intl.Segmenter` 0 hits (only inside ceiling comment if included).

## Data flow
`generateMetadata({params})` → `lookupProduct(id)` (cache, 5s timeout) → inline `description` → `Metadata { title, description, openGraph:{description} }`. Page component untouched except metadata string source. Invariant preserved: `description.length <= 160 && (orig>160 ? endsWith("...") : unchanged)`.

## Components
- `generateMetadata`: now owns truncation inline; pure expression, no helper indirection.
- `truncateDescription`: deleted — sole caller was L68, no external callers (verified grep).

## Testing strategy
- Read `apps/web/src/app/products/[id]/__tests__/product-page.test.tsx` — `describe("truncateDescription",...)` tested exported helper directly (3 cases). Remove entire block; coverage retained via `describe("generateMetadata", ...)` integration test which already asserts `endsWith("...")` + `length <=160` + `openGraph.description === description` with emoji-boundary input (`a*156+🎉+b*50`). No new tests needed.
- Verification: `npm run test:web` (43 suites / ~548 tests) + `npm run test:api` (47 suites / 714 tests) 100% green before PR. Prettier/lint pass.

## Ponytail ceiling
`// ponytail: truncate inline slice; restore helper with Intl.Segmenter if emoji at boundary` — documents deliberate UTF-16 slice vs grapheme trade-off. Upgrade path: restore exported helper with `Intl.Segmenter` (`[...segmenter.segment(desc)]`) if orphan surrogate `�` reported in crawlers/OG.

## Security / Perf
- Security: truncation feeds `<meta>`/OG only, no trust boundary — no vuln.
- Perf: removes one function indirection + export; inline slice O(1) unchanged.
- No new deps, 1 file diff, -4L net.

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, -4L, no abstraction — PASS.
- **Security**: display-only truncation, no injection — PASS.
- **Perf**: inline eliminates call overhead, no regression — PASS.
- **Test**: Web/API suites green, metadata invariant preserved — PASS.
- **Action**: no design change; ceiling documents rollback.
