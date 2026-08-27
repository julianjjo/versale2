export function asRecord(query: unknown): Record<string, unknown> {
  return query !== null && typeof query === 'object' && !Array.isArray(query)
    ? (query as Record<string, unknown>)
    : {};
}
