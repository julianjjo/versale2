const STORAGE_KEY = "versale_recently_viewed";

// A used-clothing listing is a one-off — there's no "back in stock" for a
// shopper who navigated away from it, so this is worth persisting per
// browser (no account needed) rather than just in memory for the session.
const MAX_ENTRIES = 12;

function readIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage can be full or disabled (private browsing) — this is a
    // nice-to-have feature, never worth surfacing an error for.
  }
}

// Moves productId to the front (deduping any prior occurrence) and caps the
// list, so the most recently viewed product is always first and the list
// never grows unbounded.
export function recordProductView(productId: string): void {
  const deduped = readIds().filter((id) => id !== productId);
  deduped.unshift(productId);
  writeIds(deduped.slice(0, MAX_ENTRIES));
}

export function getRecentlyViewedIds(excludeId?: string): string[] {
  const ids = readIds();
  return excludeId ? ids.filter((id) => id !== excludeId) : ids;
}
