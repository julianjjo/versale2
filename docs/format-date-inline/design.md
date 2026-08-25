# format-date-inline — Design (ponytail ultra)

## Scope
Single 1-file winner: `apps/web/src/lib/format-date.ts` (-4L net). Delete `formatter` singleton (`const formatter = new Intl.DateTimeFormat("es-CO", {day:"numeric", month:"long", year:"numeric", timeZone:"UTC"})` 5-6L) and inline `new Date(createdAt).toLocaleDateString("es-CO", {day:"numeric", month:"long", year:"numeric", timeZone:"UTC"})` in `formatPublishDate`. Add ceiling comment `// ponytail: deterministic via toLocaleDateString UTC; Intl.DateTimeFormat singleton if pin needed`. Must keep `timeZone:"UTC"` for hydration determinism. Net -4L, 1 file only, Spanish `"Publicado el ..."` preserved.

## Architecture

- **Before** (14L): module-scope singleton + call site
  ```ts
  // Item 14: fecha de publicación visible. Formato determinista (UTC +
  // es-CO) para que servidor y cliente rendericen el mismo string — una fecha
  // formateada con la zona local del visitante produciría mismatch de
  // hidratación, que es justo lo que este ítem no puede introducir.
  const formatter = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  export function formatPublishDate(createdAt: string): string {
    return `Publicado el ${formatter.format(new Date(createdAt))}`;
  }
  ```
  Allocates one `Intl.DateTimeFormat` at module load for single call site.

- **After** (10L, -4L):
  ```ts
  // Item 14: fecha de publicación visible. Formato determinista (UTC +
  // es-CO) para que servidor y cliente rendericen el mismo string — una fecha
  // formateada con la zona local del visitante produciría mismatch de
  // hidratación, que es justo lo que este ítem no puede introducir.
  // ponytail: deterministic via toLocaleDateString UTC; Intl.DateTimeFormat singleton if pin needed
  export function formatPublishDate(createdAt: string): string {
    return `Publicado el ${new Date(createdAt).toLocaleDateString("es-CO", {day:"numeric", month:"long", year:"numeric", timeZone:"UTC"})}`;
  }
  ```
  Delete 6L block (`const formatter = new Intl.DateTimeFormat...` + options + `});` + blank), replace `formatter.format(new Date(createdAt))` with inline `toLocaleDateString` (same locale/options/output), add 1L ceiling comment. Net -4L.

- **Rollback**: restore `const formatter = new Intl.DateTimeFormat("es-CO",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})` and `formatter.format(new Date(createdAt))` verbatim from 2763e51 if date render profiling shows need to pin formatter.

- **Files touched**: 1 — `apps/web/src/lib/format-date.ts` only. `git diff --stat` shows `1 file changed, 2 insertions(+), 6 deletions(-)` ≈ -4L net.

## Data flow
`formatPublishDate(createdAt: string)` → `new Date(createdAt)` → `toLocaleDateString("es-CO",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})` → string `"15 de agosto de 2026"` (es-CO, UTC) → `Publicado el ${...}` → DOM. Input is ISO string from API, `toLocaleDateString` is stdlib boundary formatter with `timeZone:"UTC"` for hydration determinism (server and client render identical string). Output identical to `Intl.DateTimeFormat.format` (same ICU options).

## Components
- `formatPublishDate` — only changed export; signature `(createdAt: string) => string` unchanged, Spanish prefix `"Publicado el "` preserved verbatim.
- Consumers: `src/app/products/[id]/page.tsx` (product detail publish date), any `formatPublishDate` import — no import of `formatter` (verified via `grep formatter` 0 hits post-change except ceiling comment).
- `timeZone:"UTC"` preserved verbatim in inline options — hydration determinism invariant.

## Testing strategy
- Verify `grep -r formatter apps/web/src/lib/format-date.ts` → 0 hits except ceiling comment (`Intl.DateTimeFormat` in ceiling only).
- Verify `grep -r toLocaleDateString apps/web/src/lib/format-date.ts` → 1 hit with `timeZone:"UTC"`.
- Verify `Publicado el` preserved in file.
- Run `npm run test:web` (expect 43 suites / 548 PASS) and `npm run test:api` (47 suites / 714 PASS) from repo root/worktree — both 100% green.
- Verify lint: `npx eslint apps/web/src/lib/format-date.ts` clean.
- `git diff --stat` = `1 file changed` (docs untracked separately).

## Ponytail ladder rationale
1. Need it? Singleton caches `Intl.DateTimeFormat` for perf, but single call site with few dates/page doesn't justify module-scope allocation — YAGNI rung 1 for caching.
2. Already in codebase? No existing date formatter util to reuse beyond this singleton.
3. Stdlib does it? Yes — `Date.prototype.toLocaleDateString` is stdlib with identical ICU options (rung 3/4) vs `Intl.DateTimeFormat` heavier API.
4. Ladder rung: **stdlib (4)** — `toLocaleDateString` inline vs `Intl.DateTimeFormat` singleton.
5. Deletion before addition: delete 5-6L singleton, inline 1L — shortest diff wins. `toLocaleDateString` creates formatter internally per call but trivial for <100 renders; ceiling documents when to restore singleton.

## Ponytail ceiling
`// ponytail: deterministic via toLocaleDateString UTC; Intl.DateTimeFormat singleton if pin needed` documents trade-off. Upgrade: restore `const formatter = new Intl.DateTimeFormat("es-CO",{day:"numeric",month:"long",year:"numeric",timeZone:"UTC"})` + `formatter.format(new Date(createdAt))` if profiling shows date-heavy pages benefit from cached formatter or need to pin ICU instance.

## Security / Perf
- Security: display formatter only, no user input to parser beyond ISO string → Date, `"Publicado el "` prefix is static Spanish — no injection — PASS.
- Perf: removes singleton alloc at module load; per-call `toLocaleDateString` allocates internally but trivial for typical pages (≤20 dates). Hot pages ceiling covers restore — PASS (neutral to minor cost, documented).
- No new deps, 1 file, Spanish UI preserved, `timeZone:"UTC"` invariant maintained for hydration determinism.
- Hydration: `timeZone:"UTC"` ensures server (UTC) and client (any zone) render same string — mismatch avoided.

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, no new abstraction/interface/dep, export shape stable — PASS.
- **Security**: formatter only, ISO string input, no trust boundary — PASS.
- **Perf**: deletes singleton alloc, per-call cost trivial, ceiling guards hot path — PASS.
- **Test**: `test:web` 43/548 + `test:api` 47/714 green; `grep formatter` 0 hits except ceiling; `timeZone:"UTC"` preserved — PASS.
- **Action**: no design change needed; ceiling comment documents restore path.

## Verification
- Diff 1 file, -4L net.
- `npm run test:web` + `npm run test:api` 100% green before PR.
- `grep formatter` 0 hits post-change except ceiling; `toLocaleDateString` with `timeZone:"UTC"` present; `"Publicado el "` preserved.
