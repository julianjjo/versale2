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

import ProductPage from "../page";
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

  it("omite la verificación anónima en modo vista previa", async () => {
    const element = await renderPage("pendiente", { preview: "1" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(element.type).toBe(ProductDetail);
  });
});
