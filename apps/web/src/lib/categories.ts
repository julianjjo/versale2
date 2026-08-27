export const PRODUCT_CATEGORIES = [
  "Camisetas",
  "Camisas",
  "Pantalones",
  "Jeans",
  "Chaquetas",
  "Abrigos",
  "Vestidos",
  "Faldas",
  "Suéteres",
  "Shorts",
  "Calzado",
  "Accesorios",
  "Otros",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const DEFAULT_PRODUCT_CATEGORY: ProductCategory = "Otros";

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}
