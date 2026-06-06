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

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from "@/lib/api";

describe("ProductsBrowser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the filter form", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: emptyProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/min price/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/max price/i)).toBeInTheDocument();
  });

  it("renders a list of products when data is available", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vintage denim jacket")).toBeInTheDocument();
    });
    expect(screen.getByText("Wool sweater")).toBeInTheDocument();
    expect(screen.getByText("$45.00")).toBeInTheDocument();
    expect(screen.getByText(/sold by alice/i)).toBeInTheDocument();
  });

  it("renders an empty state when no products are returned", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: emptyProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no products found/i)).toBeInTheDocument();
    });
  });

  it("shows an error message when fetching products fails", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/failed to load products/i)).toBeInTheDocument();
    });
  });

  it("links each product to its detail page", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProducts });
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

  it("submits filter values on apply", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: emptyProducts });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await user.type(screen.getByPlaceholderText(/search/i), "jacket");
    await user.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          params: expect.objectContaining({ search: "jacket", page: 1 }),
        }),
      );
    });
  });

  it("renders a placeholder when the product has no image", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockProducts });
    render(
      <TestProviders>
        <ProductsBrowser showPagination={false} />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Wool sweater")).toBeInTheDocument();
    });
    expect(screen.getAllByText("No image").length).toBeGreaterThan(0);
  });

  it("renders pagination controls when there are multiple pages", async () => {
    vi.mocked(api.get).mockResolvedValue({
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
      expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });
});
