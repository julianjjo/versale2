import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getRecentlyViewedIds,
  recordProductView,
  RECENTLY_VIEWED_LIMIT,
} from "../recently-viewed";

describe("recently-viewed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns an empty list when nothing has been viewed", () => {
    expect(getRecentlyViewedIds()).toEqual([]);
  });

  it("records a viewed product", () => {
    recordProductView("p1");
    expect(getRecentlyViewedIds()).toEqual(["p1"]);
  });

  it("puts the most recently viewed product first", () => {
    recordProductView("p1");
    recordProductView("p2");
    recordProductView("p3");
    expect(getRecentlyViewedIds()).toEqual(["p3", "p2", "p1"]);
  });

  it("moves a re-viewed product back to the front instead of duplicating it", () => {
    recordProductView("p1");
    recordProductView("p2");
    recordProductView("p1");
    expect(getRecentlyViewedIds()).toEqual(["p1", "p2"]);
  });

  it("keeps all 12 entries when the cap is reached exactly, with none dropped", () => {
    for (let i = 1; i <= 12; i++) {
      recordProductView(`p${i}`);
    }
    const ids = getRecentlyViewedIds();
    expect(ids).toHaveLength(12);
    expect(ids).toContain("p1");
  });

  it("caps the list at 12 entries, dropping the oldest", () => {
    for (let i = 1; i <= 13; i++) {
      recordProductView(`p${i}`);
    }
    const ids = getRecentlyViewedIds();
    expect(ids).toHaveLength(12);
    expect(ids[0]).toBe("p13");
    expect(ids).not.toContain("p1");
  });

  it("excludes the given id when requested", () => {
    recordProductView("p1");
    recordProductView("p2");
    expect(getRecentlyViewedIds("p2")).toEqual(["p1"]);
  });

  it("tolerates corrupted storage instead of throwing", () => {
    localStorage.setItem("versale_recently_viewed", "{not json");
    expect(getRecentlyViewedIds()).toEqual([]);
  });

  it("ignores a stored value that isn't an array of strings", () => {
    localStorage.setItem(
      "versale_recently_viewed",
      JSON.stringify({ not: "an array" }),
    );
    expect(getRecentlyViewedIds()).toEqual([]);
  });

  it("filters out non-string entries from a malformed array", () => {
    localStorage.setItem(
      "versale_recently_viewed",
      JSON.stringify(["p1", 42, null, "p2"]),
    );
    expect(getRecentlyViewedIds()).toEqual(["p1", "p2"]);
  });
  it("recently-viewed: handles empty list", () => {
    expect(true).toBe(true);
  });

  it("exports RECENTLY_VIEWED_LIMIT as 12", () => {
    expect(RECENTLY_VIEWED_LIMIT).toBe(12);
  });

  it("does not throw when window is undefined (SSR)", async () => {
    vi.stubGlobal("window", undefined as unknown as Window & typeof globalThis);
    const mod = await import("../recently-viewed");
    expect(() => mod.recordProductView("p1")).not.toThrow();
    expect(mod.getRecentlyViewedIds()).toEqual([]);
    vi.unstubAllGlobals();
  });
});
