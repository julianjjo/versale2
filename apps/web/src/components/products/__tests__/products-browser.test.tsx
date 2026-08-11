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

const mockFacets = { brands: ["Levi's", "Zara"], categories: ["Jackets", "Sweaters"] };

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from "@/lib/api";

// Most tests only care about the /products response; give the /products/facets
// call a harmless default so brand/category <select> options don't blow up.
function mockProductsApi(productsResponse: unknown) {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url === "/products/facets") {
      return { data: mockFacets };
    }
    return productsResponse as { data: unknown };
  });
}

describe("ProductsBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el formulario de filtros", async () => {
    mockProductsApi({ data: emptyProducts });
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
    mockProductsApi({ data: mockProducts });
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
    mockProductsApi({ data: emptyProducts });
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
    mockProductsApi({ data: mockProducts });
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
    mockProductsApi({ data: emptyProducts });
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
    mockProductsApi({ data: mockProducts });
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
    mockProductsApi({
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

  it("carga las marcas y categorías disponibles como opciones de filtro", async () => {
    mockProductsApi({ data: emptyProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    const brandSelect = screen.getByLabelText(/filtrar por marca/i);
    const categorySelect = screen.getByLabelText(/filtrar por categoría/i);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Levi's" })).toBeInTheDocument();
    });
    expect(screen.getByRole("option", { name: "Zara" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Jackets" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sweaters" })).toBeInTheDocument();
    expect(brandSelect).toHaveValue("");
    expect(categorySelect).toHaveValue("");
  });

  it("envía la marca y la categoría seleccionadas al hacer click en Aplicar", async () => {
    mockProductsApi({ data: emptyProducts });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Zara" })).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText(/filtrar por marca/i), "Zara");
    await user.selectOptions(
      screen.getByLabelText(/filtrar por categoría/i),
      "Jackets",
    );
    await user.click(screen.getByRole("button", { name: /aplicar/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.objectContaining({
            brand: "Zara",
            category: "Jackets",
            page: 1,
          }),
        }),
      );
    });
  });

  it("restablece los campos visibles del formulario al limpiar los filtros", async () => {
    mockProductsApi({ data: mockProducts });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Zara" })).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/buscar/i);
    await user.type(searchInput, "chaqueta");
    await user.selectOptions(screen.getByLabelText(/filtrar por marca/i), "Zara");
    await user.click(screen.getByRole("button", { name: /aplicar/i }));

    expect(searchInput).toHaveValue("chaqueta");
    expect(screen.getByLabelText(/filtrar por marca/i)).toHaveValue("Zara");

    await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));

    // Regression: the form used to be uncontrolled (defaultValue), so
    // clearing the applied filters left stale text visible in the inputs.
    expect(searchInput).toHaveValue("");
    expect(screen.getByLabelText(/filtrar por marca/i)).toHaveValue("");

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        "/products",
        expect.objectContaining({
          params: { page: 1, limit: 12 },
        }),
      );
    });
  });
});
