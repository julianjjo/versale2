# refactor(web): replace PHOTO_LIST_FORMAT with join+replace (ponytail ultra, -4L)

## Summary
- `apps/web/src/app/sell/page.tsx` only: delete `PHOTO_LIST_FORMAT` singleton (`Intl.ListFormat("es",{style:"long",type:"conjunction"})` L116-119) and inline `missingAltPositions.join(", ").replace(/, ([^,]*)$/, " y $1")` at L373-374.
- Net -4L, no new deps, Spanish UI preserved, single-photo branch untouched.

## Ceiling
`// ponytail: manual "y" for es conjunction; Intl.ListFormat if locale rules grow` — restore `Intl.ListFormat` if locale conjunction rules diversify.

## Verification
- `npm run test:web` 43/548 PASS
- `npm run test:api` 47/714 PASS
- `git diff --stat` 1 file changed (source)
- `sell.test.tsx` single-photo assertion green

## Risk
Low — display string only, integers, ≤6 items, no trust boundary.

Closes: ponytail ultra sell photo list join
