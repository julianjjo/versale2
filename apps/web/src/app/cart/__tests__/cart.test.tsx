import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useParams: () => ({}),
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
  login: () => Promise<void>;
  signup: () => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
} = {
  user: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
  isLoading: false,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  refresh: async () => {},
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

const mockCart = {
  id: "cart1",
  userId: "u1",
  items: [
    {
      id: "ci1",
      cartId: "cart1",
      productId: "p1",
      quantity: 2,
      priceAtAdd: 25.0,
      product: {
        id: "p1",
        title: "Cotton t-shirt",
        description: "Soft cotton tee",
        category: "Tops",
        brand: null,
        size: "M",
        condition: "Good",
        price: 25.0,
        sellerId: "s1",
        isApproved: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        images: null,
      },
    },
    {
      id: "ci2",
      cartId: "cart1",
      productId: "p2",
      quantity: 1,
      priceAtAdd: 50.0,
      product: {
        id: "p2",
        title: "Wool sweater",
        description: "Cozy knit",
        category: "Sweaters",
        brand: null,
        size: "L",
        condition: "Like New",
        price: 50.0,
        sellerId: "s2",
        isApproved: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        images: null,
      },
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const emptyCart = {
  id: "cart1",
  userId: "u1",
  items: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
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

describe("CartPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    authState.isLoading = false;
  });

  it("renders the cart heading and items", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /your cart/i })).toBeInTheDocument();
    });
    expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    expect(screen.getByText("Wool sweater")).toBeInTheDocument();
  });

  it("shows the correct total", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    // 2*25 + 1*50 = 100; both subtotal and total show this value
    await waitFor(() => {
      expect(screen.getAllByText("$100.00").length).toBeGreaterThan(0);
    });
  });

  it("shows an empty state when the cart has no items", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: emptyCart });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
    });
  });

  it("prompts the user to log in if not authenticated", () => {
    authState.user = null;
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );
    expect(screen.getByText(/please log in/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("calls the api to remove an item when Remove is clicked", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button", { name: /remove/i });
    await user.click(removeButtons[0]!);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/cart/items/ci1");
    });
  });

  it("places an order on checkout", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    vi.mocked(api.post).mockResolvedValue({ data: { id: "order1" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /checkout/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/orders", {});
    });
    expect(pushMock).toHaveBeenCalledWith("/orders");
  });

  it("shows an error when checkout fails", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    vi.mocked(api.post).mockRejectedValue(new Error("Cart is empty"));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /checkout/i }));

    await waitFor(() => {
      expect(screen.getByText("Cart is empty")).toBeInTheDocument();
    });
  });
});
