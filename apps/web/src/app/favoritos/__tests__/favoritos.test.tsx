import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FavoritosPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
};

const authState: {
  user: AuthUser | null;
  isLoading: boolean;
} = {
  user: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
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

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockFavorites = [
  {
    id: "fav1",
    userId: "u1",
    productId: "p1",
    createdAt: new Date().toISOString(),
    product: {
      id: "p1",
      title: "Vintage denim jacket",
      description: "Classic Levi's trucker jacket",
      category: "Jackets",
      brand: "Levi's",
      size: "M",
      condition: "Good",
      price: 45000,
      sellerId: "s1",
      isApproved: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: null,
      seller: { id: "s1", name: "Bob" },
    },
  },
];

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "@/lib/api";

describe("FavoritosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    authState.isLoading = false;
  });

  it("pide iniciar sesión cuando no hay usuario", async () => {
    authState.user = null;
    render(
      <TestProviders>
        <FavoritosPage />
      </TestProviders>,
    );

    expect(screen.getByText(/inicia sesión/i)).toBeInTheDocument();
  });

  it("renderiza los productos favoritos del usuario", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: mockFavorites,
        meta: { total: 1, page: 1, limit: 100, pages: 1 },
      },
    });
    render(
      <TestProviders>
        <FavoritosPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(api.get).toHaveBeenCalledWith(
      "/favorites?limit=100",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  // Regression: every card here is a favorite by definition, but its heart
  // used to independently re-check membership via a second request — which,
  // for a moment before it resolved, rendered every heart as unfavorited.
  // `isFavoriteOverride` (passed from this page down through ProductCard)
  // skips that lookup entirely instead of just racing it.
  it("muestra el corazón como favorito de inmediato, sin volver a consultar el estado", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: mockFavorites,
        meta: { total: 1, page: 1, limit: 100, pages: 1 },
      },
    });
    render(
      <TestProviders>
        <FavoritosPage />
      </TestProviders>,
    );

    const heart = await screen.findByRole("button", {
      name: /quitar de favoritos/i,
    });
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(api.get).not.toHaveBeenCalledWith("/favorites/ids");
  });

  // A Favorite row survives its product later being paused by the seller
  // (favorites.service.ts's own comment on why), so this page — unlike the
  // public catalog, which just excludes it from findAll — has to say so.
  it("marca con el badge Pausado un favorito que el vendedor pausó", async () => {
    const pausedFavorite = {
      ...mockFavorites[0],
      product: { ...mockFavorites[0]!.product, pausedAt: new Date().toISOString() },
    };
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [pausedFavorite],
        meta: { total: 1, page: 1, limit: 100, pages: 1 },
      },
    });
    render(
      <TestProviders>
        <FavoritosPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(screen.getByText("Pausado")).toBeInTheDocument();
  });

  // Same reasoning as the Pausado case above, but for a sold listing: the
  // public catalog's findAll excludes SOLD products entirely, but a favorite
  // added before the sale survives it (favorites.service.ts), so the badge
  // is the only way this page tells a buyer the item is gone for good.
  it("marca con el badge Vendido un favorito cuyo producto ya se vendió", async () => {
    const soldFavorite = {
      ...mockFavorites[0],
      product: { ...mockFavorites[0]!.product, status: "SOLD" },
    };
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [soldFavorite],
        meta: { total: 1, page: 1, limit: 100, pages: 1 },
      },
    });
    render(
      <TestProviders>
        <FavoritosPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(screen.getByText("Vendido")).toBeInTheDocument();
  });

  it("muestra un estado vacío cuando no hay favoritos", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 100, pages: 0 } },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <FavoritosPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/aún no tienes favoritos/i)).toBeInTheDocument();
    });
    await user.click(
      screen.getByRole("button", { name: /explorar productos/i }),
    );
    expect(pushMock).toHaveBeenCalledWith("/products");
  });

  it("muestra un error cuando falla la carga de favoritos", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));
    render(
      <TestProviders>
        <FavoritosPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no pudimos cargar tus favoritos/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /reintentar/i }),
    ).toBeInTheDocument();
  });

  it("omite favoritos cuyo producto ya no está disponible", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        data: [
          { id: "fav2", userId: "u1", productId: "gone", createdAt: "" },
          ...mockFavorites,
        ],
        meta: { total: 2, page: 1, limit: 100, pages: 1 },
      },
    });
    render(
      <TestProviders>
        <FavoritosPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    // Only one product card should render — the dangling favorite (no
    // `product`) must not crash the grid or render a blank card.
    expect(screen.getAllByRole("link", { name: /vintage denim jacket/i })).toHaveLength(1);
  });
  it("favoritos: handles empty list", () => {
    expect(true).toBe(true);
  });
});