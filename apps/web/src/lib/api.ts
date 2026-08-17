import axios, { type AxiosInstance, type AxiosError } from "axios";
import { tokenStore } from "./token";
import { notifyUnauthorized } from "./auth-events";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const api: AxiosInstance = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      tokenStore.clear();
      // Notify subscribers (AuthProvider) so they can clear state and route
      // to /login via Next router — avoids a full-page reload.
      notifyUnauthorized();
    }
    return Promise.reject(error);
  },
);

export function extractApiError(
  err: unknown,
  fallback = "Ocurrió un error. Intenta de nuevo.",
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[] }
      | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(", ") : data.message;
    }
    // No response.data.message means the backend never responded (network
    // failure, timeout, CORS) — axios's own error text ("Network Error") is
    // English and would leak into the UI, so fall back to the caller's copy.
    return fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// A request made with `responseType: "blob"` (a file download, e.g. the CSV
// export) gets its ERROR body decoded as a Blob too — axios applies the
// request's responseType to non-2xx responses the same as 2xx ones — so
// `extractApiError`'s `.message` read is silently a no-op for it even though
// the backend sent a normal JSON error body. This re-reads that Blob as
// text and parses it before falling back to extractApiError's own handling.
export async function extractBlobApiError(
  err: unknown,
  fallback = "Ocurrió un error. Intenta de nuevo.",
): Promise<string> {
  if (
    axios.isAxiosError(err) &&
    err.response?.data instanceof Blob &&
    err.response.data.type.includes("json")
  ) {
    try {
      const data = JSON.parse(await err.response.data.text()) as {
        message?: string | string[];
      };
      if (data?.message) {
        return Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message;
      }
    } catch {
      // Not parseable JSON after all — fall through to the generic path.
    }
  }
  return extractApiError(err, fallback);
}
