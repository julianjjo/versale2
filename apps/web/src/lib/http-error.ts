export function getHttpStatus(e: unknown): number | undefined {
  return (e as { response?: { status?: number } } | null)?.response?.status;
}
export function isTerminalError(e: unknown, s: number[]): boolean {
  const c = getHttpStatus(e);
  return c !== undefined && s.includes(c);
}
