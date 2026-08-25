# sell-draft-bc-cleanup — Design (ponytail ultra)

## Scope
Single 1-file winner: `apps/web/src/app/sell/page.tsx` (-12L net). Delete duplicated draft sync via `BroadcastChannel` (`DRAFT_CHANNEL="versale-sell-draft"`) — native `storage` + `CustomEvent` already cover cross-tab + same-tab correctly per web platform. No caller diff, no new deps, zero behavior change. Spanish banner untouched.

## Architecture

- **Before** (694L): `sell/page.tsx` draft sync uses *both* `storage`+`CustomEvent` *and* `BroadcastChannel`.
  - `const DRAFT_CHANNEL = "versale-sell-draft"`
  - `emitDraftChange()`: `window.dispatchEvent(CustomEvent(DRAFT_EVENT))` + `try{ new BroadcastChannel(DRAFT_CHANNEL).postMessage(DRAFT_STORAGE_KEY).close() }catch{}`
  - `useEffect`: `let bc: BroadcastChannel|null=null; try{ bc=new BroadcastChannel(DRAFT_CHANNEL); bc.onmessage=()=>onChange() }catch{}` + `window.addEventListener("storage", onStorage)` + `window.addEventListener(DRAFT_EVENT, customHandler)` + cleanup `if(bc) bc.close()`.

- **After** (~682L, -12L): keep `storage` + `CustomEvent` only.
  - Delete `const DRAFT_CHANNEL` line (1L).
  - In `emitDraftChange()`: delete `try{new BroadcastChannel...postMessage...close}catch{}` — keep only `window.dispatchEvent(new CustomEvent(DRAFT_EVENT))` + `typeof window` guard.
  - In `useEffect`: delete `let bc`, `try{new BroadcastChannel...onmessage}catch{}`, `if(bc) bc.close()` — keep only `onStorage` + `customHandler` listeners for `"storage"` and `DRAFT_EVENT` with proper `removeEventListener` cleanup.
  - Add ponytail ceiling comment near consts: `// ponytail: deleted BroadcastChannel dup; storage+CustomEvent cover cross/same-tab; restore BC if need instant cross-tab without storage round-trip` (mirrors `token.ts` ceiling).
  - Export shape unchanged: default `SellPage` + `SellForm` internal — zero caller diff.

- **Rollback**: restore `DRAFT_CHANNEL` + `BroadcastChannel` blocks verbatim from b66d9ef if instant cross-tab without `localStorage` round-trip is needed.

- **Files touched**: 1 — `apps/web/src/app/sell/page.tsx` only. `git diff --stat` shows `1 file changed, ~12 deletions(-)`.

## Data flow
`update()→setForm→writeDraft(form)` → `writeJson(DRAFT_STORAGE_KEY, form)` to `localStorage` → `emitDraftChange()` → `window.dispatchEvent(CustomEvent("versale:sell-draft-change"))` for same-tab subscribers; cross-tab via `StorageEvent("storage")` filtered on `event.key===DRAFT_STORAGE_KEY`. `useEffect` registers `onStorage` (filtered) + `customHandler` on `DRAFT_EVENT`; both flip `draftChangedElsewhere=true` → banner `Editaste este borrador en otra pestaña...` (Spanish, untouched). `clearDraft()` same path via `removeKey + emitDraftChange()` after publish.

## Components
- `DRAFT_STORAGE_KEY` / `DRAFT_EVENT` — canonical keys, unchanged.
- `readDraft/writeDraft/clearDraft/emitDraftChange` — storage helpers, BroadcastChannel removed.
- `SellForm` — `useEffect` sync only; form fields, validation, uploads, `handleSubmit` untouched.
- Consumers: none external (page component).

## Testing strategy
- Read `apps/web/src/app/sell/__tests__/sell.test.tsx` — covers StorageEvent-only banner (`dispatchEvent(new StorageEvent("storage", {key:DRAFT_STORAGE_KEY}))`); no BroadcastChannel assertion needed; suite stays green without modification.
- Run `npm run test:web` (expect 43 suites / 548 PASS) and `npm run test:api` (47 / 714 PASS) from repo/worktree root — both 100% green.
- Verify lint: `npx eslint` / CI Lint Web (prettier-clean).
- Verify isolation: `grep -r DRAFT_CHANNEL apps/web/src` → 0 hits after change; `grep "Editaste este borrador"` → still present.
- `git diff --stat` = `1 file changed, 12 deletions(-)` (+1 ponytail comment).

## Ponytail ladder rationale
1. Need it? No — `storage` event is native cross-tab, `CustomEvent` is native same-tab; `BroadcastChannel` is speculative duplication (YAGNI rung 1).
2. Already in codebase? `storage` + `CustomEvent` already implemented — reuse.
3. Stdlib/platform does it? Yes — Web Platform covers both channels natively.
4. Ladder rung: **native platform (4)** — `StorageEvent` + `CustomEvent` vs redundant `BroadcastChannel` API.
5. Deletion before addition: delete 12L, add 1 ceiling comment — shortest diff wins.

## Ponytail ceiling
`// ponytail: deleted BroadcastChannel dup; storage+CustomEvent cover cross/same-tab; restore BC if need instant cross-tab without storage round-trip` documents trade-off. Upgrade: restore `BroadcastChannel("versale-sell-draft")` if sync must fire *without* localStorage write round-trip or across contexts that don't share storage.

## Security / Perf
- Security: draft stays in `localStorage` under `versale:sell-draft:v1`; sync channel reduction reduces attack surface (one less postMessage vector). No trust boundary change — PASS.
- Perf: removes per-call `BroadcastChannel` alloc + per-mount channel alloc/close; `storage` + `CustomEvent` are cheaper — PASS (or neutral).
- No new deps, 1 file, Spanish UI unaffected (banner string preserved verbatim).

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, no new abstraction/interface/dep, export shape stable — PASS.
- **Security**: display/sync only, no user input to parser, removes extra postMessage channel — PASS (slightly tighter).
- **Perf**: deletes channel alloc per `emit` + per `useEffect`, inline events only — PASS (or neutral).
- **Test**: `sell.test.tsx` StorageEvent-only green; web 43/548 + api 47/714 green — PASS.
- **Action**: no design change needed; ceiling comment already documents restore path.

## Verification
- Diff 1 file, -12L net.
- `npm run test:web` + `npm run test:api` 100% green before PR.
- `npx eslint` clean on changed file (or CI proves); prettier unchanged; Spanish banner present.
