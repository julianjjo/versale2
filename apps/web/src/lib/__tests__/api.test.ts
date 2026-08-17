import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";
import { extractApiError, extractBlobApiError } from "../api";

vi.mock("../token", () => ({
  tokenStore: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  },
}));

import { tokenStore } from "../token";
import { api } from "../api";
import { onUnauthorized } from "../auth-events";

const mockedTokenStore = tokenStore as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

describe("api client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes a baseURL from env or falls back to localhost:3001", () => {
    expect(api.defaults.baseURL).toBeDefined();
  });

  it("attaches Authorization header when a token is present", async () => {
    mockedTokenStore.get.mockReturnValue("token-123");
    const response = await api.get("/products", {
      adapter: async (config) => ({
        data: null,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
        request: {},
      }),
    });
    expect(response.config.headers.get("Authorization")).toBe(
      "Bearer token-123",
    );
  });

  it("does not attach Authorization header when no token is present", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    const response = await api.get("/products", {
      adapter: async (config) => ({
        data: null,
        status: 200,
        statusText: "OK",
        headers: {},
        config,
        request: {},
      }),
    });
    expect(response.config.headers.get("Authorization")).toBeUndefined();
  });

  it("clears the token and notifies unauthorized subscribers on 401", async () => {
    const handler = vi.fn();
    const off = onUnauthorized(handler);

    mockedTokenStore.get.mockReturnValue("stale");
    await expect(
      api.get("/products", {
        adapter: async () => {
          throw {
            isAxiosError: true,
            response: { status: 401, data: { message: "Unauthorized" } },
            config: { url: "/products" },
            toJSON: () => ({}),
            name: "AxiosError",
            message: "Request failed",
          };
        },
      }),
    ).rejects.toBeDefined();

    expect(mockedTokenStore.clear).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("notifies unauthorized subscribers even on /login and /signup", async () => {
    // The api client is path-agnostic: it always notifies on 401 so the
    // AuthProvider can decide whether to redirect. This keeps api.ts simple.
    const handler = vi.fn();
    const off = onUnauthorized(handler);

    await expect(
      api.get("/auth/login", {
        adapter: async () => {
          throw {
            isAxiosError: true,
            response: { status: 401, data: { message: "Bad creds" } },
            config: { url: "/auth/login" },
            toJSON: () => ({}),
            name: "AxiosError",
            message: "Request failed",
          };
        },
      }),
    ).rejects.toBeDefined();

    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("does not call subscribers on non-401 errors", async () => {
    const handler = vi.fn();
    const off = onUnauthorized(handler);

    await expect(
      api.get("/products", {
        adapter: async () => {
          throw {
            isAxiosError: true,
            response: { status: 500, data: { message: "Boom" } },
            config: { url: "/products" },
            toJSON: () => ({}),
            name: "AxiosError",
            message: "Request failed",
          };
        },
      }),
    ).rejects.toBeDefined();

    expect(handler).not.toHaveBeenCalled();
    off();
  });
});

describe("extractApiError", () => {
  it("returns the backend message string when present", () => {
    const err = new axios.AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      { url: "/x" } as never,
      null,
      { status: 400, data: { message: "Bad input" } } as never,
    );
    expect(extractApiError(err, "fallback")).toBe("Bad input");
  });

  it("joins multiple messages with comma", () => {
    const err = new axios.AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      { url: "/x" } as never,
      null,
      {
        status: 400,
        data: { message: ["name required", "email required"] },
      } as never,
    );
    expect(extractApiError(err, "fallback")).toBe(
      "name required, email required",
    );
  });

  it("returns Error message for non-axios errors", () => {
    expect(extractApiError(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns the fallback instead of axios's English network-error text", () => {
    const err = new axios.AxiosError(
      "Network Error",
      "ERR_NETWORK",
      { url: "/x" } as never,
      null,
      undefined,
    );
    expect(extractApiError(err, "No pudimos iniciar sesión")).toBe(
      "No pudimos iniciar sesión",
    );
  });

  it("returns the fallback for unknown errors", () => {
    expect(extractApiError("string error", "Default fallback")).toBe(
      "Default fallback",
    );
  });
});

describe("extractBlobApiError", () => {
  it("reads the real backend message out of a Blob-typed error response", async () => {
    const blob = new Blob([JSON.stringify({ message: "No autorizado" })], {
      type: "application/json",
    });
    const err = new axios.AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      { url: "/x" } as never,
      null,
      { status: 403, data: blob } as never,
    );
    await expect(extractBlobApiError(err, "fallback")).resolves.toBe(
      "No autorizado",
    );
  });

  it("joins multiple messages from a Blob error body", async () => {
    const blob = new Blob([JSON.stringify({ message: ["a", "b"] })], {
      type: "application/json",
    });
    const err = new axios.AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      { url: "/x" } as never,
      null,
      { status: 400, data: blob } as never,
    );
    await expect(extractBlobApiError(err, "fallback")).resolves.toBe("a, b");
  });

  it("falls back when the Blob isn't JSON-typed", async () => {
    const blob = new Blob(["ID,Comprador"], { type: "text/csv" });
    const err = new axios.AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      { url: "/x" } as never,
      null,
      { status: 500, data: blob } as never,
    );
    await expect(extractBlobApiError(err, "fallback")).resolves.toBe(
      "fallback",
    );
  });

  it("falls back when a Blob claims JSON but the body doesn't parse", async () => {
    const blob = new Blob(["not valid json"], { type: "application/json" });
    const err = new axios.AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      { url: "/x" } as never,
      null,
      { status: 500, data: blob } as never,
    );
    await expect(extractBlobApiError(err, "fallback")).resolves.toBe(
      "fallback",
    );
  });

  it("delegates to extractApiError for a non-Blob response", async () => {
    const err = new axios.AxiosError(
      "Request failed",
      "ERR_BAD_REQUEST",
      { url: "/x" } as never,
      null,
      { status: 400, data: { message: "Bad input" } } as never,
    );
    await expect(extractBlobApiError(err, "fallback")).resolves.toBe(
      "Bad input",
    );
  });

  it("returns Error message for a non-axios error, same as extractApiError", async () => {
    await expect(
      extractBlobApiError(new Error("boom"), "fallback"),
    ).resolves.toBe("boom");
  });
});
