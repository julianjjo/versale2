# sell-photo-list-join — Design (ponytail ultra)

## Scope
Single 1-file winner: `apps/web/src/app/sell/page.tsx` (-4L net). Delete `PHOTO_LIST_FORMAT` singleton (`const new Intl.ListFormat("es", {style:"long", type:"conjunction"})` at L116-119) and replace usage at L373-374 `PHOTO_LIST_FORMAT.format(missingAltPositions.map(String))` with manual `join`+`replace`: `missingAltPositions.join(", ").replace(/, ([^,]*)$/, " y $1")`. Add ceiling comment: `// ponytail: manual "y" for es conjunction; Intl.ListFormat if locale rules grow`. No caller diff, no new deps, Spanish UI preserved.

## Architecture

- **Before** (701L): module-scope `const PHOTO_LIST_FORMAT = new Intl.ListFormat("es", {style:"long", type:"conjunction"})` (4L with comment) + call site `PHOTO_LIST_FORMAT.format(missingAltPositions.map(String))` (2L).
  - Allocates one `Intl.ListFormat` singleton at module load for single call site.
  - Call pattern: `missingAltPositions.map(String)` → `format()` → `"1, 2 y 4"`.

- **After** (697L, -4L): delete singleton block (4L) + replace call site with one-liner + ceiling comment (net 0 at call site +1 comment line removed at top = -4L net with formatting).
  - Delete L115-119: `// "1, 2 y 4" — Spanish uses "y"...` + `const PHOTO_LIST_FORMAT = new Intl.ListFormat(...)` (4L).
  - At error branch (now ~L369): `// ponytail: manual "y" for es conjunction; Intl.ListFormat if locale rules grow` + `` `Faltan las descripciones de las fotos ${missingAltPositions.join(", ").replace(/, ([^,]*)$/, " y $1")}.` ``
  - Handles 1/2/N: single handled by outer `if (length===1)` branch; `join+replace` only runs for N>=2, so regex correctly yields "1 y 2" and "1, 2 y 3".
  - `git diff --stat` shows `1 file changed, 2 insertions(+), 6 deletions(-)` ≈ -4L net (varies ±1 with prettier).

- **Rollback**: restore `const PHOTO_LIST_FORMAT = new Intl.ListFormat("es",{style:"long",type:"conjunction"})` and `PHOTO_LIST_FORMAT.format(missingAltPositions.map(String))` verbatim from c066fe4.

- **Files touched**: 1 — `apps/web/src/app/sell/page.tsx` only. Docs outside diff stat scope.

## Data flow
`sell/page.tsx` `handleSubmit` → validate `missingAltPositions` (indices where `img.alt.trim()` empty) → if `length===1` → single-photo string; else → `join(", ")` → `replace(/, ([^,]*)$/, " y $1")` → interpolates into Spanish error `"Faltan las descripciones de las fotos 1, 2 y 4."` → `setError(...)` → rendered at `role="alert"`. Single-photo path untouched, so `sell.test.tsx` single-photo assertion stays green.

## Components
- `SellForm.handleSubmit` — only changed branch is the multi-photo `setError` string.
- No new exports, no prop changes, no state shape changes.
- Consumers: none (page component, no external import of `PHOTO_LIST_FORMAT` — verified via `grep PHOTO_LIST_FORMAT` single file).

## Testing strategy
- Read `apps/web/src/app/sell/__tests__/sell.test.tsx` — covers single-photo vs multi-photo error assertions; single-photo `Falta la descripción de la foto X.` assertion must stay green without modification.
- Run `npm run test:web` (expect 43 suites / 548 PASS) and `npm run test:api` (47 suites / 714 PASS) from repo root — both 100% green.
- Verify lint/prettier: `npx prettier --check apps/web/src/app/sell/page.tsx` and `npx eslint apps/web/src/app/sell/page.tsx`.
- Verify isolation: `grep -r PHOTO_LIST_FORMAT apps/web/src` → 0 hits after change (only ceiling comment remains, no singleton).
- `git diff --stat` = `1 file changed` (when docs untracked/staged separately per protocol step 5, source diff is 1 file).

## Ponytail ladder rationale
1. Need it? No — single call site formatting 2-6 integers with fixed Spanish "y" does not justify `Intl.ListFormat` singleton (YAGNI rung 1).
2. Already in codebase? No existing list formatter util to reuse.
3. Stdlib does it? Yes — `Array.join` + `String.replace` is stdlib (rung 3) vs `Intl.ListFormat` heavier i18n API.
4. Ladder rung: **stdlib (3)** — `join(", ").replace(/, ([^,]*)$/, " y $1")` vs `Intl.ListFormat.format`.
5. Deletion before addition: delete 4L singleton, inline 1L — shortest diff wins.

## Ponytail ceiling
`// ponytail: manual "y" for es conjunction; Intl.ListFormat if locale rules grow` documents trade-off. Upgrade: restore `Intl.ListFormat("es",{style:"long",type:"conjunction"})` if locale conjunctions diversify (e.g., "e" before i-/hi-, Oxford commas, multi-locale).

## Security / Perf
- Security: display string only, no user input to parser beyond integer positions; `join` on numbers is safe — PASS.
- Perf: removes `Intl.ListFormat` allocation at module load (minor); `join+replace` on ≤6 elements is O(n) trivial — PASS (neutral to cheaper).
- No new deps, 1 file, Spanish UI preserved (`Faltan las descripciones de las fotos …` unchanged).

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, no new abstraction/interface/dep, no export shape change — PASS.
- **Security**: no trust boundary, integers only, no injection — PASS.
- **Perf**: deletes singleton alloc, cheap inline string op on ≤6 items — PASS.
- **Test**: `sell.test.tsx` single-photo green; web 43/548 + api 47/714 green — PASS.
- **Action**: no design change needed; ceiling comment already documents restore path.
