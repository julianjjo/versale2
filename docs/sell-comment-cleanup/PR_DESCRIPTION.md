# refactor(web): remove explanatory comments from sell page (ponytail ultra, -67L)

## Scope
- Single file: `apps/web/src/app/sell/page.tsx` — pure comment deletion, no logic change.
- Worktree: `.worktrees/sell-comment-cleanup` on `feat/sell-comment-cleanup` from `main@4d13e64`.

## Changes
- Deleted ~67 lines of pure explanatory comments (`//`, `/** */`, JSX `{/* */}`) covering `MAX_FILES`/`UPLOAD_BATCH_SIZE`, `LocalImage` JSDoc, `uploadErrorMessage` mapping, `readPrefill` whitelist, Item 10 prefill vs draft, draft `storage` coordination, `FormData` boundary, picker reset, batch cap, failed-upload guard, alt-text requirement, `clearDraft`, form convention JSX block, `Suspense` boundary.

## Kept
- `// ponytail: deleted BroadcastChannel dup; …`
- `// ponytail: manual "y" for es conjunction…`
- `{/* eslint-disable-next-line @next/next/no-img-element */}`
- All code, types, constants (`SIZES`, `PRODUCT_CATEGORIES`), Spanish labels, upload flow (`FormData` → `/uploads/images`, `MAX_FILES=6`, `UPLOAD_BATCH_SIZE=5`).

## Verification
- `git diff --stat` — 1 file changed, ~67 deletions
- `npm run test:web` — 43/545 pass
- `npm run test:api` — 47/714 pass

## Risk
- None functional. Documentation loss only.
