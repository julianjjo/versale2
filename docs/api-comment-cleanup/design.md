# api-comment-cleanup — ponytail ultra

## Scope
- 1 file: `apps/web/src/lib/api.ts` (~162L → ~137L, net -25L)
- Delete 8 pure explanatory comment blocks; keep behavior.

## Blocks removed (24-25L)
- L5-6 offline fallback intro, L35-37 401 signal, L71-73 Array.isArray join, L80-81 extractApiError shape, L95-96 `any` ergonomics, L108-109 DELETE body, L135-140 offline trust fallback, L152-155 vendored fetch.
- Keep: `extractApiError`, `navigator.onLine`, fallbacks `"Sin conexión"/"Ocurrió un error"`, `api` client, `/* eslint-disable */`, `/** "blob" */` JSDoc.

## No ponytail ceiling
- Pure comment deletion; no logic change, no perf trade-off.

## Verification
- `npm run test:web` 43/545, `npm run test:api` 47/714 in worktree.
- `git diff --stat` shows 1 file, -25L.
