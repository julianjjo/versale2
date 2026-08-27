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
