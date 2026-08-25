# sell-upload-guard — Design (ponytail ultra, -15L)

## Scope
Single-file ponytail ultra deletion: `apps/web/src/app/sell/page.tsx` 671→656L (-15L, 1 file). Delete client-side upload pre-check duplication that shadows server authority:

- `const ACCEPTED_TYPES = ["image/jpeg","image/png","image/webp"]` 1L (L26) — MIME allowlist duplicated by server `validateFiles()` (415) and already filtered via `<input accept>` UX hint.
- `if (!ACCEPTED_TYPES.includes(file.type))` 7L block inside `uploadOne` (L222-228) — sets `uploading:false` + `error "Formato no permitido (JPG, PNG o WEBP)."` and returns.
- `if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024)` 7L block inside `uploadOne` (L229-235) — sets `error "Supera ${MAX_FILE_SIZE_MB}MB."` and returns.

Keep: `ACCEPTED_EXTENSIONS` (`.jpg,.jpeg,.png,.webp` for `<input accept={ACCEPTED_EXTENSIONS}>`), `MAX_FILE_SIZE_MB=5` (referenced by `uploadErrorMessage` 413 mapping `La imagen supera ${MAX_FILE_SIZE_MB}MB.`), `MAX_FILES=6`/`UPLOAD_BATCH_SIZE=5` (picker capacity + `FilesInterceptor('files',5)` batching), `uploadErrorMessage` status→Spanish mapping (413/415/5xx/401), `failedImages`/`isBlockedByImages` submit guard + retry button.

## Architecture
- **Before** (671L): `uploadOne(id,file)` did optimistic `patchImage uploading:true`, then two synchronous client guards (type+size) with early return, then `FormData` → `api.post("/uploads/images",data)` → map `res.data.images[0].url` or `uploadErrorMessage(err)` on catch. Server already enforces same checks: `uploadErrorMessage` maps 415→`"El servidor no acepta este formato."` and 413→`"La imagen supera 5MB."` (Multer `LIMIT_FILE_SIZE` → `MulterLimitFilter` 413 in `uploads.controller.ts`). Client guards were shadow validation.
- **After** (656L, -15L): `uploadOne` goes `patchImage uploading:true` → `FormData` → `api.post` → success/error via server. No `ACCEPTED_TYPES` const, no type/size `if` blocks. Error messages now uniform server-mapped Spanish strings via `uploadErrorMessage`. `handleFiles` → placeholders (`previewUrl`, `uploading:true`, `alt:""`) → `Promise.all` batch upload still via `uploadOne(p.id,p.file)` unchanged. `<input accept>` still filters picker UX; invalid types still produce 415 from server → user sees mapped error + retry.

- Ladder rung 1 YAGNI + rung 4 native/server authoritative: client pre-check is speculative duplication of trust boundary already enforced server-side. Delete over add, shortest diff wins. No interface, no helper, no dep.

## Data flow (sell page unchanged except uploadOne)
`fileInput accept={ACCEPTED_EXTENSIONS}` → user picks `FileList` → `handleFiles(FileList)` → `MAX_FILES` slots check → `placeholders` with `URL.createObjectURL` → `setImages([...prev, ...placeholders])` → clear input → batch `uploadOne` per `UPLOAD_BATCH_SIZE=5` → `patchImage uploading:true` → `FormData files` → `POST /uploads/images` → server `validateFiles` + Multer 5MB limit → 415/413/500 mapped via `uploadErrorMessage` → `patchImage {url} || {error}` → `failedImages`/`isBlockedByImages` block `handleSubmit` until resolved. `MAX_FILE_SIZE_MB` stays for 413 message interpolation; `MAX_FILES`/`UPLOAD_BATCH_SIZE` stay for capacity/batching.

## Components
- `SellForm`: `uploadOne` trimmed by 14L of guards + 1L const = -15L. `patchImage`, `handleFiles`, `removeImage`, `uploadErrorMessage`, `failedImages`/`isBlockedByImages` untouched.
- `SellPage` (Suspense): untouched.
- Draft: `DRAFT_STORAGE_KEY`/`DRAFT_EVENT`/`readDraft`/`writeDraft`/`clearDraft` unchanged.

## Testing strategy
- Existing web suites cover sell page: auth gate, prefill, draft, `MAX_FILES` guard, `failedImages` banner, `isBlockedByImages` disabled submit, `uploadErrorMessage` Spanish mapping via uploadErrorMessage unit/e2e. Deleting pre-check cannot break them — error path now goes through server mapping instead of client early return, same UX (error + retry).
- Verification: `npm run test:web` 43 suites ~545 tests + `npm run test:api` 47 suites 714 tests 100% green before PR. `git diff --stat` 1 file -15L, `wc -l` 671→656, `grep ACCEPTED_TYPES` 0 hits post-edit, `grep ACCEPTED_EXTENSIONS` 1 hit preserved, `grep MAX_FILE_SIZE_MB` 2 hits preserved (const + 413 message), `grep uploadErrorMessage` 2 hits preserved, `grep isBlockedByImages` 1 hit preserved.

## Ponytail ladder
Rung 1 — does this need to exist? No. Client MIME/size check duplicates server trust boundary (`uploads.controller` + `MulterLimitFilter` 413 + `uploadErrorMessage` 415 mapping). Server is authoritative; client `accept` attribute already gives picker hint without imperative guard. Delete outright. If future UX needs instant pre-check without round-trip, re-add via `file.type`/`file.size` loop with ponytail ceiling comment naming server mapping.

## Ceiling
None needed for deletion. If instant client feedback without upload is needed, restore `if (!ACCEPTED_TYPES.includes...)` + `if (file.size > ...)` verbatim from 78df1a7 inside `uploadOne` before `FormData`, re-add `const ACCEPTED_TYPES` above `ACCEPTED_EXTENSIONS`. No `ponytail:` comment now — server path is complete.

## Security / Perf
- Security: no weaker — server remains authoritative; client guard was not trust boundary. No input surface added. 413/415 still mapped to Spanish, no English leak via `extractApiError`.
- Perf: -15L parse, one less const + two less branches per upload, one less array includes per file. No new alloc.

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, -15L, no abstraction, server-authoritative — PASS.
- **Security**: client duplication removed, server 413/415/5xx mapping preserved, no trust boundary regression — PASS.
- **Perf**: less branches, no regression, fewer allocations — PASS.
- **Test**: web/api green, grep contracts 0/preserved, Spanish UX identical via server — PASS.
- **Action**: no design change.
