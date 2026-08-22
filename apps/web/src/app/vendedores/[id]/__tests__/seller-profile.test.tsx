import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import SellerProfilePage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// A minimal App Router stand-in for the `<ProductsBrowser>` rendered inside
// this page — it needs `useSearchParams`/`usePathname` (for pagination) on
// top of `useParams` (the seller id from the URL segment). `push`/`replace`
// actually mutate the observed URL (like products-browser.test.tsx's own
// stand-in) rather than being inert spies, so a future pagination/navigation
// test here would actually see the resulting state change.
const nav = vi.hoisted(() => {
  const state = {
    url: "/vendedores/seller1",
    listeners: new Set<() => void>(),
    navigate(url: string) {
      state.url = url;
      state.listeners.forEach((listener) => listener());
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
    useParams: () => ({ id: "seller1" }),
    usePathname: () => useSyncExternalStore(subscribe, getUrl, getUrl).split("?")[0],
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(subscribe, getUrl, getUrl).split("?")[1] ?? "",
      ),
  };
});

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

// `id` deliberately does NOT match the "seller1" route param used below —
// the page must filter the catalog by the URL's id (available immediately,
// with no fetch required), not by echoing this response's `id` field, so a
// mismatch here would expose that bug immediately instead of masking it.
const mockProfile = {
  id: "some-other-id-the-page-must-not-use",
  name: "Bob",
  memberSince: "2025-01-15T00:00:00.000Z",
  activeListings: 2,
};

const mockProducts = {
  data: [
    {
      id: "p1",
      title: "Vintage denim jacket",
      description: "Classic Levi's trucker jacket",
      category: "Jackets",
      brand: "Levi's",
      size: "M",
      condition: "Good",
      price: 45000,
      sellerId: "seller1",
      isApproved: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      images: null,
      seller: { id: "seller1", name: "Bob" },
    },
  ],
  meta: { total: 1, page: 1, limit: 12, pages: 1 },
};

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
  extractApiError: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

import { api } from "@/lib/api";

describe("SellerProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = false;
    nav.url = "/vendedores/seller1";
  });

  it("muestra el nombre del vendedor, su antigüedad y sus publicaciones", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/products/sellers/seller1") return { data: mockProfile };
      if (url === "/products") return { data: mockProducts };
      return { data: {} };
    });

    render(
      <TestProviders>
        <SellerProfilePage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
    expect(screen.getByText(/Miembro desde enero de 2025/i)).toBeInTheDocument();
    expect(screen.getByText(/2 publicaciones activas/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
  });

  it("filtra el catálogo por el id del vendedor de la URL, no por otro", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/products/sellers/seller1") return { data: mockProfile };
      if (url === "/products") return { data: mockProducts };
      return { data: {} };
    });

    render(
      <TestProviders>
        <SellerProfilePage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({ params: expect.objectContaining({ sellerId: "seller1" }) }),
      );
    });
  });

  it("muestra 'vendedor no encontrado' cuando el perfil no existe", async () => {
    vi.mocked(api.get).mockRejectedValue(
      Object.assign(new Error("Not found"), { response: { status: 404 } }),
    );

    render(
      <TestProviders>
        <SellerProfilePage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/vendedor no encontrado/i)).toBeInTheDocument();
    });
  });

  it("muestra un error genérico cuando falla la carga por otra razón", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

    render(
      <TestProviders>
        <SellerProfilePage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no pudimos cargar este perfil/i)).toBeInTheDocument();
    });
  });
});
