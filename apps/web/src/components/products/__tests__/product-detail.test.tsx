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

  it("renders product info on success", async () => {
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
    expect(screen.getByText("$45.00")).toBeInTheDocument();
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders reviews", async () => {
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

  it("shows the not-found state when the product is missing", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Not found"));
    render(
      <TestProviders>
        <ProductDetail />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/product not found/i)).toBeInTheDocument();
    });
  });

  it("prompts login when adding to cart as an unauthenticated user", async () => {
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
    await user.click(screen.getByRole("button", { name: /add to cart/i }));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("adds to cart when authenticated", async () => {
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
    await user.click(screen.getByRole("button", { name: /add to cart/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/cart/items", {
        productId: "p1",
        quantity: 1,
      });
    });
  });

  it("hides the add-to-cart button for the product's seller", async () => {
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
    expect(screen.queryByRole("button", { name: /add to cart/i })).toBeNull();
    expect(screen.getByText(/this is your listing/i)).toBeInTheDocument();
  });

  it("posts a review from the form", async () => {
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
    await user.type(screen.getByLabelText(/comment/i), "Great item!");
    await user.click(screen.getByRole("button", { name: /post review/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/reviews", {
        productId: "p1",
        rating: 5,
        comment: "Great item!",
      });
    });
  });
});
