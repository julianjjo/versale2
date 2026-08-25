# refactor(web): delete dead FORM_FIELDS const from sell page (ponytail ultra, -11L)

## Summary
Deletes dead `const FORM_FIELDS = [...] as const` (11L, L110-120, `apps/web/src/app/sell/page.tsx`). Single hit is definition only (`git grep FORM_FIELDS` 1→0). No consumer, not exported. Size/category/condition already validated via `SIZES`/`PRODUCT_CATEGORIES`/`CONDITION_OPTIONS`.

## Changes
- `apps/web/src/app/sell/page.tsx`: delete `FORM_FIELDS` block (11L incl. `as const` + trailing blank). Net 683→672L, `git diff --stat` 1 file.

## Why (ponytail ultra, rung 1 YAGNI)
Dead code. Ladder check: no call site → no stdlib/platform/dependency rung — delete outright. If field enumeration is ever needed, derive from `keyof typeof form` or Zod schema. No `ponytail:` ceiling needed.

## Verification
- `git grep FORM_FIELDS` 0 hits post-edit.
- Spanish UI preserved (labels, errors, hints unchanged).
- Draft `storage` + `CustomEvent` + `writeDraft`/`clearDraft` unchanged.
- `npm run test:web` 43 suites ~545 pass, `npm run test:api` 47 suites 714 pass (100% green before PR).

## Risk
None — const was inert. No runtime, no export, no type import.

## Diff stat
`apps/web/src/app/sell/page.tsx | 11 deletions(-)`
