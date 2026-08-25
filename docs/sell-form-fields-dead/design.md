# sell-form-fields-dead — Design (ponytail ultra, -11L)

## Scope
Single-file ponytail ultra deletion: dead `const FORM_FIELDS = [...] as const` (11L, L110-120, `apps/web/src/app/sell/page.tsx`). Zero references — `git grep FORM_FIELDS` 1 hit definition only. No consumer, not exported. Size/category/condition validated via `SIZES`/`CATEGORIES`/`CONDITION_OPTIONS` elsewhere. Spanish UI, draft BC/storage, image flow unchanged.

## Architecture
- **Before**: `const FORM_FIELDS = ["title","description","category","brand","size","condition","price","measurements","defects"] as const;` (9 keys + `as const` + brackets = 11L inc. declaration line) sitting between `clearDraft()` and `function SellForm()`. Never read.
- **After**: block + trailing blank deleted. `clearDraft()` directly followed by `function SellForm()`. Net -11L source (683→672L). `git diff --stat` 1 file, -11L.
- No new deps, no interfaces, no config. Ladder rung 1 YAGNI dead code.

## Data flow (sell page)
`readPrefill(searchParams)` → `SIZES`/`PRODUCT_CATEGORIES` whitelist → `useState(form)` (title, description, category, brand, size, condition, price, measurements, defects) → `update(key,value)` → `writeDraft(next)` → `handleSubmit` → `api.post("/products", { title, description, category, brand, size, condition, price, images, measurements, defects })`. `FORM_FIELDS` participated in none of this. `SIZES` (L24) and `PRODUCT_CATEGORIES`/`DEFAULT_PRODUCT_CATEGORY` (`src/lib/categories`) remain sole validators for select whitelisting.

## Components
- `SellForm`: unchanged except removal of dead const above it.
- `SellPage` (Suspense wrapper): untouched.
- Draft: `DRAFT_STORAGE_KEY`, `DRAFT_EVENT`, `readDraft`/`writeDraft`/`clearDraft` unchanged.

## Testing strategy
- Existing web suites cover sell page: auth gate, prefill, draft restore, validation, image upload gating, submit. Deleting unused const cannot break them.
- Verification: `npm run test:web` (43 suites ~545 pass, after -11L) + `npm run test:api` (47 suites 714 pass) 100% green before PR. Prettier/lint pass.
- Grep contract: `git grep FORM_FIELDS` 0 hits post-edit. `git grep "as const"` in file still 0 (no remaining).

## Ponytail ladder
Rung 1 — does this need to exist? No. Zero call sites, no export, no runtime effect. Delete outright. If a future iteration needs field enumeration, derive from form state type (`keyof typeof form`) or Zod schema — don't resurrect a string tuple.

## Ceiling
None needed. Dead code has no ceiling. Re-adding a field list would be driven by a real consumer (e.g., dynamic form generation, validation loop). No `ponytail:` comment required — deletion is complete.

## Security / Perf
- Security: const was inert, no trust boundary — no vuln.
- Perf: -11L parse, negligible; removes one const allocation at module init.

## Multi-Angle Review (2026-08-25, self-review)
- **Arch**: 1 file, -11L, no abstraction — PASS.
- **Security**: inert const, no input handling — PASS.
- **Perf**: less code to parse, no regression — PASS.
- **Test**: Web/API suites green, sell flow unchanged — PASS.
- **Action**: no design change.
