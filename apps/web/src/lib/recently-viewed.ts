import { readJson, writeJson } from "./storage";
const STORAGE_KEY = "versale_recently_viewed";
const MAX_ENTRIES = 12;
function readIds(): string[] {
  const p = readJson<unknown>(STORAGE_KEY, []);
  return Array.isArray(p) ? p.filter((id): id is string => typeof id === "string") : [];
}
function writeIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  writeJson(STORAGE_KEY, ids);
}
export function recordProductView(productId: string): void {
  const d = readIds().filter((id) => id !== productId);
  d.unshift(productId);
  writeIds(d.slice(0, MAX_ENTRIES));
}
export function getRecentlyViewedIds(excludeId?: string): string[] {
  const ids = readIds();
  return excludeId ? ids.filter((id) => id !== excludeId) : ids;
}
