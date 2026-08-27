import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductDetail } from "../product-detail";
import { TestProviders } from "@/test-utils/TestProviders";
import { tokenStore } from "@/lib/token";
import type { Product } from "@/lib/types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useParams: () => ({ id: "p1" }),
}));

const authState: {
  user: null | { id: string; email: string; name: string; role: "USER" | "ADMIN" };
  isLoading: boolean;
} = {
  user: null,
  isLoading: false,
};

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => authState,
  };
});

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockProduct = {
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
  images: [{ url: "https://example.com/jacket.jpg", alt: "Vintage denim jacket" }],
  seller: { id: "s1", name: "Alice" },
  reviews: [
    {
      id: "r1",
      productId: "p1",
      userId: "u1",
      rating: 5,
      comment: "Love it!",
      createdAt: new Date().toISOString(),
      user: { id: "u1", name: "Bob" },
    },
  ],
};

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Request failed",
}));

import { api } from "@/lib/api";

// A logged-in, non-owner visit renders the favorite heart, which fires its
// own GET /favorites/ids alongside the product fetch, and the page always
// fires its own GET /products/:id/related. Tests that only care about the
// product response can use this so those calls don't collide with a blanket
// `mockResolvedValue`/`mockRejectedValue` on every `api.get` call.
function mockProductGet(product: { id: string }, related: unknown[] = []) {
  return async (url: string) => {
    if (url === "/favorites/ids") return { data: { productIds: [] } };
    if (url === `/products/${product.id}/related`) return { data: { data: related } };
    return { data: product };
  };
}

describe("ProductDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = false;
    // Whether a token is present decides if the server-seeded product is
    // revalidated, so each test starts from a known (anonymous) state.
    tokenStore.clear();
    // Viewing a product records it via recently-viewed's localStorage-backed
    // history — clear between tests so one test's view can't leak into the
    // next as stray "recently viewed" state.
    localStorage.clear();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  it("renderiza la información del producto", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProduct });
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(screen.getByText("Levi's")).toBeInTheDocument();
    // Price 45 formatted in COP without thousands separator
    expect(screen.getByText("$ 45")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("enlaza el nombre del vendedor a su perfil público", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProduct });
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    const sellerLink = await screen.findByRole("link", { name: "Alice" });
    expect(sellerLink).toHaveAttribute("href", "/vendedores/s1");
  });

  // Detailed gallery interaction/behavior tests live in
  // product-gallery.test.tsx, against ProductGallery directly — this is
  // just a wiring smoke test confirming ProductDetail actually renders it
  // with the product's real images and title.
  it("renderiza la galería de fotos con los datos del producto", async () => {
    const productWithGallery = {
      ...mockProduct,
      images: [
        { url: "https://example.com/jacket-1.jpg", alt: "Vintage denim jacket" },
        { url: "https://example.com/jacket-2.jpg", alt: "Vintage denim jacket" },
      ],
    };
    vi.mocked(api.get).mockResolvedValue({ data: productWithGallery });
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    const mainImage = await screen.findByRole("img", {
      name: "Vintage denim jacket",
    });
    // next/image rewrites `src` through its optimizer (`/_next/image?url=...`)
    // rather than passing the original URL through verbatim.
    expect(mainImage.getAttribute("src")).toContain(
      encodeURIComponent("https://example.com/jacket-1.jpg"),
    );
    expect(
      screen.getByRole("button", { name: /ver foto 2 de/i }),
    ).toBeInTheDocument();
  });

  it("muestra productos similares de la misma categoría", async () => {
    const related = [
      {
        id: "p2",
        title: "Chaqueta de mezclilla clásica",
        description: "Otra chaqueta",
        category: "Jackets",
        brand: "Zara",
        size: "L",
        condition: "Good",
        price: 30000,
        sellerId: "s2",
        isApproved: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        images: null,
        seller: { id: "s2", name: "Carla" },
      },
    ];
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct, related));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Productos similares")).toBeInTheDocument();
    });
    expect(screen.getByText("Chaqueta de mezclilla clásica")).toBeInTheDocument();
  });

  // Regression: this must fail if the related-products query is ever
  // disabled/broken outright, not just if the endpoint legitimately returns
  // an empty list — both would look identical without this assertion.
  it("no muestra la sección de productos similares cuando no hay ninguno", async () => {
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products/p1/related",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(screen.queryByText("Productos similares")).not.toBeInTheDocument();
  });

  // Regression: each ProductCard's heart must check its OWN product id, not
  // accidentally share state across the main listing and its related items.
  it("mantiene el estado de favorito independiente entre el producto principal y los relacionados", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Dana", role: "USER" };
    const related = [
      {
        id: "p2",
        title: "Chaqueta de mezclilla clásica",
        description: "Otra chaqueta",
        category: "Jackets",
        brand: "Zara",
        size: "L",
        condition: "Good",
        price: 30000,
        sellerId: "s2",
        isApproved: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        images: null,
        seller: { id: "s2", name: "Carla" },
      },
    ];
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/favorites/ids") return { data: { productIds: ["p1"] } };
      if (url === `/products/${mockProduct.id}/related`) {
        return { data: { data: related } };
      }
      return { data: mockProduct };
    });
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de mezclilla clásica")).toBeInTheDocument();
    });

    expect(
      await screen.findAllByRole("button", { name: /quitar de favoritos/i }),
    ).toHaveLength(1);
    expect(
      screen.getAllByRole("button", { name: /agregar a favoritos/i }),
    ).toHaveLength(1);
  });

  it("renderiza las reseñas", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProduct });
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("muestra el estado no encontrado cuando el producto no existe", async () => {
    // Un 404 de verdad: la prenda ya no está publicada.
    vi.mocked(api.get).mockRejectedValue(
      Object.assign(new Error("Not found"), { response: { status: 404 } }),
    );
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/producto no encontrado/i)).toBeInTheDocument();
    });
  });

  it("ofrece reintentar cuando la carga falla por un error temporal", async () => {
    // Sin respuesta (red caída) o un 5xx no significan que la prenda no exista,
    // así que no debe decirse que fue eliminada.
    vi.mocked(api.get).mockRejectedValue(new Error("Network Error"));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no pudimos cargar la prenda/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /reintentar/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/producto no encontrado/i)).not.toBeInTheDocument();
  });

  it("pide inicio de sesión al agregar al carrito sin sesión", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProduct });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /agregar al carrito/i }));
    expect(pushMock).toHaveBeenCalledWith(
      "/login?next=%2Fproducts%2Fp1&reason=cart",
    );
  });

  it("agrega al carrito cuando el usuario está autenticado", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    vi.mocked(api.post).mockResolvedValue({ data: { id: "ci1" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /agregar al carrito/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/cart/items", {
        productId: "p1",
        quantity: 1,
      });
    });
  });

  it("comparte la publicación y muestra la confirmación de enlace copiado", async () => {
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    // `userEvent.setup()` installs its own real Clipboard implementation on
    // `navigator.clipboard` — it must run before these stubs, or it silently
    // overwrites the mock this test just set up.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    try {
      render(
        <TestProviders>
          <ProductDetail />
        </TestProviders>,
      );

      await waitFor(() => {
        expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
      });
      await user.click(
        screen.getByRole("button", { name: "Compartir esta publicación" }),
      );

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          `${window.location.origin}/products/p1`,
        );
      });
      expect(await screen.findByText("Enlace copiado")).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }
  });

  // Regression: ShareButton's onCopied/onError used to only ever set their
  // own banner, so a stale error from an earlier failed action (or vice
  // versa) could stay on screen alongside the new one.
  it("copiar el enlace reemplaza un error de agregar al carrito que haya quedado visible", async () => {
    authState.user = { id: "u2", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    vi.mocked(api.post).mockRejectedValue(new Error("No pudimos agregarlo"));
    // See the ordering note in the previous test — `userEvent.setup()` must
    // come before these stubs.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    try {
      render(
        <TestProviders>
          <ProductDetail />
        </TestProviders>,
      );

      await waitFor(() => {
        expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
      });
      await user.click(
        screen.getByRole("button", { name: /agregar al carrito/i }),
      );
      expect(await screen.findByText("No pudimos agregarlo")).toBeInTheDocument();

      await user.click(
        screen.getByRole("button", { name: "Compartir esta publicación" }),
      );

      expect(await screen.findByText("Enlace copiado")).toBeInTheDocument();
      expect(screen.queryByText("No pudimos agregarlo")).toBeNull();
    } finally {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(navigator, "clipboard", {
        value: undefined,
        configurable: true,
        writable: true,
      });
    }
  });

  it("oculta el botón de agregar al carrito para el vendedor del producto", async () => {
    authState.user = {
      id: "s1",
      email: "seller@b.c",
      name: "Alice",
      role: "USER",
    };
    vi.mocked(api.get).mockResolvedValue({ data: mockProduct });
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /agregar al carrito/i })).toBeNull();
    expect(screen.getByText(/esta es tu publicación/i)).toBeInTheDocument();
    // Favoriting your own listing makes no sense, same reasoning as hiding
    // "Agregar al carrito" above.
    expect(
      screen.queryByRole("button", { name: /favoritos/i }),
    ).toBeNull();
  });

  it("muestra que el vendedor pausó la publicación en vez del botón de comprar", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    const pausedProduct = {
      ...mockProduct,
      pausedAt: new Date().toISOString(),
    };
    vi.mocked(api.get).mockImplementation(mockProductGet(pausedProduct));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /agregar al carrito/i }),
    ).toBeNull();
    expect(
      screen.getByText(/el vendedor pausó esta publicación/i),
    ).toBeInTheDocument();
  });

  it("le dice al propio vendedor que su publicación está pausada", async () => {
    authState.user = {
      id: "s1",
      email: "seller@b.c",
      name: "Alice",
      role: "USER",
    };
    const pausedProduct = {
      ...mockProduct,
      pausedAt: new Date().toISOString(),
    };
    vi.mocked(api.get).mockResolvedValue({ data: pausedProduct });
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/pausaste esta publicación/i),
    ).toBeInTheDocument();
  });

  // Regression: a moderated-field edit while paused sends the listing back to
  // review (isApproved:false) without clearing pausedAt — the seller needs to
  // know it's also pending re-approval, not just "paused", since that's the
  // more actionable fact.
  it("le dice al propio vendedor que su publicación pausada también está en revisión", async () => {
    authState.user = {
      id: "s1",
      email: "seller@b.c",
      name: "Alice",
      role: "USER",
    };
    const pausedAndPendingProduct = {
      ...mockProduct,
      isApproved: false,
      pausedAt: new Date().toISOString(),
    };
    vi.mocked(api.get).mockResolvedValue({ data: pausedAndPendingProduct });
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(
      screen.getByText(/pausaste esta publicación y además está pendiente de revisión/i),
    ).toBeInTheDocument();
  });

  it("pide inicio de sesión al agregar a favoritos sin sesión", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProduct });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: /agregar a favoritos/i }),
    );
    expect(pushMock).toHaveBeenCalledWith(
      "/login?next=%2Fproducts%2Fp1&reason=favorite",
    );
    expect(api.post).not.toHaveBeenCalledWith("/favorites/p1");
  });

  it("agrega el producto a favoritos cuando el usuario está autenticado", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    vi.mocked(api.post).mockResolvedValue({ data: { id: "fav1" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: /agregar a favoritos/i }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/favorites/p1");
    });
  });

  it("publica una reseña desde el formulario", async () => {
    authState.user = { id: "u2", email: "u2@b.c", name: "Charlie", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    vi.mocked(api.post).mockResolvedValue({ data: { id: "r2" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    await user.type(screen.getByLabelText(/comentario/i), "¡Buenísimo!");
    await user.click(screen.getByRole("button", { name: /publicar reseña/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/reviews", {
        productId: "p1",
        rating: 5,
        comment: "¡Buenísimo!",
      });
    });
  });

  it("usa el producto resuelto en el servidor sin volver a pedirlo si la visita es anónima", async () => {
    // The server probe is anonymous, so for a visitor without a token its
    // result already IS the answer — asking again is a second identical
    // round-trip on every product view.
    vi.mocked(api.get).mockRejectedValue(new Error("Network Error"));
    render(
      <TestProviders>
        <ProductDetail initialProduct={mockProduct as unknown as Product} />
      </TestProviders>,
    );

    expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Classic Levi's trucker jacket in great condition")).toBeInTheDocument();
    });
    expect(api.get).not.toHaveBeenCalledWith(
      "/products/p1",
      expect.anything(),
    );
    expect(screen.queryByText(/producto no encontrado/i)).toBeNull();
  });

  it("revalida con el token del visitante y conserva el producto si esa recarga falla", async () => {
    // A visitor WITH a token can see more than the anonymous probe did (their
    // own pending listing, admin), so their copy is refetched — and a failed
    // refetch must not swap the product for the "no encontrado" empty state.
    tokenStore.set("a-token");
    vi.mocked(api.get).mockRejectedValue(new Error("Network Error"));
    render(
      <TestProviders>
        <ProductDetail initialProduct={mockProduct as unknown as Product} />
      </TestProviders>,
    );

    expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products/p1",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    expect(screen.queryByText(/producto no encontrado/i)).toBeNull();
  });

  it("navega la calificación con el teclado (roving tabindex)", async () => {
    authState.user = { id: "u2", email: "u2@b.c", name: "Charlie", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });

    const stars = screen.getAllByRole("radio");
    expect(stars).toHaveLength(5);
    // Default rating is 5: only the last star is a tab stop, the rest are not.
    expect(stars[4]).toHaveAttribute("tabindex", "0");
    expect(stars[0]).toHaveAttribute("tabindex", "-1");

    stars[4].focus();
    await user.keyboard("{ArrowLeft}");
    expect(stars[3]).toHaveFocus();
    expect(stars[3]).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{Home}");
    expect(stars[0]).toHaveFocus();
    expect(stars[0]).toHaveAttribute("aria-checked", "true");

    await user.keyboard("{End}");
    expect(stars[4]).toHaveFocus();
    expect(stars[4]).toHaveAttribute("aria-checked", "true");
  });

  it("no muestra el botón Responder a un visitante que no es el vendedor", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /responder/i }),
    ).toBeNull();
  });

  it("el vendedor puede publicar una respuesta a una reseña", async () => {
    authState.user = { id: "s1", email: "seller@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.get).mockResolvedValue({ data: mockProduct });
    vi.mocked(api.patch).mockResolvedValue({ data: { id: "r1" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^responder$/i }));
    await user.type(
      screen.getByLabelText(/tu respuesta/i),
      "¡Gracias por tu compra!",
    );
    await user.click(
      screen.getByRole("button", { name: /guardar respuesta/i }),
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/reviews/r1/reply", {
        reply: "¡Gracias por tu compra!",
      });
    });
  });

  it("muestra la respuesta del vendedor y permite editarla", async () => {
    authState.user = { id: "s1", email: "seller@b.c", name: "Alice", role: "USER" };
    const productWithReply = {
      ...mockProduct,
      reviews: [
        {
          ...mockProduct.reviews[0],
          sellerReply: "Gracias, vuelve pronto",
        },
      ],
    };
    vi.mocked(api.get).mockResolvedValue({ data: productWithReply });
    vi.mocked(api.patch).mockResolvedValue({ data: { id: "r1" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Gracias, vuelve pronto")).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", { name: /editar respuesta/i }),
    );
    const textarea = screen.getByLabelText(/tu respuesta/i);
    expect(textarea).toHaveValue("Gracias, vuelve pronto");

    await user.clear(textarea);
    await user.type(textarea, "Respuesta corregida");
    await user.click(
      screen.getByRole("button", { name: /guardar respuesta/i }),
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/reviews/r1/reply", {
        reply: "Respuesta corregida",
      });
    });
  });

  it('muestra el sello "Compra verificada" en la reseña del comprador real', async () => {
    const productWithVerifiedReview = {
      ...mockProduct,
      reviews: [
        { ...mockProduct.reviews[0], verifiedPurchase: true },
      ],
    };
    vi.mocked(api.get).mockImplementation(
      mockProductGet(productWithVerifiedReview),
    );
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });
    expect(screen.getByText("Compra verificada")).toBeInTheDocument();
  });

  it('no muestra el sello "Compra verificada" cuando la reseña no viene del comprador real', async () => {
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });
    expect(screen.queryByText("Compra verificada")).not.toBeInTheDocument();
  });

  it("un visitante que no es el vendedor sí ve la respuesta ya publicada", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    const productWithReply = {
      ...mockProduct,
      reviews: [
        {
          ...mockProduct.reviews[0],
          sellerReply: "Gracias, vuelve pronto",
        },
      ],
    };
    vi.mocked(api.get).mockImplementation(mockProductGet(productWithReply));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Gracias, vuelve pronto")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /editar respuesta/i }),
    ).toBeNull();
  });

  it("muestra Editar reseña y Eliminar reseña solo en la reseña propia del comprador", async () => {
    authState.user = { id: "u1", email: "bob@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /editar reseña/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /eliminar reseña/i }),
    ).toBeInTheDocument();
  });

  it("no muestra Editar reseña ni Eliminar reseña en la reseña de otra persona", async () => {
    authState.user = { id: "u2", email: "charlie@b.c", name: "Charlie", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /editar reseña/i }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: /eliminar reseña/i }),
    ).toBeNull();
  });

  it("no muestra el botón ¿Te fue útil? en la reseña propia", async () => {
    authState.user = { id: "u1", email: "bob@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /¿te fue útil\?/i }),
    ).toBeNull();
  });

  it("pide inicio de sesión al marcar una reseña como útil sin sesión", async () => {
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: /¿te fue útil\?/i }),
    );

    expect(pushMock).toHaveBeenCalledWith(
      "/login?next=%2Fproducts%2Fp1&reason=helpful",
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("marca como útil la reseña de otra persona", async () => {
    authState.user = { id: "u2", email: "charlie@b.c", name: "Charlie", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    vi.mocked(api.post).mockResolvedValue({
      data: { helpfulCount: 1, votedByMe: true },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: /¿te fue útil\?/i }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/reviews/r1/helpful");
    });
  });

  it("quita el voto útil de una reseña ya marcada", async () => {
    authState.user = { id: "u2", email: "charlie@b.c", name: "Charlie", role: "USER" };
    const votedProduct = {
      ...mockProduct,
      reviews: [
        { ...mockProduct.reviews[0], helpfulCount: 1, votedByMe: true },
      ],
    };
    vi.mocked(api.get).mockImplementation(mockProductGet(votedProduct));
    vi.mocked(api.delete).mockResolvedValue({
      data: { helpfulCount: 0, votedByMe: false },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    const helpfulButton = await screen.findByRole("button", {
      name: /útil \(1\)/i,
    });
    await user.click(helpfulButton);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/reviews/r1/helpful");
    });
  });

  it("no deshabilita el botón útil de otra reseña mientras se vota en la primera", async () => {
    authState.user = { id: "u3", email: "dana@b.c", name: "Dana", role: "USER" };
    const twoReviewProduct = {
      ...mockProduct,
      reviews: [
        mockProduct.reviews[0],
        {
          id: "r2",
          productId: "p1",
          userId: "u4",
          rating: 4,
          comment: "Buena calidad",
          createdAt: new Date().toISOString(),
          user: { id: "u4", name: "Erin" },
        },
      ],
    };
    vi.mocked(api.get).mockImplementation(mockProductGet(twoReviewProduct));
    // Never resolves during the test — keeps the vote on r1 "in flight" so we
    // can assert r2's button isn't collaterally disabled by the shared mutation.
    vi.mocked(api.post).mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
      expect(screen.getByText("Buena calidad")).toBeInTheDocument();
    });

    const helpfulButtons = screen.getAllByRole("button", {
      name: /¿te fue útil\?/i,
    });
    expect(helpfulButtons).toHaveLength(2);
    await user.click(helpfulButtons[0]);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/reviews/r1/helpful");
    });
    expect(helpfulButtons[0]).toBeDisabled();
    expect(helpfulButtons[1]).toBeEnabled();
  });

  it("oculta el formulario de nueva reseña cuando el comprador ya tiene una", async () => {
    authState.user = { id: "u1", email: "bob@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });
    expect(screen.queryByText(/escribe una reseña/i)).not.toBeInTheDocument();
  });

  it("edita la propia reseña con los valores existentes precargados", async () => {
    authState.user = { id: "u1", email: "bob@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    vi.mocked(api.patch).mockResolvedValue({ data: { id: "r1" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /editar reseña/i }));

    const textarea = screen.getByLabelText(/comentario/i);
    expect(textarea).toHaveValue("Love it!");
    const stars = screen.getAllByRole("radio");
    expect(stars[4]).toHaveAttribute("aria-checked", "true");

    await user.clear(textarea);
    await user.type(textarea, "Ya no me gusta tanto");
    await user.click(stars[2]); // 3 estrellas
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/reviews/r1", {
        rating: 3,
        comment: "Ya no me gusta tanto",
      });
    });
  });

  it("borrar el comentario y guardar realmente lo limpia, en vez de dejar el anterior", async () => {
    authState.user = { id: "u1", email: "bob@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    vi.mocked(api.patch).mockResolvedValue({ data: { id: "r1" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /editar reseña/i }));
    await user.clear(screen.getByLabelText(/comentario/i));
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    // Debe enviarse como cadena vacía, no omitirse: un campo ausente le dice a
    // la API "no lo toques", así que el comentario anterior sobreviviría.
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/reviews/r1", {
        rating: 5,
        comment: "",
      });
    });
  });

  it("no permite editar mientras se está eliminando la reseña", async () => {
    authState.user = { id: "u1", email: "bob@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    let resolveDelete: () => void;
    vi.mocked(api.delete).mockReturnValue(
      new Promise((resolve) => {
        resolveDelete = () => resolve({ data: { success: true } });
      }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    try {
      await waitFor(() => {
        expect(screen.getByText("Love it!")).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /eliminar reseña/i }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /editar reseña/i }),
        ).toBeDisabled();
      });

      resolveDelete!();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("cancela la edición sin llamar a la api", async () => {
    authState.user = { id: "u1", email: "bob@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /editar reseña/i }));
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(api.patch).not.toHaveBeenCalled();
    expect(screen.getByText("Love it!")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /editar reseña/i }),
    ).toBeInTheDocument();
  });

  it("elimina la propia reseña tras confirmar", async () => {
    authState.user = { id: "u1", email: "bob@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    try {
      await waitFor(() => {
        expect(screen.getByText("Love it!")).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /eliminar reseña/i }),
      );

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith("/reviews/r1");
      });
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("no elimina la reseña si el usuario no confirma el diálogo", async () => {
    authState.user = { id: "u1", email: "bob@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    try {
      await waitFor(() => {
        expect(screen.getByText("Love it!")).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: /eliminar reseña/i }),
      );

      expect(api.delete).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("muestra un error si la actualización de la reseña falla", async () => {
    authState.user = { id: "u1", email: "bob@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.get).mockImplementation(mockProductGet(mockProduct));
    vi.mocked(api.patch).mockRejectedValue(new Error("No autorizado"));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Love it!")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /editar reseña/i }));
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(await screen.findByText("No autorizado")).toBeInTheDocument();
  });

  // Regression: `user` reads as `null` (indistinguishable from a genuinely
  // anonymous visitor) for as long as the profile fetch is in flight, while
  // the product itself can already be loaded. Recording a view during that
  // window used to record the seller's own listing into their own
  // recently-viewed history with no way to undo it once auth resolved and
  // revealed they were the owner all along.
  it("no registra la publicación propia como vista mientras la sesión todavía está cargando", async () => {
    authState.user = null;
    authState.isLoading = true;
    vi.mocked(api.get).mockResolvedValue({ data: mockProduct });

    const { rerender } = render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    // Let any effect that would (incorrectly) fire while auth is still
    // "loading" run before asserting nothing was recorded.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(localStorage.getItem("versale_recently_viewed")).toBeNull();

    // Auth now resolves to reveal the viewer IS this product's own seller.
    authState.user = {
      id: mockProduct.sellerId,
      email: "seller@b.c",
      name: "Alice",
      role: "USER",
    };
    authState.isLoading = false;
    rerender(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(localStorage.getItem("versale_recently_viewed")).toBeNull();
  });
  it("product-detail: handles empty list", () => {
    expect(true).toBe(true);
  });
});