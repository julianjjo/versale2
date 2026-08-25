import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
};

const authState: { user: AuthUser | null; isLoading: boolean } = {
  user: null,
  isLoading: false,
};

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => authState,
  };
});

// Minimal App Router stand-in: `push` swaps the URL and notifies the
// subscribers of `useSearchParams`, so the component reacts to navigation the
// same way it does in the browser (shared link, Back/Forward, filter apply).
const nav = vi.hoisted(() => {
  const state = {
    url: "/products",
    listeners: new Set<() => void>(),
    navigate(url: string) {
      state.url = url;
      state.listeners.forEach((listener) => listener());
    },
    reset(url = "/products") {
      state.url = url;
    },
  };
  return state;
});

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");
  const subscribe = (onChange: () => void) => {
    nav.listeners.add(onChange);
    return () => {
      nav.listeners.delete(onChange);
    };
  };
  const getUrl = () => nav.url;
  return {
    useRouter: () => ({
      push: (url: string) => nav.navigate(url),
      replace: (url: string) => nav.navigate(url),
      refresh: vi.fn(),
    }),
    usePathname: () => useSyncExternalStore(subscribe, getUrl, getUrl).split("?")[0],
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(subscribe, getUrl, getUrl).split("?")[1] ?? "",
      ),
  };
});

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
      images: [{ url: "https://example.com/jacket.jpg", alt: "Chaqueta de jean" }],
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
  extractApiError: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

import { api } from "@/lib/api";

// Most tests only care about the /products response; give the /products/facets
// and /favorites/ids calls a harmless default so brand/category <select>
// options and each card's heart icon don't blow up.
function mockProductsApi(productsResponse: unknown) {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url === "/products/facets") {
      return { data: mockFacets };
    }
    if (url === "/favorites/ids") {
      return { data: { productIds: [] } };
    }
    return productsResponse as { data: unknown };
  });
}

describe("ProductsBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.reset();
    authState.user = null;
    authState.isLoading = false;
  });

  it("renderiza el formulario de filtros", async () => {
    mockProductsApi({ data: emptyProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );
    expect(screen.getByLabelText(/^buscar$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^precio mínimo$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^precio máximo$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^talla$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^condición$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^marca$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^categoría$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^ordenar por$/i)).toBeInTheDocument();
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
    // Item 14: fecha de publicación visible en la card.
    expect(screen.getAllByText(/publicado el/i).length).toBeGreaterThan(0);
  });

  // Item 14 (bug estructural del roadmap): el botón de favorito era un
  // descendiente del <Link> de la card — HTML inválido que los lectores de
  // pantalla anuncian mal y fuente de errores de hidratación. Ahora es
  // hermano posicionado.
  it("renderiza el botón de favorito fuera del enlace de la card", async () => {
    mockProductsApi({
      data: {
        data: [mockProducts.data[0]],
        meta: mockProducts.meta,
      },
    });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await screen.findByText("Vintage denim jacket");
    const favorite = screen.getByRole("button", {
      name: /agregar a favoritos/i,
    });

    // Ningún <Link> de card contiene un botón: el favorito es hermano.
    const cardLinks = screen
      .getAllByRole("link")
      .filter((l) => l.querySelector("h3"));
    expect(cardLinks.length).toBeGreaterThan(0);
    for (const link of cardLinks) {
      expect(link.querySelector("button")).toBeNull();
    }
    // Y el favorito queda posicionado sobre la imagen de una de ellas.
    expect(favorite.closest("a")).toBeNull();
  });

  it("renderiza las cards sin errores ni warnings de React en consola", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockProductsApi({
      data: {
        data: [mockProducts.data[0]],
        meta: mockProducts.meta,
      },
    });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/vendido por alice/i)).toBeInTheDocument();
    });

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("muestra la calificación promedio y el número de reseñas cuando el producto tiene alguna", async () => {
    mockProductsApi({
      data: {
        data: [{ ...mockProducts.data[0], averageRating: 4.5 }],
        meta: mockProducts.meta,
      },
    });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(screen.getByText("4.5 (3)")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /4\.5 de 5 estrellas/i }),
    ).toBeInTheDocument();
  });

  it("no muestra ninguna calificación cuando el producto todavía no tiene reseñas", async () => {
    mockProductsApi({ data: mockProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    // Neither product fixture sets averageRating (undefined, same as the
    // backend's `null` for "no reviews yet") — no star rating should render.
    expect(screen.queryByRole("img", { name: /estrellas/i })).not.toBeInTheDocument();
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

  it("muestra el mensaje genérico cuando falla la carga sin un mensaje específico", async () => {
    // Sin `instanceof Error` ni forma de ApiError: extractApiError no tiene de
    // dónde sacar un mensaje propio, así que cae al fallback genérico.
    vi.mocked(api.get).mockRejectedValue("boom");
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no pudimos cargar/i)).toBeInTheDocument();
    });
  });

  // Regression: un 429 del throttle propio de GET /products (o cualquier otro
  // fallo con mensaje del backend) se mostraba como el mismo "No pudimos
  // cargar los productos. Intenta de nuevo." genérico — una copia que además
  // invita al reintento inmediato que volvería a chocar contra el límite.
  it("muestra el mensaje específico del error en vez del genérico", async () => {
    vi.mocked(api.get).mockRejectedValue(
      new Error("Demasiadas solicitudes. Espera un momento e inténtalo de nuevo."),
    );
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("Demasiadas solicitudes. Espera un momento e inténtalo de nuevo."),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText(/no pudimos cargar/i)).not.toBeInTheDocument();
  });

  // The favorites feature now has a real API behind it (see
  // apps/api/src/favorites), so every card gets a working heart button
  // instead of the dead one that was previously removed from here and from
  // the site header.
  it("redirige a iniciar sesión al hacer click en favoritos sin sesión", async () => {
    mockProductsApi({ data: mockProducts });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });

    const favoriteButtons = screen.getAllByRole("button", {
      name: /agregar a favoritos/i,
    });
    expect(favoriteButtons.length).toBeGreaterThan(0);
    await user.click(favoriteButtons[0]);

    expect(nav.url).toBe("/login?next=%2Fproducts%2Fp1&reason=favorite");
  });

  // Regression: the API and the product detail page both refuse to let a
  // seller favorite their own listing; the catalog grid used to have no
  // equivalent check at all.
  it("oculta el botón de favoritos en la tarjeta del propio vendedor", async () => {
    authState.user = { id: "s1", email: "a@b.c", name: "Alice", role: "USER" };
    mockProductsApi({ data: mockProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });

    // p1 (sellerId "s1") is the logged-in seller's own listing; p2
    // (sellerId "s2") belongs to someone else and keeps its heart button.
    expect(
      screen.getAllByRole("button", { name: /agregar a favoritos|quitar de favoritos/i }),
    ).toHaveLength(1);
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

    await user.type(screen.getByLabelText(/^buscar$/i), "chaqueta");
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

    // Regression: a numbered button per page overflowed every viewport once
    // the catalog grew past a handful of pages. The bounded Pager control
    // (Prev / "Página X de Y" / Next) can never overflow regardless of
    // `data.meta.pages`.
    await waitFor(() => {
      expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /anterior/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /siguiente/i }),
    ).toBeEnabled();
  });

  it("carga las marcas como facets y la lista cerrada de categorías", async () => {
    mockProductsApi({ data: emptyProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    const brandSelect = screen.getByLabelText(/^marca$/i);
    const categorySelect = screen.getByLabelText(/^categoría$/i);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Levi's" })).toBeInTheDocument();
    });
    expect(screen.getByRole("option", { name: "Zara" })).toBeInTheDocument();
    // Item 5: las categorías ya no son facets dinámicos sino la lista
    // cerrada compartida con el DTO — misma lista que /sell publica.
    expect(screen.getByRole("option", { name: "Chaquetas" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Otros" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Jackets" })).not.toBeInTheDocument();
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

    await user.selectOptions(screen.getByLabelText(/^marca$/i), "Zara");
    await user.selectOptions(
      screen.getByLabelText(/^categoría$/i),
      "Chaquetas",
    );
    await user.click(screen.getByRole("button", { name: /aplicar/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.objectContaining({
            brand: "Zara",
            category: "Chaquetas",
            page: 1,
          }),
        }),
      );
    });
  });

  it("envía el orden seleccionado al hacer click en Aplicar", async () => {
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

    await user.selectOptions(
      screen.getByLabelText(/^ordenar por$/i),
      "price_asc",
    );
    await user.click(screen.getByRole("button", { name: /aplicar/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.objectContaining({ sortBy: "price_asc" }),
        }),
      );
    });
  });

  it("restablece el orden al limpiar los filtros", async () => {
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

    await user.selectOptions(
      screen.getByLabelText(/^ordenar por$/i),
      "price_desc",
    );
    await user.click(screen.getByRole("button", { name: /aplicar/i }));
    expect(screen.getByLabelText(/^ordenar por$/i)).toHaveValue("price_desc");

    await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));

    expect(screen.getByLabelText(/^ordenar por$/i)).toHaveValue("");
    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.not.objectContaining({ sortBy: expect.anything() }),
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

    const searchInput = screen.getByLabelText(/^buscar$/i);
    await user.type(searchInput, "chaqueta");
    await user.selectOptions(screen.getByLabelText(/^marca$/i), "Zara");
    await user.click(screen.getByRole("button", { name: /aplicar/i }));

    expect(searchInput).toHaveValue("chaqueta");
    expect(screen.getByLabelText(/^marca$/i)).toHaveValue("Zara");

    await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));

    // Regression: the form used to be uncontrolled (defaultValue), so
    // clearing the applied filters left stale text visible in the inputs.
    expect(searchInput).toHaveValue("");
    expect(screen.getByLabelText(/^marca$/i)).toHaveValue("");

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        "/products",
        expect.objectContaining({
          params: { page: 1, limit: 12 },
        }),
      );
    });
  });

  // Regression: filters lived in useState only, so a shared link showed the
  // recipient the whole catalog and the URL never reflected what was applied.
  it("inicializa los filtros desde la query string", async () => {
    mockProductsApi({ data: emptyProducts });
    nav.reset("/products?size=M&condition=Good&search=jacket&page=2");
    render(
      <TestProviders>
        <ProductsBrowser />
      </TestProviders>,
    );

    expect(screen.getByLabelText(/^buscar$/i)).toHaveValue("jacket");
    expect(screen.getByLabelText(/^talla$/i)).toHaveValue("M");
    expect(screen.getByLabelText(/^condición$/i)).toHaveValue("Good");

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.objectContaining({
            search: "jacket",
            size: "M",
            condition: "Good",
            page: 2,
          }),
        }),
      );
    });
  });

  it("escribe los filtros aplicados en la URL", async () => {
    mockProductsApi({ data: emptyProducts });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await user.type(screen.getByLabelText(/^buscar$/i), "chaqueta");
    await user.selectOptions(screen.getByLabelText(/^talla$/i), "L");
    await user.click(screen.getByRole("button", { name: /aplicar/i }));

    expect(nav.url).toBe("/products?search=chaqueta&size=L");
  });

  it("limpia la query string al limpiar los filtros", async () => {
    mockProductsApi({ data: emptyProducts });
    nav.reset("/products?search=chaqueta");
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: /limpiar filtros/i }));

    expect(nav.url).toBe("/products");
  });

  it("guarda la página en la URL y responde a la navegación del historial", async () => {
    mockProductsApi({
      data: {
        data: [],
        meta: { total: 30, page: 1, limit: 12, pages: 3 },
      },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductsBrowser />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(nav.url).toBe("/products?page=2");

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.objectContaining({ page: 2 }),
        }),
      );
    });

    // Back: the browser restores the previous URL and the view follows it
    // instead of silently resetting to an unfiltered page 1.
    act(() => {
      nav.navigate("/products");
    });
    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.objectContaining({ page: 1 }),
        }),
      );
    });
  });

  it("no reescribe la URL cuando se usa embebido sin filtros ni paginación", async () => {
    mockProductsApi({ data: mockProducts });
    render(
      <TestProviders>
        <ProductsBrowser limit={6} showFilters={false} showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(nav.url).toBe("/products");
  });
});
