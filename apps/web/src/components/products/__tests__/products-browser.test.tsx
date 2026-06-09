import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductsBrowser } from "../products-browser";
import { TestProviders } from "@/test-utils/TestProviders";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockProducts = {
  data: [
    {
      id: "p1",
      title: "Vintage denim jacket",
      description: "Classic Levi's trucker jacket in great condition",
      category: "Jackets",
      brand: "Levi's",
      size: "M",
      condition: "Good",
      price: 45.0,
      sellerId: "s1",
      isApproved: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: ["https://example.com/jacket.jpg"],
      seller: { id: "s1", name: "Alice" },
      _count: { reviews: 3 },
    },
    {
      id: "p2",
      title: "Wool sweater",
      description: "Cozy knit sweater",
      category: "Sweaters",
      brand: null,
      size: "L",
      condition: "Like New",
      price: 30.0,
      sellerId: "s2",
      isApproved: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: null,
      seller: { id: "s2", name: "Bob" },
    },
  ],
  meta: { total: 2, page: 1, limit: 12, pages: 1 },
};

const emptyProducts = {
  data: [],
  meta: { total: 0, page: 1, limit: 12, pages: 0 },
};

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from "@/lib/api";

describe("ProductsBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el formulario de filtros", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: emptyProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/precio mín/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/precio máx/i)).toBeInTheDocument();
  });

  it("renderiza la lista de productos cuando hay datos", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(screen.getByText("Wool sweater")).toBeInTheDocument();
    // Price 45 formatted in COP
    expect(screen.getByText("$ 45")).toBeInTheDocument();
    expect(screen.getByText(/vendido por alice/i)).toBeInTheDocument();
  });

  it("renderiza un estado vacío cuando no hay productos", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: emptyProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no encontramos productos/i)).toBeInTheDocument();
    });
  });

  it("muestra un error cuando falla la carga de productos", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Error de red"));
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no pudimos cargar/i)).toBeInTheDocument();
    });
  });

  it("enlaza cada producto a su página de detalle", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    const link = screen.getByRole("link", { name: /vintage denim jacket/i });
    expect(link).toHaveAttribute("href", "/products/p1");
  });

  it("envía los valores del filtro al hacer click en Aplicar", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: emptyProducts });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await user.type(screen.getByPlaceholderText(/buscar/i), "chaqueta");
    await user.click(screen.getByRole("button", { name: /aplicar/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.objectContaining({ search: "chaqueta", page: 1 }),
        }),
      );
    });
  });

  it("renderiza un placeholder cuando el producto no tiene imagen", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Wool sweater")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Sin imagen").length).toBeGreaterThan(0);
  });

  it("renderiza los controles de paginación cuando hay varias páginas", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [],
        meta: { total: 30, page: 1, limit: 12, pages: 3 },
      },
    });
    render(
      <TestProviders>
        <ProductsBrowser />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /página 1/i }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /página 2/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /página 3/i }),
    ).toBeInTheDocument();
  });
});
