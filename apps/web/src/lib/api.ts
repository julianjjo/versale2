import { tokenStore } from "./token";
import { notifyUnauthorized } from "./auth-events";
import { API_URL } from "./site";

// Thrown for every non-2xx response so callers can narrow by status and read
// the backend's message body (`error.response.status`, `.response.data`).
export class ApiError extends Error {
  readonly status: number;
  readonly response: { status: number; data: unknown };

  constructor(status: number, data: unknown) {
    super(`Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.response = { status, data };
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>;

export interface RequestConfig {
  params?: QueryParams;
  /** `"blob"` for file downloads (CSV export): `data` comes back as a Blob. */
  responseType?: "json" | "blob";
}

function buildUrl(path: string, config?: RequestConfig): string {
  const url = new URL(path, API_URL);
  for (const [key, value] of Object.entries(config?.params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

// The error body is always decoded as text and JSON-parsed when possible,
// regardless of the request's responseType — a failed CSV download still
// carries a normal JSON error body, and callers shouldn't have to know.
async function toApiError(response: Response): Promise<ApiError> {
  let data: unknown;
  try {
    const text = await response.text();
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = undefined;
  }
  return new ApiError(response.status, data);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  config?: RequestConfig,
): Promise<{ data: T }> {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined && !isFormData) {
    headers["Content-Type"] = "application/json";
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, config), {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    // Transport-level failure (offline, DNS, CORS): no status exists, so
    // report one that reads as "no HTTP response" instead of letting the
    // browser's English TypeError leak toward the UI.
    throw new ApiError(0, undefined);
  }

  if (!response.ok) {
    if (response.status === 401) {
      tokenStore.clear();
      // Notify subscribers (AuthProvider) so they can clear state and route
      // to /login via Next router — avoids a full-page reload.
      notifyUnauthorized();
    }
    throw await toApiError(response);
  }

  if (config?.responseType === "blob") {
    return { data: (await response.blob()) as T };
  }
  if (response.status === 204) return { data: undefined as T };
  const text = await response.text();
  return { data: (text ? JSON.parse(text) : undefined) as T };
}

// `any` on purpose: untyped call sites get axios's old ergonomics back
// (`res.data` stays fluid); callers that pass an explicit generic keep the
// narrow type.
/* eslint-disable @typescript-eslint/no-explicit-any */
export const api = {
  get: <T = any>(path: string, config?: RequestConfig) =>
    request<T>("GET", path, undefined, config),
  post: <T = any>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>("POST", path, body, config),
  put: <T = any>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>("PUT", path, body, config),
  patch: <T = any>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>("PATCH", path, body, config),
  // Body opcional: DELETE con payload es legítimo en HTTP y el borrado de
  // cuenta lo usa para llevar la confirmación de contraseña.
  delete: <T = any>(path: string, body?: unknown, config?: RequestConfig) =>
    request<T>("DELETE", path, body, config),
};

export function extractApiError(
  err: unknown,
  fallback = "Ocurrió un error. Intenta de nuevo.",
): string {
  if (err instanceof ApiError) {
    if (err.status === 0) {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.onLine === "boolean" &&
        !navigator.onLine
      ) {
        return "Sin conexión. Verifica tu internet.";
      }
      const data = err.response.data as
        | { message?: string | string[] }
        | undefined;
      if (data?.message) {
        return Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message;
      }
      // Offline-like but navigator thinks we're online (DNS/CORS/timeout).
      // Prefer a specific offline hint over the caller's generic fallback,
      // but keep fallback for callers that have a more contextual message
      // (e.g. "No pudimos eliminar tu cuenta") — tests rely on this.
      // Only use the generic offline Spanish when no caller-specific fallback
      // is distinguishing the context.
      if (fallback === "Ocurrió un error. Intenta de nuevo.") {
        return "Sin conexión. Verifica tu internet.";
      }
      return fallback;
    }
    const data = err.response.data as
      | { message?: string | string[] }
      | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(", ") : data.message;
    }
    // No response.data.message means the backend never responded (network
    // failure, timeout, CORS) — the browser's own error text ("Failed to
    // fetch") is English and would leak into the UI, so fall back to the
    // caller's copy.
    return fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}


