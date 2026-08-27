export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const r = window.localStorage.getItem(key);
    return r ? (JSON.parse(r) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeJson(key: string, v: unknown): void {
  if (typeof window === "undefined") return;
  let serialized: string;
  try {
    serialized = JSON.stringify(v);
  } catch {
    return;
  }
  try {
    window.localStorage.setItem(key, serialized);
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      try {
        window.localStorage.removeItem(key);
        window.localStorage.setItem(key, serialized);
      } catch {}
    }
  }
}
export function removeKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {}
}
export function readString(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeString(key: string, v: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, v);
  } catch (e) {
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      try {
        window.localStorage.removeItem(key);
        window.localStorage.setItem(key, v);
      } catch {}
    }
  }
}
