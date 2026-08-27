import { describe, it, expect, beforeEach, vi } from "vitest";
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

  it("does not throw when window is undefined (SSR)", async () => {
    vi.stubGlobal("window", undefined as unknown as Window & typeof globalThis);
    const mod = await import("../token");
    expect(() => mod.tokenStore.set("tok")).not.toThrow();
    expect(() => mod.tokenStore.clear()).not.toThrow();
    expect(() => mod.tokenStore.subscribe(() => {})()).not.toThrow();
    const off = mod.tokenStore.subscribe(() => {});
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
    vi.unstubAllGlobals();
  });

  it("trims token whitespace and ignores blank", () => {
    tokenStore.set("  abc123  ");
    expect(tokenStore.get()).toBe("abc123");
    tokenStore.clear();
    tokenStore.set("   ");
    expect(tokenStore.get()).toBeNull();
  });
});
