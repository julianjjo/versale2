const TOKEN_KEY = "versale_token";

export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
  },
  // A `storage` event only ever fires in OTHER tabs/windows sharing this
  // origin, never in the tab that made the change — exactly what a "did some
  // other tab log in/out?" listener needs, and exactly why a same-tab
  // set()/clear() can't be caught this way (those tabs already know).
  subscribe(onChange: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    const handler = (event: StorageEvent) => {
      if (event.key === TOKEN_KEY) onChange();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  },
};
