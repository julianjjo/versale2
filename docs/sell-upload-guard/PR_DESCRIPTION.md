# refactor(web): remove client upload type/size pre-check, server authoritative (ponytail ultra, -15L)

## Summary
Delete client-side upload pre-check duplication in `apps/web/src/app/sell/page.tsx` (671→656L, -15L, 1 file). Removes `const ACCEPTED_TYPES = ["image/jpeg","image/png","image/webp"]` (1L) + `if (!ACCEPTED_TYPES.includes(file.type))` 7L (`Formato no permitido...`) + `if (file.size > MAX_FILE_SIZE_MB*1024*1024)` 7L (`Supera ${MAX_FILE_SIZE_MB}MB.`) inside `uploadOne`. Server remains authoritative via `uploadErrorMessage` 413/415/5xx Spanish mapping + Multer `LIMIT_FILE_SIZE` 413. Keep `ACCEPTED_EXTENSIONS` (input accept), `MAX_FILE_SIZE_MB` (413 message), `MAX_FILES=6`/`UPLOAD_BATCH_SIZE=5`, `failedImages`/`isBlockedByImages` submit guard.

## Scope
- **1 file**: `apps/web/src/app/sell/page.tsx` only — `git diff --stat` `1 file changed, 15 deletions(-)`.
- **Delete** `ACCEPTED_TYPES` const (L26) — MIME allowlist shadowed by server `validateFiles` 415.
- **Delete** two `if` blocks in `uploadOne` (L222-235, 14L) — early returns with `patchImage uploading:false error ...`.
- **Keep** `ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp"` for `<input accept>`, `MAX_FILE_SIZE_MB=5` for `uploadErrorMessage` 413 interpolation, `MAX_FILES`/`UPLOAD_BATCH_SIZE` for picker capacity + `FilesInterceptor('files',5)` batching, `uploadErrorMessage` status→Spanish (401/413/415/5xx), `failedImages`/`isBlockedByImages` + retry.

## Architecture — before / after

**Before (671L)**:
```ts
const ACCEPTED_TYPES = ["image/jpeg","image/png","image/webp"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE_MB = 5;
...
const uploadOne = async (id:string,file:File)=>{
  patchImage(id,{uploading:true,error:undefined});
  if(!ACCEPTED_TYPES.includes(file.type)){
    patchImage(id,{uploading:false,error:"Formato no permitido (JPG, PNG o WEBP)."});
    return;
  }
  if(file.size > MAX_FILE_SIZE_MB*1024*1024){
    patchImage(id,{uploading:false,error:`Supera ${MAX_FILE_SIZE_MB}MB.`});
    return;
  }
  const data=new FormData(); data.append("files",file);
  try{ const res=await api.post("/uploads/images",data); ... }
  catch(err){ patchImage(id,{uploading:false,error:uploadErrorMessage(err)}) }
}
```

**After (656L, -15L)**:
```ts
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";
const MAX_FILE_SIZE_MB = 5;
...
const uploadOne = async (id:string,file:File)=>{
  patchImage(id,{uploading:true,error:undefined});
  const data=new FormData(); data.append("files",file);
  try{ const res=await api.post("/uploads/images",data); ... }
  catch(err){ patchImage(id,{uploading:false,error:uploadErrorMessage(err)}) }
}
```
No `ACCEPTED_TYPES`; `git diff --stat` 1 file -15L; error path now uniform via `uploadErrorMessage` server mapping.

## Data flow
`accept={ACCEPTED_EXTENSIONS}` → `handleFiles` slots/`MAX_FILES` → placeholders `URL.createObjectURL` → `uploadOne` per batch (`UPLOAD_BATCH_SIZE=5`) → `FormData` → `POST /uploads/images` → server Multer 5MB + validateFiles → 413→`La imagen supera 5MB.` 415→`El servidor no acepta este formato.` 5xx→`El servicio de imágenes...` via `uploadErrorMessage` → `patchImage {url}|{error}` → `failedImages` banner + `isBlockedByImages` blocks `handleSubmit`.

## Ponytail ladder
Rung 1 YAGNI + rung 4 server authoritative — client guard duplicates trust boundary already enforced server-side (`uploads.controller` + `MulterLimitFilter` 413 + `uploadErrorMessage` 415). `accept` attribute already hints picker. Deletion before addition, shortest diff wins. No helper, no dep.

## Ceiling
None now. If instant pre-check without round-trip needed, restore blocks verbatim from 78df1a7 inside `uploadOne` before `FormData` + `const ACCEPTED_TYPES` above `ACCEPTED_EXTENSIONS`.

## Testing
- `npm run test:web` 43 suites ~545 tests PASS
- `npm run test:api` 47 suites 714 tests PASS — 100% green before push
- `grep ACCEPTED_TYPES` 0 hits post-edit; `grep ACCEPTED_EXTENSIONS` 1 hit preserved; `grep MAX_FILE_SIZE_MB` 2 hits preserved; `grep uploadErrorMessage` 2+ preserved; `grep isBlockedByImages` preserved
- `wc -l apps/web/src/app/sell/page.tsx` 671→656 verified
- Lint clean on changed file

## Risk / Rollback
Low — display/server error path only, no trust boundary change. Extra round-trip for invalid type/size before server 415/413 (rare, picker filtered). Rollback: `git revert` single commit or restore `ACCEPTED_TYPES` + two `if` blocks verbatim from 78df1a7.

## Diff stat
`apps/web/src/app/sell/page.tsx | 15 deletions(-)` (1 file)
`docs/sell-upload-guard/{design.md,PR_DESCRIPTION.md}` docs only
