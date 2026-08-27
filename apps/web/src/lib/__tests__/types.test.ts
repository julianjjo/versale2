import { describe, it, expect } from "vitest";
import { USER_ROLES, isUserRole } from "../types";

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
