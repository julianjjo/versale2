import { tokenStore } from "./token";
import { notifyUnauthorized } from "./auth-events";
import { API_URL } from "./site";

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
  signal?: AbortSignal;
}

function buildUrl(path: string, config?: RequestConfig): string {
  const url = new URL(path, API_URL);
  for (const [key, value] of Object.entries(config?.params ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

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
      signal: config?.signal,
    });
  } catch (err) {
    if ((err instanceof DOMException || err instanceof Error) && (err as { name?: string }).name === "AbortError") throw err;
    throw new ApiError(0, undefined);
  }

  if (!response.ok) {
    if (response.status === 401) {
      tokenStore.clear();
      notifyUnauthorized();
    }
    throw await toApiError(response);
  }

  if (config?.responseType === "blob") {
    return { data: (await response.blob()) as T };
  }
  if (response.status === 204) return { data: undefined as T };
  const text = await response.text();
  if (!text) return { data: undefined as T };
  try {
    return { data: JSON.parse(text) as T };
  } catch {
    throw new ApiError(response.status, { message: "Respuesta no válida del servidor" });
  }
}

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
    return fallback;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}


