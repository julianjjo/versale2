# cart-comment-cleanup — Design

## Scope
- Single file: `apps/web/src/app/cart/page.tsx`
- Pure comment deletion (~40 lines), zero logic change.

## Comments removed (pure `//` + JSX comment blocks)
- `RECENT_ORDER_WINDOW_MS` idempotency window (26-30)
- `isUnavailable` rationale (41-44)
- `isProductPageViewable` 404/approved logic (48-54)
- `/orders` pagination rationale (112-118)
- `addressFieldValue` guard (131-134)
- `lastShippingAddress` derivation (139-149)
- Shared error banner guard (175-179)
- `onSettled` refresh rationale (232-234)
- Item 7 redirect note (248-251)
- `checkout` createOrder + `getHttpStatus` recovery gate (253-268)
- Belt-and-suspenders freshness check (280-283)
- `catch` fallthrough (295-297)
- Unavailable total exclusion (369-373)
- `terracotta-deep` contrast token (478-485)
- Order total shipping note (551-553)
- Paused short-circuit (590-593)
- `Sin selector` quantity note (648-651)

## Kept intact
- `export const RECENT_ORDER_WINDOW_MS`
- `isSold`, `isPaused`, `isUnavailable` predicates and all branches
- `isProductPageViewable`, `addressFieldValue`, `lastShippingAddress` logic
- `checkout` mutation recovery (`getHttpStatus`, fresh cart/orders, freshness window)
- Spanish UI strings, exports/imports, component props

## Verification
- `npm run test:web` 43 suites / 545 tests pass
- `npm run test:api` 47 suites / 714 tests pass
- `git diff --stat` shows 1 file changed, ~40 deletions

## Risk
- None functional. Only documentation loss; logic is self-documenting via names (`RECENT_ORDER_WINDOW_MS`, `isUnavailable`, etc.) and existing domain context.

## Ponytail ultra
- Deletion over addition. YAGNI on explanatory comments that duplicate readable code.
