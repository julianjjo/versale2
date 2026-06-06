import { describe, it, expect, beforeEach } from "vitest";
import { tokenStore } from "../token";

describe("tokenStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when no token is stored", () => {
    expect(tokenStore.get()).toBeNull();
  });

  it("stores a token", () => {
    tokenStore.set("abc123");
    expect(tokenStore.get()).toBe("abc123");
    expect(localStorage.getItem("versale_token")).toBe("abc123");
  });

  it("clears the token", () => {
    tokenStore.set("xyz");
    expect(tokenStore.get()).toBe("xyz");
    tokenStore.clear();
    expect(tokenStore.get()).toBeNull();
    expect(localStorage.getItem("versale_token")).toBeNull();
  });

  it("overwrites an existing token", () => {
    tokenStore.set("first");
    tokenStore.set("second");
    expect(tokenStore.get()).toBe("second");
  });
});
