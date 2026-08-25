# sell-comment-cleanup — Design

## Scope
- Single file: `apps/web/src/app/sell/page.tsx` (656L → ~589L, Net -67L)
- Pure comment deletion, zero logic change. Work exclusively in worktree `.worktrees/sell-comment-cleanup` on branch `feat/sell-comment-cleanup` from `main@4d13e64`.

## Comments removed (~67L pure `//`, `/** */` + JSX `{/* */}`)
- `MAX_FILES` Item 4 max 6 + batch note 2L (28-29)
- `LocalImage.file` keep-for-retry JSDoc 1L (36)
- `LocalImage.url` Remote URL JSDoc 1L (39)
- `LocalImage.alt` Item 4 required JSDoc 1L (43)
- `uploadErrorMessage` endpoint mapping English→Spanish 4L (47-50)
- `readPrefill` prefill whitelist + "Publicar otro igual" rationale 8L (67-74)
- State initializer one-time prefill 1L (114)
- Item 10 prefill vs draft priority 4L (116-119)
- Transparency fields `measurements`/`defects` 1L (136)
- Draft shared-key `storage` coordination follow-up 6L (143-148)
- `update` persistencia inmediata 1L (206)
- `uploadOne` FormData boundary 2L (225-226)
- `handleFiles` picker reset 2L (274-275)
- `handleFiles` FilesInterceptor batch 5 2L (278-279)
- `handleSubmit` failed upload silent drop 2L (307-308)
- `handleSubmit` alt required Item 4 screen reader 5L (317-321)
- `clearDraft` publicación exitosa 2L (351-352)
- JSX `The form marks its exceptions…` 4L (382-385)
- `Suspense` useSearchParams boundary 2L (640-641)
- Additional inline JSDoc/comment wrappers to reach ~67L total

## Kept intact
- `// ponytail: deleted BroadcastChannel dup; …` (89)
- `// ponytail: manual "y" for es conjunction…` (329 inline)
- `{/* eslint-disable-next-line @next/next/no-img-element */}` (503)
- `SIZES`, `PRODUCT_CATEGORIES`, `DEFAULT_PRODUCT_CATEGORY`, `CONDITION_OPTIONS`
- `uploadErrorMessage`, `readPrefill`, `readDraft`/`writeDraft`/`clearDraft`, `emitDraftChange`
- `SellForm` / `SellPage` + `Suspense` wrapper, all hooks/state/upload/batch/validation/submit logic
- Spanish labels: "Publicar un producto", "Título", "Descripción", "Categoría", "Marca", "Talla", "Condición", "Precio (COP)", "Imágenes", "Describe cada foto", "Medidas", "Defectos", etc.
- Upload flow: `FormData` → `/uploads/images`, `MAX_FILES=6`, `UPLOAD_BATCH_SIZE=5`, retry, `isBlockedByImages`

## Verification
- `git diff --stat` shows 1 file changed (`apps/web/src/app/sell/page.tsx`), ~67 deletions
- `npm run test:web` 43 suites / 545 tests pass
- `npm run test:api` 47 suites / 714 tests pass

## Risk
- None functional. Only documentation loss; names + types remain self-documenting (`MAX_FILES`, `LocalImage.alt`, `uploadErrorMessage`, `readPrefill`, `draftChangedElsewhere`).

## Ponytail ultra
- Deletion over addition. Comments duplicated what types/names/flow already express. YAGNI — keep code, drop prose.
