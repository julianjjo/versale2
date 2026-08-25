import { readString, writeString, removeKey } from "./storage";
const TOKEN_KEY = "versale_token";
const AUTH_EVENT = "versale:auth-change";
const AUTH_CHANNEL = "versale-auth";

function emitAuthChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_EVENT));
  try {
    const ch = new BroadcastChannel(AUTH_CHANNEL);
    ch.postMessage(TOKEN_KEY);
    ch.close();
  } catch {}
}

export const tokenStore = {
  get(): string | null {
    return readString(TOKEN_KEY);
  },
  set(token: string) {
    if (typeof window === "undefined") return;
    writeString(TOKEN_KEY, token);
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
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel(AUTH_CHANNEL);
      bc.onmessage = () => onChange();
    } catch {}
    window.addEventListener("storage", storageHandler);
    window.addEventListener(AUTH_EVENT, customHandler);
    return () => {
      window.removeEventListener("storage", storageHandler);
      window.removeEventListener(AUTH_EVENT, customHandler);
      if (bc) bc.close();
    };
  },
};
