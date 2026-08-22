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
