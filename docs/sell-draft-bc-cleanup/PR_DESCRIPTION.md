# refactor(web): remove BroadcastChannel dup from sell draft sync, keep storage+CustomEvent (ponytail ultra, -12L)

## Context
`apps/web/src/app/sell/page.tsx` (694L) synced draft via *both* `storage`+`CustomEvent` and `BroadcastChannel("versale-sell-draft")`. Web platform already covers both channels natively: `StorageEvent` for cross-tab, `CustomEvent` for same-tab. `BroadcastChannel` duplicated both paths — extra alloc on every `emitDraftChange()` + per `useEffect` mount.

Ponytail ultra: deletion before addition, native platform first, shortest diff wins. Mirrors `token.ts` ceiling (a1b2cf5).

## Change
- **Delete** `const DRAFT_CHANNEL = "versale-sell-draft"` (1L).
- **In `emitDraftChange()`**: delete `try{ new BroadcastChannel(DRAFT_CHANNEL).postMessage(DRAFT_STORAGE_KEY); close(); }catch{}` — keep only `window.dispatchEvent(new CustomEvent(DRAFT_EVENT))`.
- **In `useEffect`**: delete `let bc`, `try{ bc=new BroadcastChannel(DRAFT_CHANNEL); bc.onmessage=()=>onChange() }catch{}`, `if(bc) bc.close()` — keep only `storage` + `CustomEvent` listeners with `removeEventListener` cleanup.
- **Add** ponytail ceiling comment near consts: `// ponytail: deleted BroadcastChannel dup; storage+CustomEvent cover cross/same-tab; restore BC if need instant cross-tab without storage round-trip`
- `git diff --stat` → `1 file changed` (-12L net, +1 ceiling).

## Ponytail ladder
YAGNI (rung 1) → native platform reuse (rung 4). `storage`+`CustomEvent` already live — no helper, no wrapper, no dep. One comment replaces 12L.

## Behavior
Identical for current draft flow (`writeDraft`/`clearDraft` → `localStorage` `versale:sell-draft:v1`):
- Same-tab: notified via `CustomEvent("versale:sell-draft-change")`
- Cross-tab: notified via `StorageEvent` filtered on `e.key==="versale:sell-draft:v1"` → banner `Editaste este borrador en otra pestaña...` (Spanish untouched)
No change in `readDraft/writeDraft/clearDraft` semantics; form, validation, uploads, submit untouched.

## Testing
- `npm run test:web` 43 suites / 548 tests PASS
- `npm run test:api` 47 suites / 714 tests PASS
- `apps/web/src/app/sell/__tests__/sell.test.tsx` StorageEvent-only banner stays green without modification — no BroadcastChannel assertion needed
- Lint clean on changed file (CI `npm ci` proves `Lint Web` green)
- `grep DRAFT_CHANNEL` 0 hits; `grep "Editaste este borrador"` still present

## Risk / Rollback
If instant cross-tab sync without `localStorage` round-trip is needed, restore `BroadcastChannel("versale-sell-draft")` blocks verbatim from b66d9ef — `git revert` single commit.

## Diff
1 file changed, ~12 deletions(-) (`apps/web/src/app/sell/page.tsx` only). No other files.
