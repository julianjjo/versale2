# tokenStore BroadcastChannel dup removal — Design (ponytail ultra)

## Scope
Single 1-file winner: `apps/web/src/lib/token.ts` (-12L net, -24%). Delete duplicated auth sync via `BroadcastChannel` (`AUTH_CHANNEL="versale-auth"`) — native `storage` + `CustomEvent` already cover cross-tab + same-tab correctly per web platform. No caller diff, no new deps, zero behavior change for current auth flow.

## Architecture

- **Before** (49L): `token.ts` syncs auth via *both* `storage`+`CustomEvent` *and* `BroadcastChannel`.
  - `const AUTH_CHANNEL = "versale-auth"`
  - `emitAuthChange()`: `window.dispatchEvent(CustomEvent)` + `try{ new BroadcastChannel(AUTH_CHANNEL).postMessage().close() }catch{}`
  - `subscribe(onChange)`: `let bc; try{ bc=new BroadcastChannel(AUTH_CHANNEL); bc.onmessage=()=>onChange() }catch{}` + `window.addEventListener("storage", storageHandler)` + `window.addEventListener(AUTH_EVENT, customHandler)` + cleanup `if(bc) bc.close()`.

- **After** (~37L, -12L): keep `storage` + `CustomEvent` only.
  - Delete `const AUTH_CHANNEL` line (1L).
  - In `emitAuthChange()`: delete `try{new BroadcastChannel...postMessage...close}catch{}` — keep only `window.dispatchEvent(new CustomEvent(AUTH_EVENT))` + `typeof window` guard.
  - In `subscribe(onChange)`: delete `let bc`, `try{new BroadcastChannel...onmessage}catch{}`, `if(bc) close` — keep only `storageHandler` + `customHandler` listeners for `"storage"` and `"versale:auth-change"` with proper `removeEventListener` cleanup.
  - Add ponytail ceiling comment near top: `// ponytail: deleted BroadcastChannel dup; storage+CustomEvent cover cross/same-tab; restore BC if need instant cross-tab without storage round-trip`
  - Export shape unchanged: `tokenStore {get,set,clear,subscribe}` — zero caller diff.

- **Rollback**: restore `AUTH_CHANNEL` + `BroadcastChannel` blocks verbatim from 18a50d3 if instant cross-tab without `localStorage` round-trip is needed.

- **Files touched**: 1 — `apps/web/src/lib/token.ts` only. `git diff --stat` shows `1 file changed, ~12 deletions(-)`.

## Data flow
`AuthProvider` / `useAuth` → `tokenStore.set(token)` / `clear()` → `writeString/removeKey(TOKEN_KEY)` to `localStorage` → `emitAuthChange()` → `window.dispatchEvent(CustomEvent("versale:auth-change"))` for same-tab subscribers; cross-tab via `StorageEvent("storage")` with `key===TOKEN_KEY`. `tokenStore.subscribe(onChange)` registers `storageHandler` (filtered `e.key===TOKEN_KEY`) + `customHandler` on `AUTH_EVENT`; cleanup removes both. `get()` reads via `readString(TOKEN_KEY)` (`storage.ts` canonical).

## Components
- `tokenStore` — pure client utility; `get/set/clear/subscribe` unchanged signatures.
- `readString/writeString/removeKey` from `./storage` — unchanged.
- Consumers (`lib/auth.tsx`, `lib/auth-events`, `api.ts` header injection) — unchanged; verified via grep `tokenStore` unchanged.

## Testing strategy
- Read `apps/web/src/lib/__tests__/token.test.ts` — covers `get/set/clear/overwrite/CustomEvent/storage` (6 tests). No `BroadcastChannel` assertion needed; suite stays green without modification.
- Run `npm run test:web` (expect 43 suites / 548 PASS) and `npm run test:api` (47 / 714 PASS) from repo root — both 100% green.
- Verify lint: `npx eslint apps/web/src/lib/token.ts` (note root eslint 8 vs web 9 mismatch may need CI `npm ci` to pass; ensure file is prettier-clean and check CI Lint Web proves green).
- Verify isolation: `grep -r tokenStore apps/web/src` — consumers unchanged; no new export.
- `git diff --stat` = `1 file changed, 12 deletions(-)` (plus 1 ponytail comment).

## Ponytail ladder rationale
1. Need it? No — `storage` event is native cross-tab, `CustomEvent` is native same-tab; `BroadcastChannel` is speculative duplication (YAGNI rung 1).
2. Already in codebase? `storage` + `CustomEvent` already implemented — reuse.
3. Stdlib/platform does it? Yes — Web Platform covers both channels natively.
4. Ladder rung: **native platform (4)** — `StorageEvent` + `CustomEvent` vs redundant `BroadcastChannel` API.
5. Deletion before addition: delete 12L, add 1 ceiling comment — shortest diff wins.

## Ponytail ceiling
`// ponytail: deleted BroadcastChannel dup; storage+CustomEvent cover cross/same-tab; restore BC if need instant cross-tab without storage round-trip` documents trade-off. Upgrade: restore `BroadcastChannel("versale-auth")` if sync must fire *without* localStorage write round-trip or across contexts that don't share storage.

## Security / Perf
- Security: token remains in `localStorage` under `versale_token`; sync channel reduction reduces attack surface (one less postMessage vector). No trust boundary change, no injection — PASS.
- Perf: removes per-call `BroadcastChannel` alloc + per-subscribe channel alloc/close; `storage` + `CustomEvent` are cheaper (no channel instantiation). Negligible but not regression — PASS.
- No new deps, 1 file, Spanish UI unaffected (lib only).

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, no new abstraction/interface/dep, export shape stable — PASS.
- **Security**: display/sync only, no user input to parser, removes extra postMessage channel — PASS (slightly tighter).
- **Perf**: deletes channel alloc per `emit` + per `subscribe`, inline events only — PASS (or neutral).
- **Test**: `token.test.ts` 6 green; web 43/548 + api 47/714 green; no BC mock needed — PASS.
- **Action**: no design change needed; ceiling comment already documents restore path.

## Verification
- Diff 1 file, -12L net (-24%).
- `npm run test:web` + `npm run test:api` 100% green before PR.
- `npx eslint` clean on changed file (or CI proves); prettier unchanged.
