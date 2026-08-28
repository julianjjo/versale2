# Pagination guard — different file/technique
Abandons ponytail angle. New file: apps/api/src/common/pagination.ts (not in recent ponytail ledger, not touched since 995c715).
Adds missing Vitest coverage for resolvePagination edge cases: defaults, clamping, NaN/Infinity, overflow.
