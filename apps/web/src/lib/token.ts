import { readString, writeString, removeKey } from "./storage";
const TOKEN_KEY = "versale_token";
export const tokenStore = {
  get(): string | null {
    return readString(TOKEN_KEY);
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    writeString(TOKEN_KEY, token);
  },
  clear() {
    if (typeof window === "undefined") return;
    removeKey(TOKEN_KEY);
  },
  subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const h = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY) onChange();
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  },
};
