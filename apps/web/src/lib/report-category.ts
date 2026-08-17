// The category values the API accepts (`CreateReportDto`'s `@IsEnum`) and
// their Spanish labels, in the order the report form offers them. Single
// source of truth, mirroring product-condition.ts's own reasoning — without
// it, the same category would risk reading differently on the report form
// than on the admin queue.
export const REPORT_CATEGORIES = [
  "FRAUD",
  "INAPPROPRIATE",
  "MISMATCH",
  "OTHER",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export const REPORT_CATEGORY_LABELS: Record<string, string> = {
  FRAUD: "Estafa o fraude",
  INAPPROPRIATE: "Contenido inapropiado",
  MISMATCH: "No coincide con la descripción",
  OTHER: "Otro",
};

/** Falls back to the raw value so an unknown category still renders. */
export function reportCategoryLabel(category: string): string {
  return REPORT_CATEGORY_LABELS[category] ?? category;
}

/** Options for the report form's category `<select>`, derived from the same map. */
export const REPORT_CATEGORY_OPTIONS = REPORT_CATEGORIES.map((value) => ({
  value,
  label: REPORT_CATEGORY_LABELS[value],
}));
