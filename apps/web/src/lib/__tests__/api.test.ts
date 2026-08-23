import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api, extractApiError, extractBlobApiError } from "../api";

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

    expect(res.data).toBeInstanceOf(Blob);
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
});

describe("extractBlobApiError", () => {
  it("reads the backend JSON error of a blob download (CSV export case)", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(jsonResponse(403, { message: "No autorizado" }));

    let caught: unknown;
    try {
      await api.get<Blob>("/orders/admin/export", { responseType: "blob" });
    } catch (err) {
      caught = err;
    }

    await expect(extractBlobApiError(caught, "fallback")).resolves.toBe(
      "No autorizado",
    );
  });

  it("joins multiple messages from a blob request's error body", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(
      jsonResponse(400, { message: ["a", "b"] }),
    );

    let caught: unknown;
    try {
      await api.get<Blob>("/orders/admin/export", { responseType: "blob" });
    } catch (err) {
      caught = err;
    }

    await expect(extractBlobApiError(caught, "fallback")).resolves.toBe("a, b");
  });

  it("falls back when the error body is not JSON", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    fetchMock.mockResolvedValue(
      new Response("<html>boom</html>", {
        status: 500,
        headers: { "Content-Type": "text/html" },
      }),
    );

    let caught: unknown;
    try {
      await api.get<Blob>("/orders/admin/export", { responseType: "blob" });
    } catch (err) {
      caught = err;
    }

    await expect(extractBlobApiError(caught, "fallback")).resolves.toBe(
      "fallback",
    );
  });

  it("delegates to extractApiError for non-blob errors too", async () => {
    await expect(
      extractBlobApiError(new ApiError(400, { message: "Bad input" }), "fallback"),
    ).resolves.toBe("Bad input");
  });

  it("returns Error message for a plain error, same as extractApiError", async () => {
    await expect(
      extractBlobApiError(new Error("boom"), "fallback"),
    ).resolves.toBe("boom");
  });
});
