export function mergeFacetOptions(fetched: string[] | undefined, current: string): string[] {
  const trimmed = current.trim();
  const options = fetched ?? [];
  return trimmed && !options.some((o) => o.toLowerCase() === trimmed.toLowerCase()) ? [trimmed, ...options] : options;
}

export function parseAmount(raw: string | null): number | undefined {
  if (!raw || !raw.trim()) return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parsePage(raw: string | null): number | undefined {
  if (!raw || !raw.trim()) return undefined;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
}

export const SORT_OPTIONS = [
  { value: "price_asc", label: "Precio: menor a mayor" },
  { value: "price_desc", label: "Precio: mayor a menor" },
  { value: "most_viewed", label: "Más vistos" },
  { value: "most_favorited", label: "Más favoritos" },
  { value: "top_rated", label: "Mejor valorados" },
] as const;

export type SortByValue = (typeof SORT_OPTIONS)[number]["value"];

export function isSortByValue(value: string): value is SortByValue {
  return SORT_OPTIONS.some((option) => option.value === value);
}
