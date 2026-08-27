import { readString, writeString, removeKey } from "./storage";
const TOKEN_KEY = "versale_token";
const AUTH_EVENT = "versale:auth-change";
// ponytail: deleted BroadcastChannel dup; storage+CustomEvent cover cross/same-tab; restore BC if need instant cross-tab without storage round-trip

function emitAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
}

export const tokenStore = {
  get(): string | null {
    return readString(TOKEN_KEY);
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    const t=token.trim();
    if (!t) return;
    writeString(TOKEN_KEY, t);
    emitAuthChange();
  },
  clear() {
    if (typeof window === "undefined") return;
    removeKey(TOKEN_KEY);
    emitAuthChange();
  },
  subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const storageHandler = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) onChange();
    };
    const customHandler = () => onChange();
    window.addEventListener("storage", storageHandler);
    window.addEventListener(AUTH_EVENT, customHandler);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener(AUTH_EVENT, customHandler);
    };
  },
};
