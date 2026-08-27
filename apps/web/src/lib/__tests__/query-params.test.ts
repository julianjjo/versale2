import { describe, it, expect } from "vitest";
import { mergeFacetOptions, parseAmount, parsePage } from "../query-params";

describe("query-params", () => {
  describe("mergeFacetOptions", () => {
    it("returns fetched when current is empty", () => {
      expect(mergeFacetOptions(["A", "B"], "")).toEqual(["A", "B"]);
      expect(mergeFacetOptions(undefined, "")).toEqual([]);
    });

    it("prepends current when not in fetched (case-insensitive)", () => {
      expect(mergeFacetOptions(["Nike"], "Adidas")).toEqual(["Adidas", "Nike"]);
    });

    it("does not duplicate when case-insensitive match", () => {
      expect(mergeFacetOptions(["Nike"], "nike")).toEqual(["Nike"]);
      expect(mergeFacetOptions(["Adidas"], "ADIDAS")).toEqual(["Adidas"]);
    });

    it("handles undefined fetched", () => {
      expect(mergeFacetOptions(undefined, "Zara")).toEqual(["Zara"]);
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
});
