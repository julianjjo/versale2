import { describe, it, expect } from "vitest";
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REPORT_CATEGORY_OPTIONS,
  reportCategoryLabel,
  reportCategoryBadgeVariant,
} from "../report-category";

describe("report-category", () => {
  it("defines 4 categories in form order", () => {
    expect(REPORT_CATEGORIES).toEqual([
      "FRAUD",
      "INAPPROPRIATE",
      "MISMATCH",
      "OTHER",
    ]);
  });

  it("labels every category in Spanish", () => {
    expect(REPORT_CATEGORY_LABELS.FRAUD).toBe("Estafa o fraude");
    expect(REPORT_CATEGORY_LABELS.INAPPROPRIATE).toBe(
      "Contenido inapropiado",
    );
    expect(REPORT_CATEGORY_LABELS.MISMATCH).toBe(
      "No coincide con la descripción",
    );
    expect(REPORT_CATEGORY_LABELS.OTHER).toBe("Otro");
  });

  it("reportCategoryLabel returns Spanish label for known", () => {
    expect(reportCategoryLabel("FRAUD")).toBe("Estafa o fraude");
  });

  it("reportCategoryLabel falls back to raw for unknown", () => {
    expect(reportCategoryLabel("UNKNOWN")).toBe("UNKNOWN");
    expect(reportCategoryLabel("")).toBe("");
  });

  it("REPORT_CATEGORY_OPTIONS derives from same map in order", () => {
    expect(REPORT_CATEGORY_OPTIONS).toEqual([
      { value: "FRAUD", label: "Estafa o fraude" },
      { value: "INAPPROPRIATE", label: "Contenido inapropiado" },
      { value: "MISMATCH", label: "No coincide con la descripción" },
      { value: "OTHER", label: "Otro" },
    ]);
  });

  it("badge variant maps severity correctly", () => {
    expect(reportCategoryBadgeVariant("FRAUD")).toBe("danger");
    expect(reportCategoryBadgeVariant("INAPPROPRIATE")).toBe("warning");
    expect(reportCategoryBadgeVariant("MISMATCH")).toBe("warning");
    expect(reportCategoryBadgeVariant("OTHER")).toBe("default");
  });

  it("badge variant falls back to default for unknown", () => {
    expect(reportCategoryBadgeVariant("UNKNOWN")).toBe("default");
    expect(reportCategoryBadgeVariant("")).toBe("default");
  });

  it("options stay in sync with categories", () => {
    for (let i = 0; i < REPORT_CATEGORIES.length; i++) {
      expect(REPORT_CATEGORY_OPTIONS[i].value).toBe(REPORT_CATEGORIES[i]);
      expect(REPORT_CATEGORY_OPTIONS[i].label).toBe(
        REPORT_CATEGORY_LABELS[REPORT_CATEGORIES[i]],
      );
    }
  });
});
