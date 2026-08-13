// Single source of truth for parsing a positive-integer environment variable
// with a safe fallback. Config values arrive as unvalidated strings, and a
// non-positive, non-finite (Infinity/NaN), or absurdly large value is almost
// always an operator typo rather than an intentional setting — e.g. a
// negative or Infinity limit used to disable rate limiting entirely, or a
// value so large no real traffic could ever reach it, both silently, with no
// boot warning. Keeping this in one place is what stops the next
// env-configured limit from shipping without the same guard.
const MAX_ENV_LIMIT = 1_000_000;

export function parsePositiveIntEnv(
  value: string | undefined,
  fallback: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= MAX_ENV_LIMIT
    ? parsed
    : fallback;
}
