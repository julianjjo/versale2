import { describe, it, expect, beforeEach, vi } from "vitest";
import axios from "axios";
import { extractApiError } from "../api";

vi.mock("../token", () => ({
  tokenStore: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  },
}));

import { tokenStore } from "../token";
import { api } from "../api";

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

  it("clears the token and redirects to /login on 401 (not on /login or /signup)", async () => {
    const originalHref = window.location.href;
    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: "/products", href: originalHref },
      writable: true,
      configurable: true,
    });

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
    expect(window.location.href).toBe("/login");
  });

  it("does not redirect when 401 happens on /login", async () => {
    Object.defineProperty(window, "location", {
      value: { ...window.location, pathname: "/login" },
      writable: true,
      configurable: true,
    });
    const hrefBefore = window.location.href;

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

    expect(window.location.href).toBe(hrefBefore);
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

  it("returns the fallback for unknown errors", () => {
    expect(extractApiError("string error", "Default fallback")).toBe(
      "Default fallback",
    );
  });
});
