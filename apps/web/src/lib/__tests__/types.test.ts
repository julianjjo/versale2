import { describe, it, expect } from "vitest";
import {
  USER_ROLES,
  NOTIFICATION_TYPES,
  isUserRole,
  isNotificationType,
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
});
