// Item 5: closed category list, shared contract with the frontend copy at
// apps/web/src/lib/categories.ts. Both sides MUST stay identical — the DTO
// rejects anything outside this list and the /sell selector offers exactly
// these options. Decided in docs/funcionalidades-propuestas.md (1.13).
export const PRODUCT_CATEGORIES = [
  'Camisetas',
  'Camisas',
  'Pantalones',
  'Jeans',
  'Chaquetas',
  'Abrigos',
  'Vestidos',
  'Faldas',
  'Suéteres',
  'Shorts',
  'Calzado',
  'Accesorios',
  'Otros',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

// Backfill target and /sell default: anything that doesn't fit a specific
// category lands here instead of being rejected outright.
export const DEFAULT_PRODUCT_CATEGORY: ProductCategory = 'Otros';

// Folds a user-supplied category filter back to its canonical spelling, so
// "chaquetas" and "CHAQUETAS" both query as "Chaquetas". Needed because the
// catalog filter matches with `equals` (SQL `=`), which is case-sensitive on
// SQLite — unlike `contains`/LIKE, which already ignores ASCII case. Doing the
// fold here rather than in the query keeps it a pure lookup against the same
// closed list the DTO validates writes against.
//
// Values outside the list (legacy rows such as "Jackets", predating the closed
// list) pass through untouched: they still match their own exact spelling
// rather than silently filtering to nothing.
export function canonicalCategory(value: string): string {
  const match = PRODUCT_CATEGORIES.find(
    (category) => category.toLowerCase() === value.toLowerCase(),
  );
  return match ?? value;
}
