import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedSearch } from "../use-debounced-search";

describe("useDebouncedSearch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("initializes with empty search and searchInput", () => {
    const { result } = renderHook(() => useDebouncedSearch());
    expect(result.current.searchInput).toBe("");
    expect(result.current.search).toBe("");
  });

  it("updates searchInput immediately", () => {
    const { result } = renderHook(() => useDebouncedSearch());
    act(() => result.current.setSearchInput("hello"));
    expect(result.current.searchInput).toBe("hello");
    expect(result.current.search).toBe("");
  });

  it("commits debounced trimmed search after delay", () => {
    const { result } = renderHook(() => useDebouncedSearch(undefined, 300));
    act(() => result.current.setSearchInput("  hello  "));
    act(() => vi.advanceTimersByTime(300));
    expect(result.current.search).toBe("hello");
  });

  it("does not commit if trimmed value equals current search", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch(onCommit, 300));
    act(() => result.current.setSearchInput("a"));
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).toHaveBeenCalledTimes(1);
    // same value again
    act(() => result.current.setSearchInput("a"));
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(result.current.search).toBe("a");
  });

  it("calls onCommit on change", () => {
    const onCommit = vi.fn();
    const { result } = renderHook(() => useDebouncedSearch(onCommit, 300));
    act(() => result.current.setSearchInput("x"));
    act(() => vi.advanceTimersByTime(300));
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("picks up latest onCommit via ref", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useDebouncedSearch(cb, 300),
      { initialProps: { cb: first } },
    );
    act(() => result.current.setSearchInput("hi"));
    rerender({ cb: second });
    act(() => vi.advanceTimersByTime(300));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("respects custom delay", () => {
    const { result } = renderHook(() => useDebouncedSearch(undefined, 100));
    act(() => result.current.setSearchInput("y"));
    act(() => vi.advanceTimersByTime(50));
    expect(result.current.search).toBe("");
    act(() => vi.advanceTimersByTime(50));
    expect(result.current.search).toBe("y");
  });

  it("clears pending timer on unmount", () => {
    const { result, unmount } = renderHook(() =>
      useDebouncedSearch(undefined, 300),
    );
    act(() => result.current.setSearchInput("z"));
    unmount();
    act(() => vi.advanceTimersByTime(300));
    // no throw, search not updated after unmount
  });
});
