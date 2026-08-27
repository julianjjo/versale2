import { describe, it, expect, vi } from "vitest";
import { onUnauthorized, notifyUnauthorized } from "../auth-events";

describe("auth-events", () => {
  it("onUnauthorized subscribes and returns unsubscribe", () => {
    const h = vi.fn();
    const off = onUnauthorized(h);
    window.dispatchEvent(new CustomEvent("versale:unauthorized"));
    expect(h).toHaveBeenCalledTimes(1);
    off();
    window.dispatchEvent(new CustomEvent("versale:unauthorized"));
    expect(h).toHaveBeenCalledTimes(1);
  });

  it("notifyUnauthorized dispatches event", () => {
    const h = vi.fn();
    window.addEventListener("versale:unauthorized", h);
    notifyUnauthorized();
    expect(h).toHaveBeenCalledTimes(1);
    window.removeEventListener("versale:unauthorized", h);
  });

  it("multiple listeners all fire", () => {
    const a = vi.fn();
    const b = vi.fn();
    const offA = onUnauthorized(a);
    const offB = onUnauthorized(b);
    notifyUnauthorized();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    offA();
    offB();
  });

  it("off is idempotent", () => {
    const h = vi.fn();
    const off = onUnauthorized(h);
    off();
    off();
    notifyUnauthorized();
    expect(h).not.toHaveBeenCalled();
  });

  it("does not throw when window is undefined (SSR)", async () => {
    vi.stubGlobal("window", undefined as unknown as Window & typeof globalThis);
    const mod = await import("../auth-events");
    expect(() => mod.notifyUnauthorized()).not.toThrow();
    const off = mod.onUnauthorized(() => {});
    expect(typeof off).toBe("function");
    expect(() => off()).not.toThrow();
    vi.unstubAllGlobals();
  });
});
