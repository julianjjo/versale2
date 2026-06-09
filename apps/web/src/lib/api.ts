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
  fallback = "Request failed",
): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as
      | { message?: string | string[] }
      | undefined;
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(", ") : data.message;
    }
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
