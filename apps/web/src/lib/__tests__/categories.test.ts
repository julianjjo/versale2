import { describe, it, expect } from "vitest";
import {
  PRODUCT_CATEGORIES,
  DEFAULT_PRODUCT_CATEGORY,
  isProductCategory,
} from "../categories";

describe("categories", () => {
  it("defines 13 categories in canonical order", () => {
    expect(PRODUCT_CATEGORIES).toEqual([
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
    ]);
  });

  it("includes Otros as last fallback category", () => {
    expect(PRODUCT_CATEGORIES[PRODUCT_CATEGORIES.length - 1]).toBe("Otros");
  });

  it("DEFAULT_PRODUCT_CATEGORY is Otros and is member of list", () => {
    expect(DEFAULT_PRODUCT_CATEGORY).toBe("Otros");
    expect(PRODUCT_CATEGORIES).toContain(DEFAULT_PRODUCT_CATEGORY);
  });

  it("has no duplicates", () => {
    expect(new Set(PRODUCT_CATEGORIES).size).toBe(
      PRODUCT_CATEGORIES.length,
    );
  });

  it("isProductCategory guards correctly", () => {
    expect(isProductCategory("Camisetas")).toBe(true);
    expect(isProductCategory("Otros")).toBe(true);
    expect(isProductCategory("Invalid")).toBe(false);
    expect(isProductCategory("")).toBe(false);
    expect(isProductCategory("camisetas")).toBe(false);
  });

  it("isProductCategory trims whitespace", () => {
    expect(isProductCategory(" Camisetas ")).toBe(true);
    expect(isProductCategory("  Otros  ")).toBe(true);
    expect(isProductCategory("  Invalid  ")).toBe(false);
  });

  it("isProductCategory handles carriage return", () => {
    expect(isProductCategory("\rCamisetas\r")).toBe(true);
    expect(isProductCategory("\r  \n")).toBe(false);
  });

  it("isProductCategory handles tab and newline", () => {
    expect(isProductCategory("\tCamisetas\n")).toBe(true);
    expect(isProductCategory("\t  \n")).toBe(false);
  });

  it("isProductCategory handles all whitespace variants", () => {
    expect(isProductCategory(" \tCamisetas \n\r ")).toBe(true);
    expect(isProductCategory(" \t  \n\r ")).toBe(false);
  });

  it("isProductCategory handles vertical tab and form feed", () => {
    expect(isProductCategory("\vCamisetas\f")).toBe(true);
    expect(isProductCategory("\v  \f")).toBe(false);
  });

  it("isProductCategory handles non-breaking space", () => {
    expect(isProductCategory("\u00A0Camisetas\u00A0")).toBe(true);
    expect(isProductCategory("\u00A0  \u00A0")).toBe(false);
  });
});
