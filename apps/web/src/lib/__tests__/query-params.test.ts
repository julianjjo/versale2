import { describe, it, expect } from "vitest";
import {
  isSortByValue,
  isProductSize,
  mergeFacetOptions,
  parseAmount,
  parsePage,
  PRODUCT_SIZES,
  SORT_OPTIONS,
} from "../query-params";

describe("query-params", () => {
  describe("mergeFacetOptions", () => {
    it("returns fetched when current is empty", () => {
      expect(mergeFacetOptions(["A", "B"], "")).toEqual(["A", "B"]);
      expect(mergeFacetOptions(undefined, "")).toEqual([]);
    });

    it("prepends current when not in fetched (case-insensitive)", () => {
      expect(mergeFacetOptions(["Nike"], "Adidas")).toEqual([
        "Adidas",
        "Nike",
      ]);
    });

    it("does not duplicate when case-insensitive match", () => {
      expect(mergeFacetOptions(["Nike"], "nike")).toEqual(["Nike"]);
      expect(mergeFacetOptions(["Adidas"], "ADIDAS")).toEqual(["Adidas"]);
    });

    it("handles undefined fetched", () => {
      expect(mergeFacetOptions(undefined, "Zara")).toEqual(["Zara"]);
    });

    it("trims whitespace and handles empty current", () => {
      expect(mergeFacetOptions(["Nike"], "  Nike  ")).toEqual(["Nike"]);
      expect(mergeFacetOptions(["Nike"], "   ")).toEqual(["Nike"]);
      expect(mergeFacetOptions([], "  Adidas ")).toEqual(["Adidas"]);
    });
  });

  describe("parseAmount", () => {
    it("parses valid non-negative numbers", () => {
      expect(parseAmount("100")).toBe(100);
      expect(parseAmount("0")).toBe(0);
      expect(parseAmount("  1000  ")).toBe(1000);
    });

    it("returns undefined for null, empty, whitespace", () => {
      expect(parseAmount(null)).toBeUndefined();
      expect(parseAmount("")).toBeUndefined();
      expect(parseAmount("   ")).toBeUndefined();
    });

    it("returns undefined for negative or non-finite", () => {
      expect(parseAmount("-1")).toBeUndefined();
      expect(parseAmount("Infinity")).toBeUndefined();
      expect(parseAmount("abc")).toBeUndefined();
    });
  });

  describe("parsePage", () => {
    it("parses valid pages", () => {
      expect(parsePage("1")).toBe(1);
      expect(parsePage(" 2 ")).toBe(2);
      expect(parsePage("2.9")).toBe(2);
    });

    it("returns undefined for invalid", () => {
      expect(parsePage(null)).toBeUndefined();
      expect(parsePage("")).toBeUndefined();
      expect(parsePage("   ")).toBeUndefined();
      expect(parsePage("0")).toBeUndefined();
      expect(parsePage("-1")).toBeUndefined();
      expect(parsePage("abc")).toBeUndefined();
    });
  });

  describe("SORT_OPTIONS / isSortByValue", () => {
    it("defines 5 sort options", () => {
      expect(SORT_OPTIONS).toHaveLength(5);
      expect(SORT_OPTIONS.map((o) => o.value)).toEqual([
        "price_asc",
        "price_desc",
        "most_viewed",
        "most_favorited",
        "top_rated",
      ]);
    });

    it("isSortByValue guards correctly", () => {
      expect(isSortByValue("price_asc")).toBe(true);
      expect(isSortByValue("top_rated")).toBe(true);
      expect(isSortByValue("unknown")).toBe(false);
      expect(isSortByValue("")).toBe(false);
    });

    it("isSortByValue trims whitespace", () => {
      expect(isSortByValue(" price_asc ")).toBe(true);
      expect(isSortByValue("  top_rated  ")).toBe(true);
    });

    it("isSortByValue handles tab/newline whitespace", () => {
      expect(isSortByValue("\tprice_asc\n")).toBe(true);
      expect(isSortByValue("\t  \n")).toBe(false);
    });
  });

  describe("PRODUCT_SIZES / isProductSize", () => {
    it("defines 6 sizes", () => {
      expect(PRODUCT_SIZES).toEqual(["XS", "S", "M", "L", "XL", "XXL"]);
    });

    it("isProductSize guards case-insensitive and trims", () => {
      expect(isProductSize("M")).toBe(true);
      expect(isProductSize("m")).toBe(true);
      expect(isProductSize("  xl  ")).toBe(true);
      expect(isProductSize("Xs")).toBe(true);
      expect(isProductSize("xxl")).toBe(true);
      expect(isProductSize("unknown")).toBe(false);
      expect(isProductSize("")).toBe(false);
    });

    it("isProductSize handles whitespace-only", () => {
      expect(isProductSize("   ")).toBe(false);
      expect(isProductSize("  M  ")).toBe(true);
    });

    it("isProductSize handles tab and newline whitespace", () => {
      expect(isProductSize("\tM\n")).toBe(true);
      expect(isProductSize("\t  \n")).toBe(false);
    });

    it("isProductSize handles mixed case with whitespace", () => {
      expect(isProductSize("  m  ")).toBe(true);
      expect(isProductSize("  XXL  ")).toBe(true);
    });

    it("isProductSize handles tab and newline with mixed case", () => {
      expect(isProductSize("\txs\n")).toBe(true);
      expect(isProductSize("\tXl\n")).toBe(true);
    });

    it("isProductSize handles carriage return whitespace", () => {
      expect(isProductSize("\rM\r")).toBe(true);
      expect(isProductSize("\r  \n")).toBe(false);
    });
  });
});
