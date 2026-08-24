export function onUnauthorized(h: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("versale:unauthorized", h);
  return () => window.removeEventListener("versale:unauthorized", h);
}
export function notifyUnauthorized(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("versale:unauthorized"));
}
