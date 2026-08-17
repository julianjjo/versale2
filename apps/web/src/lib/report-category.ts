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

// Keyed by the narrow ReportCategory union (not string) so adding a new
// enum value without a matching label fails to compile instead of silently
// rendering a blank option.
export const REPORT_CATEGORY_LABELS: Record<ReportCategory, string> = {
  FRAUD: "Estafa o fraude",
  INAPPROPRIATE: "Contenido inapropiado",
  MISMATCH: "No coincide con la descripción",
  OTHER: "Otro",
};

/** Falls back to the raw value so an unknown category still renders. */
export function reportCategoryLabel(category: string): string {
  return (REPORT_CATEGORY_LABELS as Record<string, string>)[category] ?? category;
}

/** Options for the report form's category `<select>`, derived from the same map. */
export const REPORT_CATEGORY_OPTIONS = REPORT_CATEGORIES.map((value) => ({
  value,
  label: REPORT_CATEGORY_LABELS[value],
}));

export type ReportCategoryBadgeVariant = "danger" | "warning" | "default";

// Drives the admin queue's badge color so a fraud report doesn't carry the
// same visual weight as a miscellaneous one — a separate map from the
// labels above since severity and display text are independent concerns.
const REPORT_CATEGORY_BADGE_VARIANTS: Record<
  ReportCategory,
  ReportCategoryBadgeVariant
> = {
  FRAUD: "danger",
  INAPPROPRIATE: "warning",
  MISMATCH: "warning",
  OTHER: "default",
};

/** Falls back to "default" so an unknown category still renders a badge. */
export function reportCategoryBadgeVariant(
  category: string,
): ReportCategoryBadgeVariant {
  return (
    (REPORT_CATEGORY_BADGE_VARIANTS as Record<string, ReportCategoryBadgeVariant>)[
      category
    ] ?? "default"
  );
}
