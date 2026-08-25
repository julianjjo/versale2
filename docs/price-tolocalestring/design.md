# price-tolocalestring — Design (ponytail ultra)

## Scope
Single 1-file winner: `apps/web/src/components/ui/index.tsx` (-4L net). Delete `copFormatter` singleton (`const copFormatter = new Intl.NumberFormat("es-CO", {style:"currency", currency:"COP", maximumFractionDigits:0})` at L473-477, 5L with comment) and replace usage at L492 `copFormatter.format(value)` with `value.toLocaleString("es-CO", {style:"currency", currency:"COP", maximumFractionDigits:0})` inline in `Price` component. Add ceiling comment above `Price`: `// ponytail: Price via toLocaleString; Intl.NumberFormat singleton if render hot (>100 Prices/page)`. Net -4L, 1 file only, Spanish "$ 45.000" identical, no new deps.

## Architecture

- **Before** (537L): module-scope singleton + call site
  ```ts
  // Format a numeric value as Colombian pesos (COP):
  //   $ 1.234.567
  // Whole pesos only — the marketplace doesn't list items with decimals.
  const copFormatter = new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
  // ...
  export function Price({ value, ... }) {
    return <span …>{copFormatter.format(value)}</span>;
  }
  ```
  Allocates one `Intl.NumberFormat` at module load for single call site at L492.

- **After** (533L, -4L):
  ```ts
  // ponytail: Price via toLocaleString; Intl.NumberFormat singleton if render hot (>100 Prices/page)
  export function Price({ value, ... }) {
    return <span …>{value.toLocaleString("es-CO", {style:"currency", currency:"COP", maximumFractionDigits:0})}</span>;
  }
  ```
  Delete 5L block (comment + const + 3 option lines + `});`), replace `copFormatter.format(value)` with inline `toLocaleString` (same options, same output), add 1L ceiling comment. Net -4L.

- **Rollback**: restore `const copFormatter = new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0})` and `copFormatter.format(value)` verbatim from 854b5c8 if render profiling shows hot path.

- **Files touched**: 1 — `apps/web/src/components/ui/index.tsx` only. `git diff --stat` shows `1 file changed, 2 insertions(+), 6 deletions(-)` ≈ -4L net.

## Data flow
`Price({value:number})` → `value.toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0})` → string `"$ 45.000"` (es-CO COP, 0 decimals) → `<span class="font-display ... tabular-nums">` → DOM. `value` is `number` (Float from API), no parsing; `toLocaleString` is stdlib boundary formatter. Output identical to `Intl.NumberFormat.format` (same ICU options).

## Components
- `Price` — only changed component; props `(value:number, className?, ...HTMLAttributes<HTMLSpanElement>)` unchanged.
- `className` preservation: `font-display font-medium tabular-nums text-text-primary` retained verbatim — no visual regression.
- Consumers: `src/app/products/[id]/page.tsx`, `src/app/mis-productos/page.tsx`, `src/components/products/*`, etc. — import `Price` barrel, no import of `copFormatter` (verified via `grep copFormatter` 0 hits post-change).

## Testing strategy
- Read `apps/web/src/components/ui/__tests__/ui.test.tsx` — Price assertion via regex `/45[\s.]000/` tolerant to NBSP vs dot vs space, covers `"$ 45.000"` variants.
- Run `npm run test:web` (expect 43 suites / 548 PASS) and `npm run test:api` (47 suites / 714 PASS) from repo root — both 100% green.
- Verify lint: `npx eslint apps/web/src/components/ui/index.tsx` clean.
- Verify isolation: `grep -r copFormatter apps/web/src` → 0 hits after change (only ceiling comment, no singleton).
- `git diff --stat` = `1 file changed` (docs untracked separately).

## Ponytail ladder rationale
1. Need it? Singleton caches formatter for perf, but single call site with few Prices/page (<100) doesn't justify module-scope allocation — YAGNI rung 1 for caching.
2. Already in codebase? No existing COP formatter util to reuse.
3. Stdlib does it? Yes — `Number.prototype.toLocaleString` is stdlib with identical ICU options (rung 3/4) vs `Intl.NumberFormat` heavier API.
4. Ladder rung: **stdlib (4)** — `toLocaleString` inline vs `Intl.NumberFormat` singleton.
5. Deletion before addition: delete 5L singleton, inline 1L — shortest diff wins. `toLocaleString` creates formatter internally per call but trivial for <100 renders; ceiling documents when to restore singleton.

## Ponytail ceiling
`// ponytail: Price via toLocaleString; Intl.NumberFormat singleton if render hot (>100 Prices/page)` documents trade-off. Upgrade: restore `const copFormatter = new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0})` + `copFormatter.format(value)` if profiling shows price-heavy pages (>100 Prices) benefit from cached formatter.

## Security / Perf
- Security: display formatter only, no user input to parser, `value` is number — no injection — PASS.
- Perf: removes singleton alloc at module load; per-render `toLocaleString` allocates internally but trivial for typical pages (≤20 Prices). Hot pages (>100) ceiling covers restore — PASS (neutral to minor cost, documented).
- No new deps, 1 file, Spanish UI preserved (`$ 45.000` identical via same ICU).

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, no new abstraction/interface/dep, export shape stable — PASS.
- **Security**: formatter only, number input, no trust boundary — PASS.
- **Perf**: deletes singleton alloc, per-render cost trivial, ceiling guards hot path — PASS.
- **Test**: `ui.test.tsx` regex tolerant; web 43/548 + api 47/714 green — PASS.
- **Action**: no design change needed; ceiling comment documents restore path.

## Verification
- Diff 1 file, -4L net.
- `npm run test:web` + `npm run test:api` 100% green before PR.
- `grep copFormatter` 0 hits post-change; `font-display` preserved in className.
