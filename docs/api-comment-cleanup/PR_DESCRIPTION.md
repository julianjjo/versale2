refactor(web): remove explanatory comments from api (ponytail ultra, -25L)

- Deletes 8 pure explanatory comment blocks (~25L) in `apps/web/src/lib/api.ts`; zero behavior change.
- Keeps `extractApiError`/`navigator.onLine` fallback literals `"Sin conexión"`/`"Ocurrió un error"`, `api` client, eslint-disable and `/** "blob" */`.
- Net: 1 file, -25L. No ponytail ceiling.

Verification: `npm run test:web` 43 suites, `npm run test:api` 47 suites green in worktree.
