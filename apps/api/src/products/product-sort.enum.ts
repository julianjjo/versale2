import { ProductStatus } from "@prisma/client";

export enum ProductSortBy {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  MOST_VIEWED = 'most_viewed',
  MOST_FAVORITED = 'most_favorited',
  TOP_RATED = 'top_rated',
}

export const PRODUCT_STATUSES = Object.values(ProductStatus) as ProductStatus[];

export function isProductStatus(value: string): value is ProductStatus {
  return (PRODUCT_STATUSES as readonly string[]).includes(value.trim());
}

export const PRODUCT_SORT_BYS = Object.values(ProductSortBy) as ProductSortBy[];

export function isProductSortBy(value: string): value is ProductSortBy {
  return (PRODUCT_SORT_BYS as readonly string[]).includes(value.trim());
}
