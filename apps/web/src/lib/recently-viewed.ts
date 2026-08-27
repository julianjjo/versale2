import { readJson, writeJson } from "./storage";
export const RECENTLY_VIEWED_LIMIT = 12;
export const STORAGE_KEY = "versale_recently_viewed";
export function recordProductView(productId: string): void {
  const trimmed = productId.trim();
  if (!trimmed) return;
  if (typeof window === "undefined") return;
  const p = readJson<unknown>(STORAGE_KEY, []);
  const ids = Array.isArray(p)
    ? p.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean)
    : [];
  const d = ids.filter((id) => id !== trimmed);
  d.unshift(trimmed);
  writeJson(STORAGE_KEY, d.slice(0, RECENTLY_VIEWED_LIMIT));
}

export function getRecentlyViewedIds(excludeId?: string): string[] {
  const p = readJson<unknown>(STORAGE_KEY, []);
  const ids = Array.isArray(p)
    ? p.filter((id): id is string => typeof id === "string").map((id) => id.trim()).filter(Boolean)
    : [];
  const trimmedExclude = excludeId?.trim();
  const filtered = trimmedExclude ? ids.filter((id) => id !== trimmedExclude) : ids;
  return filtered.slice(0, RECENTLY_VIEWED_LIMIT);
}
