// The condition values the API accepts (`CreateProductDto`'s `@IsIn`) and their
// Spanish labels, in the order the filter dropdown offers them. Single source
// of truth: this map used to be copy-pasted into five pages plus a sixth,
// differently-shaped array for the filter options, so a translation fix had to
// land in six places or the same garment would read "Good" on one screen and
// "Buen estado" on the next.
export const PRODUCT_CONDITIONS = [
  "New",
  "Like New",
  "Good",
  "Fair",
] as const;

export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number];

export const CONDITION_LABELS: Record<string, string> = {
  New: "Nuevo",
  "Like New": "Como nuevo",
  Good: "Buen estado",
  Fair: "Aceptable",
};

/** Falls back to the raw value so an unknown condition still renders. */
export function conditionLabel(condition: string): string {
  return CONDITION_LABELS[condition] ?? condition;
}

/** Options for the catalog's condition `<select>`, derived from the same map. */
export const CONDITION_OPTIONS = PRODUCT_CONDITIONS.map((value) => ({
  value,
  label: CONDITION_LABELS[value],
}));

export function isProductCondition(value: string): value is ProductCondition {
  return (PRODUCT_CONDITIONS as readonly string[]).includes(value);
}
