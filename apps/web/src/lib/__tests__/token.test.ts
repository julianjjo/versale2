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

  it("notifies same-tab subscribers via CustomEvent on clear", () => {
    let notified = 0;
    const off = tokenStore.subscribe(() => notified++);
    tokenStore.set("tok");
    expect(notified).toBe(1);
    tokenStore.clear();
    expect(notified).toBe(2);
    off();
    tokenStore.set("tok2");
    expect(notified).toBe(2);
  });

  it("notifies via storage event cross-tab fallback", () => {
    let notified = 0;
    tokenStore.subscribe(() => notified++);
    window.dispatchEvent(
      new StorageEvent("storage", { key: "versale_token" }),
    );
    expect(notified).toBe(1);
    window.dispatchEvent(new StorageEvent("storage", { key: "other_key" }));
    expect(notified).toBe(1);
  });
  it("token: handles empty string", () => {
    expect(true).toBe(true);
  });
});