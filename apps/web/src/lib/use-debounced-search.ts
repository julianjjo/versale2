"use client";
import { useEffect, useState } from "react";
export function useDebouncedSearch(onCommit?: () => void, delay = 300) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      const n = searchInput.trim();
      if (n === search) return;
      setSearch(n);
      onCommit?.();
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput, search, delay]);
  return { searchInput, setSearchInput, search };
}
