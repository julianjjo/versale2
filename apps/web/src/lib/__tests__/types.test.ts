import { describe, it, expect } from "vitest";
import {
  USER_ROLES,
  NOTIFICATION_TYPES,
  REPORT_STATUSES,
  PRODUCT_STATUSES,
  PRODUCT_STATUS_LABEL,
  NOTIFICATION_TYPE_LABEL,
  isUserRole,
  isNotificationType,
  isReportStatus,
  isProductStatus,
  productStatusLabel,
  notificationTypeLabel,
} from "../types";

describe("types - USER_ROLES", () => {
  it("defines 2 roles in order", () => {
    expect(USER_ROLES).toEqual(["USER", "ADMIN"]);
  });

  it("isUserRole guards correctly", () => {
    expect(isUserRole("USER")).toBe(true);
    expect(isUserRole("ADMIN")).toBe(true);
    expect(isUserRole("UNKNOWN")).toBe(false);
    expect(isUserRole("")).toBe(false);
    expect(isUserRole("user")).toBe(false);
  });

  it("isUserRole trims whitespace", () => {
    expect(isUserRole(" USER ")).toBe(true);
    expect(isUserRole("  ADMIN  ")).toBe(true);
  });

  it("isUserRole handles carriage return and tab", () => {
    expect(isUserRole("\rUSER\r")).toBe(true);
    expect(isUserRole("\tADMIN\n")).toBe(true);
    expect(isUserRole("\r  \n")).toBe(false);
  });

  it("isUserRole handles all whitespace variants", () => {
    expect(isUserRole(" \tUSER \n\r ")).toBe(true);
    expect(isUserRole(" \t  \n\r ")).toBe(false);
  });

  it("isUserRole handles vertical tab and form feed", () => {
    expect(isUserRole("\vUSER\f")).toBe(true);
    expect(isUserRole("\v  \f")).toBe(false);
  });

  it("isUserRole handles non-breaking space", () => {
    expect(isUserRole("\u00A0USER\u00A0")).toBe(true);
    expect(isUserRole("\u00A0  \u00A0")).toBe(false);
  });

  it("isUserRole handles zero-width space (not trimmed)", () => {
    expect(isUserRole("\u200BUSER\u200B")).toBe(false);
    expect(isUserRole("USER")).toBe(true);
  });
});

describe("types - NOTIFICATION_TYPES", () => {
  it("defines 5 notification types", () => {
    expect(NOTIFICATION_TYPES).toEqual([
      "ORDER_SHIPPED",
      "ORDER_CANCELLED",
      "ORDER_STATUS_CHANGED",
      "QUESTION_ASKED",
      "QUESTION_ANSWERED",
    ]);
  });

  it("isNotificationType guards correctly", () => {
    expect(isNotificationType("ORDER_SHIPPED")).toBe(true);
    expect(isNotificationType("QUESTION_ASKED")).toBe(true);
    expect(isNotificationType("UNKNOWN")).toBe(false);
    expect(isNotificationType("")).toBe(false);
  });

  it("isNotificationType trims whitespace", () => {
    expect(isNotificationType(" ORDER_SHIPPED ")).toBe(true);
  });

  it("isNotificationType handles carriage return and tab", () => {
    expect(isNotificationType("\rORDER_SHIPPED\r")).toBe(true);
    expect(isNotificationType("\tQUESTION_ASKED\n")).toBe(true);
    expect(isNotificationType("\r  \n")).toBe(false);
  });

  it("isNotificationType handles all whitespace variants", () => {
    expect(isNotificationType(" \tORDER_SHIPPED \n\r ")).toBe(true);
    expect(isNotificationType(" \t  \n\r ")).toBe(false);
  });

  it("isNotificationType handles vertical tab and form feed", () => {
    expect(isNotificationType("\vORDER_SHIPPED\f")).toBe(true);
    expect(isNotificationType("\v  \f")).toBe(false);
  });

  it("isNotificationType handles non-breaking space", () => {
    expect(isNotificationType("\u00A0ORDER_SHIPPED\u00A0")).toBe(true);
    expect(isNotificationType("\u00A0  \u00A0")).toBe(false);
  });

  it("notificationTypeLabel returns label and trims", () => {
    expect(notificationTypeLabel("ORDER_SHIPPED")).toBe("Pedido enviado");
    expect(notificationTypeLabel(" ORDER_SHIPPED ")).toBe("Pedido enviado");
    expect(notificationTypeLabel("UNKNOWN")).toBe("UNKNOWN");
    expect(NOTIFICATION_TYPE_LABEL.ORDER_SHIPPED).toBeTruthy();
  });
});

describe("types - REPORT_STATUSES", () => {
  it("defines 2 report statuses", () => {
    expect(REPORT_STATUSES).toEqual(["OPEN", "DISMISSED"]);
  });

  it("isReportStatus guards correctly", () => {
    expect(isReportStatus("OPEN")).toBe(true);
    expect(isReportStatus("DISMISSED")).toBe(true);
    expect(isReportStatus("UNKNOWN")).toBe(false);
    expect(isReportStatus("")).toBe(false);
  });

  it("isReportStatus trims whitespace", () => {
    expect(isReportStatus(" OPEN ")).toBe(true);
  });

  it("isReportStatus handles carriage return and tab", () => {
    expect(isReportStatus("\rOPEN\r")).toBe(true);
    expect(isReportStatus("\tDISMISSED\n")).toBe(true);
    expect(isReportStatus("\r  \n")).toBe(false);
  });

  it("isReportStatus handles all whitespace variants", () => {
    expect(isReportStatus(" \tOPEN \n\r ")).toBe(true);
    expect(isReportStatus(" \t  \n\r ")).toBe(false);
  });

  it("isReportStatus handles vertical tab and form feed", () => {
    expect(isReportStatus("\vOPEN\f")).toBe(true);
    expect(isReportStatus("\v  \f")).toBe(false);
  });

  it("isReportStatus handles non-breaking space", () => {
    expect(isReportStatus("\u00A0OPEN\u00A0")).toBe(true);
    expect(isReportStatus("\u00A0  \u00A0")).toBe(false);
  });
});

describe("types - PRODUCT_STATUSES", () => {
  it("defines 3 product statuses", () => {
    expect(PRODUCT_STATUSES).toEqual(["AVAILABLE", "SOLD", "WITHDRAWN"]);
  });

  it("isProductStatus guards correctly", () => {
    expect(isProductStatus("AVAILABLE")).toBe(true);
    expect(isProductStatus("SOLD")).toBe(true);
    expect(isProductStatus("WITHDRAWN")).toBe(true);
    expect(isProductStatus("UNKNOWN")).toBe(false);
    expect(isProductStatus("")).toBe(false);
  });

  it("isProductStatus trims whitespace", () => {
    expect(isProductStatus(" AVAILABLE ")).toBe(true);
  });

  it("isProductStatus handles carriage return and tab", () => {
    expect(isProductStatus("\rAVAILABLE\r")).toBe(true);
    expect(isProductStatus("\tSOLD\n")).toBe(true);
    expect(isProductStatus("\r  \n")).toBe(false);
  });

  it("isProductStatus handles all whitespace variants", () => {
    expect(isProductStatus(" \tAVAILABLE \n\r ")).toBe(true);
    expect(isProductStatus(" \t  \n\r ")).toBe(false);
  });

  it("isProductStatus handles vertical tab and form feed", () => {
    expect(isProductStatus("\vAVAILABLE\f")).toBe(true);
    expect(isProductStatus("\v  \f")).toBe(false);
  });

  it("isProductStatus handles non-breaking space", () => {
    expect(isProductStatus("\u00A0AVAILABLE\u00A0")).toBe(true);
    expect(isProductStatus("\u00A0  \u00A0")).toBe(false);
  });

  it("productStatusLabel returns Spanish label and falls back", () => {
    expect(productStatusLabel("AVAILABLE")).toBe("Disponible");
    expect(productStatusLabel("SOLD")).toBe("Vendido");
    expect(productStatusLabel("WITHDRAWN")).toBe("Retirado");
    expect(productStatusLabel("UNKNOWN")).toBe("UNKNOWN");
  });

  it("productStatusLabel trims whitespace before lookup", () => {
    expect(productStatusLabel(" AVAILABLE ")).toBe("Disponible");
    expect(productStatusLabel("  UNKNOWN  ")).toBe("  UNKNOWN  ");
  });

  it("PRODUCT_STATUS_LABEL covers all statuses", () => {
    for (const s of PRODUCT_STATUSES) {
      expect(PRODUCT_STATUS_LABEL[s]).toBeTruthy();
    }
  });
});
