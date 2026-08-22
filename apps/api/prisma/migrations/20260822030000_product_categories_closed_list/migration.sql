-- Item 5: closed category list. Anything outside the list falls back to
-- "Otros" so legacy free-text values (e.g. "Jackets", "Tops", typos) don't
-- orphan listings from the normalized filter. The list mirrors
-- apps/api/src/products/categories.ts (shared contract with the frontend).
UPDATE "Product"
SET "category" = 'Otros'
WHERE "category" NOT IN (
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
    'Otros'
);
