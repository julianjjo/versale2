import { describe, it, expect } from "vitest";
import {
  PRODUCT_CATEGORIES,
  DEFAULT_PRODUCT_CATEGORY,
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
});
