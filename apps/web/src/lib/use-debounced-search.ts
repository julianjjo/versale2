"use client";
import { useEffect, useRef, useState } from "react";
export function useDebouncedSearch(onCommit?: () => void, delay = 300) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const commitRef = useRef(onCommit);
  useEffect(() => {
    commitRef.current = onCommit;
  }, [onCommit]);
  useEffect(() => {
    const t = setTimeout(() => {
      const n = searchInput.trim();
      if (n === search) return;
      setSearch(n);
      commitRef.current?.();
    }, delay);
    return () => clearTimeout(t);
  }, [searchInput, search, delay]);
  return { searchInput, setSearchInput, search };
}
