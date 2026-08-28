// Single source of truth for narrowing an unvalidated `query` argument into a
// readable object. Controllers hand services the raw Express query, which is
// typed `unknown` because a client can send `?a[]=1` (an array) or nothing at
// all. Destructuring either of those directly throws or silently yields
// garbage, so every paginated endpoint used to repeat the same three-line
// guard. Keeping it here is what stops the next endpoint from inventing a
// twelfth copy that forgets the Array.isArray branch.
export function asRecord(query: unknown): Record<string, unknown> {
  return query !== null && typeof query === 'object' && !Array.isArray(query)
    ? (query as Record<string, unknown>)
    : {};
}
