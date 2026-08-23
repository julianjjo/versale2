// react-query's `error` is typed `unknown`, and the api client doesn't thread
// its response shape through it — every page that needs to distinguish a real
// HTTP status (404, 403, ...) from a transient failure (network error,
// timeout, 5xx) has to narrow it by hand. Centralizing that narrowing is what
// stops each page from re-deriving (and possibly disagreeing on) the same
// "what status did this actually fail with" check.
export function getHttpStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } } | null)?.response?.status;
}

// A query error is "terminal" (show a dead-end empty state) when its status
// is one of `terminalStatuses`; anything else — including a network error
// with no `.response` at all — is transient and deserves a retry instead.
// Callers pick their own terminal set because it's endpoint-specific: an
// endpoint that can never itself respond 403 is safe treating "anything but
// 404" as terminal, while one that legitimately throws 403 for a non-owner
// needs to list it explicitly so a non-owner sees the same dead end as a 404
// (not a misleading "retry" prompt).
export function isTerminalError(
  error: unknown,
  terminalStatuses: number[],
): boolean {
  const status = getHttpStatus(error);
  return status !== undefined && terminalStatuses.includes(status);
}
