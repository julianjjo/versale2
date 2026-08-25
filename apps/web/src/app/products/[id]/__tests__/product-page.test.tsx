import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactElement } from "react";

// The real `notFound()` throws a sentinel that Next catches to render the 404
// route with a 404 status; reproduce that contract here.
const notFoundSignal = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw notFoundSignal;
  },
}));

vi.mock("@/components/products/product-detail", () => ({
  ProductDetail: () => null,
}));

import ProductPage, { generateMetadata } from "../page";
import { ProductDetail } from "@/components/products/product-detail";

const mockProduct = {
  id: "p1",
  title: "Vintage denim jacket",
  description: "Classic Levi's trucker jacket in great condition",
  category: "Jackets",
  brand: "Levi's",
  size: "M",
  condition: "Good",
  price: 45000,
  sellerId: "s1",
  isApproved: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function jsonResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function renderPage(id: string, search: { preview?: string } = {}) {
  return ProductPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve(search),
  }) as Promise<ReactElement>;
}

const fetchMock = vi.fn();

describe("ProductPage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Regression: a missing product rendered the Spanish "Producto no encontrado"
  // panel over a 200 OK, so deleted and rejected listings stayed indexable.
  it("lanza notFound cuando la API responde 404", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404, { message: "no encontrado" }));
    await expect(renderPage("desaparecido")).rejects.toBe(notFoundSignal);
  });

  it("pasa al detalle el producto resuelto en el servidor", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, mockProduct));
    const element = await renderPage("p1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products/p1"),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(element.type).toBe(ProductDetail);
    expect(element.props).toEqual({ initialProduct: mockProduct });
  });

  it("no responde 404 cuando la API está caída", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const element = await renderPage("p1");

    expect(element.type).toBe(ProductDetail);
    expect(element.props).toEqual({ initialProduct: undefined });
  });

  // Regression: the anonymous server probe had no timeout at all, so a hung
  // API stalled the entire page response instead of degrading to the
  // retryable client-side error state.
  it("agrega un timeout a la verificación anónima", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, mockProduct));
    await renderPage("p1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products/p1"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  // The assertion above only proves *some* AbortSignal is passed — it would
  // still pass if the timeout were accidentally changed to 5ms or 5000s.
  // Spying on the real AbortSignal.timeout pins down the literal duration
  // without needing fake timers to fire Node's native timeout internals,
  // which vitest's fake-timer implementation does not intercept.
  it("usa un timeout de 5 segundos exactos, no cualquier señal de cancelación", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(jsonResponse(200, mockProduct));
    await renderPage("p1");

    expect(timeoutSpy).toHaveBeenCalledWith(5000);
    timeoutSpy.mockRestore();
  });

  it("no responde 404 cuando la verificación anónima se agota por timeout", async () => {
    fetchMock.mockRejectedValue(
      new DOMException("The operation timed out.", "TimeoutError"),
    );
    const element = await renderPage("p1");

    expect(element.type).toBe(ProductDetail);
    expect(element.props).toEqual({ initialProduct: undefined });
  });

  it("omite la verificación anónima en modo vista previa", async () => {
    const element = await renderPage("pendiente", { preview: "1" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(element.type).toBe(ProductDetail);
  });
});

describe("generateMetadata", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("nunca deja un surrogate huérfano en la descripción del og:image/meta", async () => {
    const description = "a".repeat(156) + "🎉" + "b".repeat(50);
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ...mockProduct, description }),
    );

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "p1" }),
    });

    // ponytail: slice tolerante — longitud y sufijo, no igualdad de grafema
    expect(metadata.description?.endsWith("...")).toBe(true);
    expect(metadata.description?.length).toBeLessThanOrEqual(160);
    expect(metadata.openGraph?.description).toBe(metadata.description);
  });
});
