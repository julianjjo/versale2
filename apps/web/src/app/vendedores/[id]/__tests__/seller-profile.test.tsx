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

vi.mock("@/components/products/seller-profile-content", () => ({
  SellerProfileContent: () => null,
}));

import SellerProfilePage, { generateMetadata } from "../page";
import { SellerProfileContent } from "@/components/products/seller-profile-content";

const mockProfile = {
  id: "seller1",
  name: "Bob",
  memberSince: "2025-01-15T00:00:00.000Z",
  activeListings: 2,
};

function jsonResponse(status: number, body?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function renderPage(id: string) {
  return SellerProfilePage({
    params: Promise.resolve({ id }),
  }) as Promise<ReactElement>;
}

const fetchMock = vi.fn();

describe("SellerProfilePage", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Regression: a deleted/nonexistent seller used to render the "vendedor no
  // encontrado" panel over a 200 OK, so the URL stayed indexable.
  it("lanza notFound cuando la API responde 404", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(404, { message: "no encontrado" }),
    );
    await expect(renderPage("desaparecido")).rejects.toBe(notFoundSignal);
  });

  it("pasa al contenido el perfil resuelto en el servidor", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, mockProfile));
    const element = await renderPage("seller1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products/sellers/seller1"),
      expect.objectContaining({ cache: "no-store" }),
    );
    expect(element.type).toBe(SellerProfileContent);
    expect(element.props).toEqual({ initialProfile: mockProfile });
  });

  it("no responde 404 cuando la API está caída", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    const element = await renderPage("seller1");

    expect(element.type).toBe(SellerProfileContent);
    expect(element.props).toEqual({ initialProfile: undefined });
  });

  it("agrega un timeout a la verificación anónima", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, mockProfile));
    await renderPage("seller1");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products/sellers/seller1"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("recorta un sellerId con espacios antes de consultar", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, mockProfile));
    await renderPage("  seller1  ");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/products/sellers/seller1"),
      expect.any(Object),
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining("%20%20seller1"),
    );
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

  it("usa el nombre del vendedor en el título y la descripción", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, mockProfile));

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "seller1" }),
    });

    expect(metadata.title).toBe("Bob — Versale");
    expect(metadata.description).toContain("Bob");
    expect(metadata.description).toContain("2 publicaciones activas");
    expect(metadata.openGraph?.title).toBe("Bob — Versale");
  });

  it("cae a un título genérico cuando el vendedor no existe o la API falla", async () => {
    fetchMock.mockResolvedValue(jsonResponse(404));

    const metadata = await generateMetadata({
      params: Promise.resolve({ id: "desaparecido" }),
    });

    expect(metadata.title).toBe("Vendedor — Versale");
  });
});
