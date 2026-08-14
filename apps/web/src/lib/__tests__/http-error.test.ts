import { describe, it, expect } from "vitest";
import { getHttpStatus, isTerminalError } from "../http-error";

describe("getHttpStatus", () => {
  it("reads the status off an axios-shaped error", () => {
    expect(getHttpStatus({ response: { status: 404 } })).toBe(404);
  });

  it("returns undefined for a network error with no response", () => {
    expect(getHttpStatus(new Error("Network Error"))).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(getHttpStatus(null)).toBeUndefined();
  });
});

describe("isTerminalError", () => {
  it("is true when the status is in the terminal list", () => {
    expect(isTerminalError({ response: { status: 404 } }, [404, 403])).toBe(
      true,
    );
    expect(isTerminalError({ response: { status: 403 } }, [404, 403])).toBe(
      true,
    );
  });

  it("is false for a status outside the terminal list", () => {
    expect(isTerminalError({ response: { status: 500 } }, [404, 403])).toBe(
      false,
    );
  });

  it("is false for a transient network error with no response", () => {
    expect(isTerminalError(new Error("Network Error"), [404])).toBe(false);
  });
});
