"use client";

import { useEffect, useState } from "react";

/**
 * Debounced search box state for the admin panels.
 *
 * `searchInput` is what the field shows on every keystroke; `search` is the
 * committed term that belongs in the query key, 300ms behind it. `onCommit`
 * runs only when the term actually changes, so mounting or a trailing space
 * never resets the page or clears a selection the admin already made.
 */
export function useDebouncedSearch(onCommit?: () => void, delay = 300) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = searchInput.trim();
      if (next === search) return;
      setSearch(next);
      onCommit?.();
    }, delay);
    return () => clearTimeout(timer);
    // `onCommit` is intentionally not a dependency: callers pass an inline
    // arrow, and depending on it would restart the timer on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, search, delay]);

  return { searchInput, setSearchInput, search };
}
