import { describe, it, expect } from "vitest";
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
  REPORT_CATEGORY_OPTIONS,
  reportCategoryLabel,
  reportCategoryBadgeVariant,
  isReportCategory,
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

  it("isReportCategory guards correctly", () => {
    expect(isReportCategory("FRAUD")).toBe(true);
    expect(isReportCategory("OTHER")).toBe(true);
    expect(isReportCategory("UNKNOWN")).toBe(false);
    expect(isReportCategory("")).toBe(false);
    expect(isReportCategory("fraud")).toBe(false);
  });

  it("isReportCategory trims whitespace", () => {
    expect(isReportCategory(" FRAUD ")).toBe(true);
    expect(isReportCategory("  OTHER  ")).toBe(true);
    expect(isReportCategory("  UNKNOWN  ")).toBe(false);
  });

  it("isReportCategory handles carriage return", () => {
    expect(isReportCategory("\rFRAUD\r")).toBe(true);
    expect(isReportCategory("\r  \n")).toBe(false);
  });

  it("isReportCategory handles tab and newline", () => {
    expect(isReportCategory("\tFRAUD\n")).toBe(true);
    expect(isReportCategory("\t  \n")).toBe(false);
  });

  it("isReportCategory handles all whitespace variants", () => {
    expect(isReportCategory(" \tFRAUD \n\r ")).toBe(true);
    expect(isReportCategory(" \t  \n\r ")).toBe(false);
  });

  it("isReportCategory handles vertical tab and form feed", () => {
    expect(isReportCategory("\vFRAUD\f")).toBe(true);
    expect(isReportCategory("\v  \f")).toBe(false);
  });

  it("isReportCategory handles non-breaking space", () => {
    expect(isReportCategory("\u00A0FRAUD\u00A0")).toBe(true);
    expect(isReportCategory("\u00A0  \u00A0")).toBe(false);
  });
});
