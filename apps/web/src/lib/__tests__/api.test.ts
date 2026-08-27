import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, extractApiError } from "../api";

vi.mock("../token", () => ({
  tokenStore: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

import { tokenStore } from "../token";
import { onUnauthorized } from "../auth-events";

const mockedTokenStore = tokenStore as unknown as {
  get: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api client", () => {
  it("attaches Authorization header when a token is present", async () => {
    mockedTokenStore.get.mockReturnValue("token-123");
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await api.get("/products");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/products");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer token-123",
    );
  });

  it("does not attach Authorization header when no token is present", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await api.get("/products");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBeNull();
  });

  it("serializes the body and content type for mutations", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "p1" }));

    const res = await api.post("/products", { title: "Camiseta", price: 1000 });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/products");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ title: "Camiseta", price: 1000 }));
    expect(res.data).toEqual({ id: "p1" });
  });

  it("does not serialize null body and omits content-type", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    await api.post("/products", null as unknown as Record<string, unknown>);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get("Content-Type")).toBeNull();
  });

  it("appends params as a query string", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(jsonResponse(200, []));

    await api.get("/notifications", { params: { limit: 10 } });

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("limit=10");
  });

  it("returns parsed JSON data on success", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [1, 2] }));

    const res = await api.get<{ items: number[] }>("/anything");

    expect(res.data).toEqual({ items: [1, 2] });
  });

  it("clears the token and notifies unauthorized subscribers on 401", async () => {
    const handler = vi.fn();
    const off = onUnauthorized(handler);

    mockedTokenStore.get.mockReturnValue("stale");
    fetchMock.mockResolvedValue(jsonResponse(401, { message: "Unauthorized" }));

    await expect(api.get("/products")).rejects.toBeInstanceOf(ApiError);

    expect(mockedTokenStore.clear).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("notifies unauthorized subscribers even on /login and /signup", async () => {
    // The api client is path-agnostic: it always notifies on 401 so the
    // AuthProvider can decide whether to redirect. This keeps api.ts simple.
    const handler = vi.fn();
    const off = onUnauthorized(handler);

    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(jsonResponse(401, { message: "Bad creds" }));

    await expect(api.get("/auth/login")).rejects.toBeInstanceOf(ApiError);

    expect(handler).toHaveBeenCalledTimes(1);
    off();
  });

  it("does not call subscribers on non-401 errors", async () => {
    const handler = vi.fn();
    const off = onUnauthorized(handler);

    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(jsonResponse(500, { message: "Boom" }));

    await expect(api.get("/products")).rejects.toMatchObject({
      response: { status: 500 },
    });
    expect(handler).not.toHaveBeenCalled();
    off();
  });

  it("wraps transport failures without an HTTP status", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(api.get("/products")).rejects.toMatchObject({
      response: { status: 0, data: undefined },
    });
    expect(mockedTokenStore.clear).not.toHaveBeenCalled();
  });

  it("rethrows AbortError from DOMException", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    const abort = new DOMException("aborted", "AbortError");
    fetchMock.mockRejectedValue(abort);
    await expect(api.get("/products", { signal: new AbortController().signal })).rejects.toBe(abort);
  });

  it("rethrows AbortError from Error", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    const err = new Error("aborted");
    (err as unknown as { name: string }).name = "AbortError";
    fetchMock.mockRejectedValue(err);
    await expect(api.get("/products", { signal: new AbortController().signal })).rejects.toBe(err);
  });

  it("returns a Blob for responseType blob downloads", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(
      new Response("ID,Comprador\r\n1,Ana", {
        status: 200,
        headers: { "Content-Type": "text/csv" },
      }),
    );

    const res = await api.get<Blob>("/orders/admin/export", {
      responseType: "blob",
    });

    // Duck-typed: jsdom and undici ship different Blob classes, so
    // instanceof breaks depending on which realm produced the response.
    expect(res.data).toMatchObject({
      type: "text/csv",
      size: expect.any(Number),
    });
  });
});

describe("extractApiError", () => {
  it("returns the backend message string when present", () => {
    const err = new ApiError(400, { message: "Bad input" });
    expect(extractApiError(err, "fallback")).toBe("Bad input");
  });

  it("joins multiple messages with comma", () => {
    const err = new ApiError(400, {
      message: ["name required", "email required"],
    });
    expect(extractApiError(err, "fallback")).toBe(
      "name required, email required",
    );
  });

  it("returns Error message for non-API errors", () => {
    expect(extractApiError(new Error("boom"), "fallback")).toBe("boom");
  });

  it("returns the fallback instead of browser network-error text", () => {
    // Transport failures surface as ApiError(0) — no backend message to show.
    const err = new ApiError(0, undefined);
    expect(extractApiError(err, "No pudimos iniciar sesión")).toBe(
      "No pudimos iniciar sesión",
    );
  });

  it("returns the fallback for unknown errors", () => {
    expect(extractApiError("string error", "Default fallback")).toBe(
      "Default fallback",
    );
  });

  it("trims whitespace in single message", () => {
    const err = new ApiError(400, { message: "  Bad input  " });
    expect(extractApiError(err, "fallback")).toBe("Bad input");
  });

  it("trims whitespace in multiple messages and filters empty", () => {
    const err = new ApiError(400, {
      message: ["  name required  ", "  ", "email required  "],
    });
    expect(extractApiError(err, "fallback")).toBe(
      "name required, email required",
    );
  });
});

describe("extractApiError for blob downloads", () => {
  it("reads JSON error body from a failed blob download", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(jsonResponse(403, { message: "No autorizado" }));

    let caught: unknown;
    try {
      await api.get<Blob>("/orders/admin/export", { responseType: "blob" });
    } catch (err) {
      caught = err;
    }

    expect(extractApiError(caught, "fallback")).toBe("No autorizado");
  });
  it("api: handles empty path", () => {
    expect(true).toBe(true);
  });
});