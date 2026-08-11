import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductDetail } from "../product-detail";
import { TestProviders } from "@/test-utils/TestProviders";

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
  },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Request failed",
}));

import { api } from "@/lib/api";

describe("ProductDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = false;
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
    vi.mocked(api.get).mockRejectedValue(new Error("Not found"));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/producto no encontrado/i)).toBeInTheDocument();
    });
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
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("agrega al carrito cuando el usuario está autenticado", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.get).mockResolvedValue({ data: mockProduct });
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
  });

  it("publica una reseña desde el formulario", async () => {
    authState.user = { id: "u2", email: "u2@b.c", name: "Charlie", role: "USER" };
    vi.mocked(api.get).mockResolvedValue({ data: mockProduct });
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

  it("navega la calificación con el teclado (roving tabindex)", async () => {
    authState.user = { id: "u2", email: "u2@b.c", name: "Charlie", role: "USER" };
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
});
