# refactor(web): remove BroadcastChannel dup from tokenStore, keep storage+CustomEvent (ponytail ultra, -12L)

## Context
`apps/web/src/lib/token.ts` (49L) synced auth via *both* `storage`+`CustomEvent` and `BroadcastChannel("versale-auth")`. Web platform already covers both channels natively: `StorageEvent` for cross-tab, `CustomEvent` for same-tab. `BroadcastChannel` duplicated both paths — extra alloc on every `emitAuthChange()` + per `subscribe()`.

Ponytail ultra: deletion before addition, native platform first, shortest diff wins.

## Change
- **Delete** `const AUTH_CHANNEL = "versale-auth"` (1L).
- **In `emitAuthChange()`**: delete `try{ new BroadcastChannel(AUTH_CHANNEL).postMessage(TOKEN_KEY); close(); }catch{}` — keep only `window.dispatchEvent(new CustomEvent(AUTH_EVENT))`.
- **In `subscribe(onChange)`**: delete `let bc`, `try{ bc=new BroadcastChannel(AUTH_CHANNEL); bc.onmessage=()=>onChange() }catch{}`, `if(bc) bc.close()` — keep only `storageHandler` + `customHandler` listeners for `"storage"` and `"versale:auth-change"` with proper `removeEventListener` cleanup.
- **Add** ponytail ceiling comment near top: `// ponytail: deleted BroadcastChannel dup; storage+CustomEvent cover cross/same-tab; restore BC if need instant cross-tab without storage round-trip`
- Export shape unchanged: `tokenStore {get,set,clear,subscribe}` — zero caller diff.

## Ponytail ladder
YAGNI (rung 1) → native platform reuse (rung 4). `storage`+`CustomEvent` already live — no helper, no wrapper, no dep. One comment replaces 12L.

## Behavior
Identical for current auth flows (`AuthProvider`/`useAuth` + `localStorage` `versale_token`):
- Same-tab: notified via `CustomEvent("versale:auth-change")`
- Cross-tab: notified via `StorageEvent` filtered on `e.key==="versale_token"`
No change in `get/set/clear/overwrite` semantics.

## Testing
- `npm run test:web` 43 suites / 548 tests PASS
- `npm run test:api` 47 suites / 714 tests PASS
- `apps/web/src/lib/__tests__/token.test.ts` (get/set/clear/overwrite/CustomEvent/storage) stays green without modification — no BroadcastChannel assertion needed
- Lint clean on changed file (CI `npm ci` proves `Lint Web` green)
- `grep tokenStore` consumers unchanged

## Risk / Rollback
If instant cross-tab sync without `localStorage` round-trip is needed (e.g., in-memory only or storage-less contexts), restore `BroadcastChannel("versale-auth")` blocks verbatim from 18a50d3 — `git revert` single commit.

## Diff
1 file changed, ~12 deletions(-), -24% (`apps/web/src/lib/token.ts` only). No other files.
