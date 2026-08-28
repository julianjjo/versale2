import { describe, it, expect } from "vitest";
import { isProductCategory } from "../categories";
import { isProductCondition } from "../product-condition";
import { isReportCategory } from "../report-category";
import { isOrderStatus } from "../order-status";
import { isProductSize, isSortByValue } from "../query-params";
import {
  isUserRole,
  isProductStatus,
  isReportStatus,
  isNotificationType,
} from "../types";

// Every closed-list guard in lib/ narrows a raw query-string or API value with
// `.trim()`. Two facts about that are easy to get wrong and worth pinning in
// one place rather than re-deriving per guard:
//
//   1. `String.prototype.trim()` strips the whole Unicode WhiteSpace set, not
//      just ASCII spaces — vertical tab, form feed, NBSP and the ideographic
//      space all go, so a value pasted from a spreadsheet or typed through an
//      IME still matches.
//   2. It does NOT strip the zero-width space (U+200B), which is not
//      whitespace. A value carrying one has to stay unrecognised instead of
//      being silently accepted.
//
// Escapes, not literal characters: NBSP and U+200B are invisible in a diff.
const NBSP = "\u00a0";
const IDEOGRAPHIC_SPACE = "\u3000";
const ZERO_WIDTH_SPACE = "\u200b";
const ALL_WHITESPACE = ` \t\n\r\v\f${NBSP}${IDEOGRAPHIC_SPACE}`;

// Table-driven so a new guard is one row, not a new copy of every case.
const GUARDS: Array<[string, (value: string) => boolean, string]> = [
  ["isProductCategory", isProductCategory, "Camisetas"],
  ["isProductCondition", isProductCondition, "Like New"],
  ["isReportCategory", isReportCategory, "FRAUD"],
  ["isOrderStatus", isOrderStatus, "SHIPPED"],
  ["isUserRole", isUserRole, "ADMIN"],
  ["isProductStatus", isProductStatus, "AVAILABLE"],
  ["isReportStatus", isReportStatus, "DISMISSED"],
  ["isNotificationType", isNotificationType, "ORDER_SHIPPED"],
  ["isProductSize", isProductSize, "XL"],
  ["isSortByValue", isSortByValue, "price_asc"],
];

// Named so a failure says which character class broke, not "case 4".
const WHITESPACE: Array<[string, string]> = [
  ["space", " "],
  ["tab", "\t"],
  ["newline", "\n"],
  ["carriage return", "\r"],
  ["vertical tab", "\v"],
  ["form feed", "\f"],
  ["non-breaking space", NBSP],
  ["ideographic space", IDEOGRAPHIC_SPACE],
];

describe("closed-list guards: whitespace handling", () => {
  describe.each(GUARDS)("%s", (_name, guard, valid) => {
    it.each(WHITESPACE)("trims a surrounding %s", (_label, ws) => {
      expect(guard(`${ws}${valid}${ws}`)).toBe(true);
    });

    it("trims every whitespace class at once", () => {
      expect(guard(`${ALL_WHITESPACE}${valid}${ALL_WHITESPACE}`)).toBe(true);
    });

    it("rejects a zero-width space, which trim() does not strip", () => {
      expect(guard(`${ZERO_WIDTH_SPACE}${valid}${ZERO_WIDTH_SPACE}`)).toBe(
        false,
      );
    });

    it("rejects a whitespace-only value", () => {
      expect(guard(ALL_WHITESPACE)).toBe(false);
      expect(guard("")).toBe(false);
    });

    it("still rejects an unknown value after trimming", () => {
      expect(guard("  definitely-not-a-member  ")).toBe(false);
    });
  });

  // isProductSize is the one guard that upper-cases before trimming, so the
  // two normalisations have to compose rather than cancel out.
  it("isProductSize folds case and whitespace together", () => {
    expect(isProductSize(" xs ")).toBe(true);
    expect(isProductSize("\txxl\n")).toBe(true);
    expect(isProductSize(`${NBSP}m${IDEOGRAPHIC_SPACE}`)).toBe(true);
    expect(isProductSize(`${ZERO_WIDTH_SPACE}m${ZERO_WIDTH_SPACE}`)).toBe(
      false,
    );
  });
});
