import { describe, it, expect } from "vitest";
import {
  PRODUCT_CONDITIONS,
  CONDITION_LABELS,
  CONDITION_OPTIONS,
  conditionLabel,
  isProductCondition,
} from "../product-condition";

describe("product-condition", () => {
  it("defines 4 conditions in filter order", () => {
    expect(PRODUCT_CONDITIONS).toEqual(["New", "Like New", "Good", "Fair"]);
  });

  it("labels every condition in Spanish", () => {
    expect(CONDITION_LABELS.New).toBe("Nuevo");
    expect(CONDITION_LABELS["Like New"]).toBe("Como nuevo");
    expect(CONDITION_LABELS.Good).toBe("Buen estado");
    expect(CONDITION_LABELS.Fair).toBe("Aceptable");
  });

  it("conditionLabel returns Spanish label for known conditions", () => {
    expect(conditionLabel("Good")).toBe("Buen estado");
  });

  it("conditionLabel falls back to raw value for unknown", () => {
    expect(conditionLabel("Unknown")).toBe("Unknown");
    expect(conditionLabel("")).toBe("");
  });

  it("conditionLabel trims whitespace before lookup", () => {
    expect(conditionLabel(" Good ")).toBe("Buen estado");
    expect(conditionLabel("  Unknown  ")).toBe("  Unknown  ");
  });

  it("CONDITION_OPTIONS derives from same map in same order", () => {
    expect(CONDITION_OPTIONS).toEqual([
      { value: "New", label: "Nuevo" },
      { value: "Like New", label: "Como nuevo" },
      { value: "Good", label: "Buen estado" },
      { value: "Fair", label: "Aceptable" },
    ]);
    expect(CONDITION_OPTIONS).toHaveLength(PRODUCT_CONDITIONS.length);
  });

  it("CONDITION_OPTIONS stays in sync with PRODUCT_CONDITIONS", () => {
    for (let i = 0; i < PRODUCT_CONDITIONS.length; i++) {
      expect(CONDITION_OPTIONS[i].value).toBe(PRODUCT_CONDITIONS[i]);
      expect(CONDITION_OPTIONS[i].label).toBe(
        CONDITION_LABELS[PRODUCT_CONDITIONS[i]],
      );
    }
  });

  it("isProductCondition guards correctly", () => {
    expect(isProductCondition("New")).toBe(true);
    expect(isProductCondition("Fair")).toBe(true);
    expect(isProductCondition("Unknown")).toBe(false);
    expect(isProductCondition("")).toBe(false);
    expect(isProductCondition("new")).toBe(false);
  });

  it("isProductCondition trims whitespace", () => {
    expect(isProductCondition(" New ")).toBe(true);
    expect(isProductCondition("  Good  ")).toBe(true);
    expect(isProductCondition("  Unknown  ")).toBe(false);
  });

  it("isProductCondition handles carriage return", () => {
    expect(isProductCondition("\rNew\r")).toBe(true);
    expect(isProductCondition("\r  \n")).toBe(false);
  });

  it("isProductCondition handles tab and newline", () => {
    expect(isProductCondition("\tNew\n")).toBe(true);
    expect(isProductCondition("\t  \n")).toBe(false);
  });
});
