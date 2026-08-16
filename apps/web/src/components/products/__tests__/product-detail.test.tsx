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
  images: ["https://example.com/jacket.jpg"],
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
// own GET /favorites alongside the product fetch. Tests that only care about
// the product response can use this so that call doesn't collide with a
// blanket `mockResolvedValue`/`mockRejectedValue` on every `api.get` call.
function mockProductGet(product: unknown) {
  return async (url: string) =>
    url === "/favorites" ? { data: [] } : { data: product };
}

describe("ProductDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = false;
    // Whether a token is present decides if the server-seeded product is
    // revalidated, so each test starts from a known (anonymous) state.
    tokenStore.clear();
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
    expect(api.get).not.toHaveBeenCalledWith("/products/p1");
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
      expect(api.get).toHaveBeenCalledWith("/products/p1");
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
});
