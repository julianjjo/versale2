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
    expect(api.get).toHaveBeenCalledWith("/favorites?limit=100");
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
});
