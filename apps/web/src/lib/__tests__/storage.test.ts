import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  readJson,
  writeJson,
  removeKey,
  readString,
  writeString,
} from "../storage";

describe("storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("readJson", () => {
    it("returns fallback when key is missing", () => {
      expect(readJson("missing", { a: 1 })).toEqual({ a: 1 });
    });

    it("parses stored JSON", () => {
      localStorage.setItem("k", JSON.stringify({ x: 42 }));
      expect(readJson("k", null)).toEqual({ x: 42 });
    });

    it("returns fallback on corrupted JSON", () => {
      localStorage.setItem("k", "{not json");
      expect(readJson("k", "fallback")).toBe("fallback");
    });

    it("returns fallback when getItem throws", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("boom");
      });
      expect(readJson("k", "fb")).toBe("fb");
    });
  });

  describe("writeJson", () => {
    it("writes JSON stringified value", () => {
      writeJson("k", { a: 1 });
      expect(JSON.parse(localStorage.getItem("k")!)).toEqual({ a: 1 });
    });

    it("handles QuotaExceededError by removing and retrying", () => {
      const originalSetItem = Storage.prototype.setItem;
      let attempt = 0;
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        key: string,
        value: string,
      ) {
        attempt++;
        if (attempt === 1) throw new DOMException("quota", "QuotaExceededError");
        return originalSetItem.call(this, key, value);
      });
      expect(() => writeJson("quota-key", { v: 1 })).not.toThrow();
      // retry path stores the value
      expect(JSON.parse(localStorage.getItem("quota-key")!)).toEqual({ v: 1 });
    });

    it("does not throw when setItem fails with generic error", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("generic");
      });
      expect(() => writeJson("k", { x: 1 })).not.toThrow();
    });

    it("does not throw when retry after QuotaExceededError also fails", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("x", "QuotaExceededError");
      });
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("remove fails");
      });
      expect(() => writeJson("k", 1)).not.toThrow();
    });
  });

  describe("removeKey", () => {
    it("removes existing key", () => {
      localStorage.setItem("k", "v");
      removeKey("k");
      expect(localStorage.getItem("k")).toBeNull();
    });

    it("does not throw when removeItem throws", () => {
      vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
        throw new Error("boom");
      });
      expect(() => removeKey("k")).not.toThrow();
    });
  });

  describe("readString", () => {
    it("returns null when missing", () => {
      expect(readString("nope")).toBeNull();
    });

    it("returns stored string", () => {
      localStorage.setItem("s", "hello");
      expect(readString("s")).toBe("hello");
    });

    it("returns null when getItem throws", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("boom");
      });
      expect(readString("k")).toBeNull();
    });
  });

  describe("writeString", () => {
    it("writes string value", () => {
      writeString("s", "hi");
      expect(localStorage.getItem("s")).toBe("hi");
    });

    it("does not throw on generic error", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("boom");
      });
      expect(() => writeString("k", "v")).not.toThrow();
    });

    it("handles QuotaExceededError silently", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("x", "QuotaExceededError");
      });
      expect(() => writeString("k", "v")).not.toThrow();
    });
  });

  describe("writeJson circular", () => {
    it("does not throw on circular JSON", () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(() => writeJson("k", circular)).not.toThrow();
      expect(localStorage.getItem("k")).toBeNull();
    });

    it("does not double-stringify already-string values", () => {
      writeJson("k", "already");
      expect(localStorage.getItem("k")).toBe('"already"');
      expect(JSON.parse(localStorage.getItem("k")!)).toBe("already");
    });
  });

  describe("SSR guard (window undefined)", () => {
    it("readJson returns fallback when window is undefined", async () => {
      const origWindow = globalThis.window;
      // @ts-ignore mock undefined
      vi.stubGlobal("window", undefined);
      const mod = await import("../storage");
      // need fresh import with window undefined at module eval
      // but readJson checks typeof window at call time, so direct call
      expect(mod.readJson("any", "fb")).toBe("fb");
      vi.unstubAllGlobals();
      (globalThis as unknown as { window: unknown }).window = origWindow;
    });

    it("writeJson and others do not throw when window is undefined", async () => {
      vi.stubGlobal("window", undefined);
      const mod = await import("../storage");
      expect(() => mod.writeJson("k", { a: 1 })).not.toThrow();
      expect(() => mod.writeString("k", "v")).not.toThrow();
      expect(() => mod.removeKey("k")).not.toThrow();
      expect(mod.readString("k")).toBeNull();
      vi.unstubAllGlobals();
    });
  });
});
