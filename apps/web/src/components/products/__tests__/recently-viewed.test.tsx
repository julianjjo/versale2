import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  RecentlyViewed,
  useRecordProductView,
} from "../recently-viewed";
import { recordProductView } from "@/lib/recently-viewed";
import { TestProviders } from "@/test-utils/TestProviders";
import type { Product } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => ({ user: null, isLoading: false }),
  };
});

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "@/lib/api";

function productFixture(overrides: Partial<Product> & { id: string; title: string }): Product {
  return {
    description: "Descripción",
    category: "Tops",
    brand: null,
    size: "M",
    condition: "Good",
    price: 45000,
    sellerId: "s1",
    isApproved: true,
    createdAt: new Date("2026-01-10T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-10T10:00:00Z").toISOString(),
    images: null,
    seller: { id: "s1", name: "Ana Gómez" },
    ...overrides,
  };
}

describe("RecentlyViewed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("renders nothing when there is no viewing history", () => {
    const { container } = render(
      <TestProviders>
        <RecentlyViewed />
      </TestProviders>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a card for each recently viewed product", async () => {
    recordProductView("p1");
    recordProductView("p2");
    const p1 = productFixture({ id: "p1", title: "Chaqueta vintage" });
    const p2 = productFixture({ id: "p2", title: "Vestido floral" });
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/products/p1") return { data: p1 };
      if (url === "/products/p2") return { data: p2 };
      throw new Error(`unexpected url ${url}`);
    });

    render(
      <TestProviders>
        <RecentlyViewed />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta vintage")).toBeInTheDocument();
    });
    expect(screen.getByText("Vestido floral")).toBeInTheDocument();
    expect(screen.getByText("Vistos recientemente")).toBeInTheDocument();
  });

  it("excludes the current product from the rail", async () => {
    recordProductView("p1");
    recordProductView("p2");
    const p1 = productFixture({ id: "p1", title: "Chaqueta vintage" });
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/products/p1") return { data: p1 };
      throw new Error(`unexpected url ${url}`);
    });

    render(
      <TestProviders>
        <RecentlyViewed excludeId="p2" />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta vintage")).toBeInTheDocument();
    });
    expect(api.get).not.toHaveBeenCalledWith("/products/p2");
  });

  // A listing viewed in the past can be deleted, unapproved, or otherwise
  // inaccessible by the time the rail renders — it should just drop out
  // silently rather than break the rest of the rail.
  it("drops a product that fails to load instead of breaking the rail", async () => {
    recordProductView("p1");
    recordProductView("p2");
    const p2 = productFixture({ id: "p2", title: "Vestido floral" });
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/products/p1") throw new Error("Not found");
      if (url === "/products/p2") return { data: p2 };
      throw new Error(`unexpected url ${url}`);
    });

    render(
      <TestProviders>
        <RecentlyViewed />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Vestido floral")).toBeInTheDocument();
    });
    expect(screen.queryByText("Chaqueta vintage")).not.toBeInTheDocument();
  });
});

describe("useRecordProductView", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  function Harness({ productId }: { productId: string | undefined }) {
    useRecordProductView(productId);
    return null;
  }

  it("records a view once a product id is provided", async () => {
    render(<Harness productId="p1" />);

    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem("versale_recently_viewed") ?? "[]"),
      ).toEqual(["p1"]);
    });
  });

  it("does not record anything while the product id is undefined", async () => {
    render(<Harness productId={undefined} />);

    // Give any pending microtask a chance to run before asserting the
    // negative — otherwise this would trivially pass before the effect (if
    // it incorrectly fired) had a chance to write anything.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(localStorage.getItem("versale_recently_viewed")).toBeNull();
  });
});
