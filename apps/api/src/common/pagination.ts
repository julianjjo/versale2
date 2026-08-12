// Single source of truth for page/limit clamping across every paginated
// endpoint. Query strings arrive unvalidated, and Prisma rejects a negative
// `skip` or a fractional `take` with an unhandled error, so anything that is
// not a positive integer has to be normalised before it reaches the client.
// Keeping this in one place is what stops the next paginated endpoint from
// shipping without a ceiling.
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;

export interface Pagination {
  pageNum: number;
  limitNum: number;
  skip: number;
}

function toPositiveInt(value: unknown): number | undefined {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : undefined;
}

export function resolvePagination(page: unknown, limit: unknown): Pagination {
  const pageNum = toPositiveInt(page) ?? 1;
  const limitNum = Math.min(
    toPositiveInt(limit) ?? DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
  );

  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
}
