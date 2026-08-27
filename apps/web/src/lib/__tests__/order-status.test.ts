import { describe, it, expect } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  ALLOWED_STATUS_TRANSITIONS,
  ORDER_STATUS_VARIANT,
  ORDER_STATUS_REASSURANCE,
  nextStatusesFor,
  commonNextStatuses,
  isOrderStatus,
  orderStatusLabel,
} from "../order-status";

describe("order-status", () => {
  it("defines 7 statuses in lifecycle order", () => {
    expect(ORDER_STATUSES).toEqual([
      "PENDING",
      "PAID",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "DISPUTED",
      "REFUNDED",
    ]);
  });

  it("labels every status in Spanish", () => {
    for (const s of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABEL[s]).toBeTruthy();
      expect(typeof ORDER_STATUS_LABEL[s]).toBe("string");
    }
    expect(ORDER_STATUS_LABEL.PENDING).toBe("Pendiente");
    expect(ORDER_STATUS_LABEL.DISPUTED).toBe("En disputa");
  });

  it("defines allowed transitions (terminal states have none)", () => {
    expect(ALLOWED_STATUS_TRANSITIONS.PENDING).toEqual(["PAID", "CANCELLED"]);
    expect(ALLOWED_STATUS_TRANSITIONS.PAID).toEqual([
      "SHIPPED",
      "CANCELLED",
      "REFUNDED",
    ]);
    expect(ALLOWED_STATUS_TRANSITIONS.SHIPPED).toEqual(["DELIVERED"]);
    expect(ALLOWED_STATUS_TRANSITIONS.DELIVERED).toEqual(["DISPUTED"]);
    expect(ALLOWED_STATUS_TRANSITIONS.CANCELLED).toEqual([]);
    expect(ALLOWED_STATUS_TRANSITIONS.REFUNDED).toEqual([]);
  });

  it("maps every status to a badge variant", () => {
    for (const s of ORDER_STATUSES) {
      expect(ORDER_STATUS_VARIANT[s]).toMatch(/warning|info|success|danger/);
    }
    expect(ORDER_STATUS_VARIANT.DELIVERED).toBe("success");
    expect(ORDER_STATUS_VARIANT.CANCELLED).toBe("danger");
  });

  it("defines reassurance text for every status", () => {
    for (const s of ORDER_STATUSES) {
      expect(ORDER_STATUS_REASSURANCE[s].length).toBeGreaterThan(5);
    }
    expect(ORDER_STATUS_REASSURANCE.PENDING).toMatch(/confirmando/i);
  });

  describe("nextStatusesFor", () => {
    it("returns allowed next statuses", () => {
      expect(nextStatusesFor("PENDING")).toEqual(["PAID", "CANCELLED"]);
      expect(nextStatusesFor("CANCELLED")).toEqual([]);
    });

    it("returns empty for unknown status", () => {
      expect(nextStatusesFor("UNKNOWN" as never)).toEqual([]);
    });
  });

  describe("commonNextStatuses", () => {
    it("returns empty for empty input", () => {
      expect(commonNextStatuses([])).toEqual([]);
    });

    it("returns next statuses for single status", () => {
      expect(commonNextStatuses(["PENDING"])).toEqual(["PAID", "CANCELLED"]);
    });

    it("intersects next statuses for multiple statuses", () => {
      // PENDING -> [PAID, CANCELLED], PAID -> [SHIPPED, CANCELLED, REFUNDED] => [CANCELLED]
      expect(commonNextStatuses(["PENDING", "PAID"])).toEqual(["CANCELLED"]);
    });

    it("returns empty when no common next status", () => {
      // PENDING [PAID, CANCELLED] vs SHIPPED [DELIVERED] => []
      expect(commonNextStatuses(["PENDING", "SHIPPED"])).toEqual([]);
    });

    it("handles duplicate statuses", () => {
      expect(commonNextStatuses(["PAID", "PAID"])).toEqual([
        "SHIPPED",
        "CANCELLED",
        "REFUNDED",
      ]);
    });
  });

  it("isOrderStatus guards correctly", () => {
    expect(isOrderStatus("PENDING")).toBe(true);
    expect(isOrderStatus("REFUNDED")).toBe(true);
    expect(isOrderStatus("UNKNOWN")).toBe(false);
    expect(isOrderStatus("")).toBe(false);
    expect(isOrderStatus("pending")).toBe(false);
  });

  it("isOrderStatus trims whitespace", () => {
    expect(isOrderStatus(" PENDING ")).toBe(true);
    expect(isOrderStatus("  PAID  ")).toBe(true);
  });

  it("orderStatusLabel returns Spanish label and falls back to raw", () => {
    expect(orderStatusLabel("PENDING")).toBe("Pendiente");
    expect(orderStatusLabel("UNKNOWN")).toBe("UNKNOWN");
    expect(orderStatusLabel("")).toBe("");
  });
});
