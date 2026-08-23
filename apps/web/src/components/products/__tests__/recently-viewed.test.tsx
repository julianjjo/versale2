import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  RecentlyViewed,
  RecentlyViewedSection,
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
    status: "AVAILABLE",
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

  it("fetches every stored id in a single batched request instead of one per product", async () => {
    recordProductView("p1");
    recordProductView("p2");
    const p1 = productFixture({ id: "p1", title: "Chaqueta vintage" });
    const p2 = productFixture({ id: "p2", title: "Vestido floral" });
    vi.mocked(api.get).mockResolvedValue({ data: { data: [p1, p2] } });

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
    // p2 was viewed after p1, so it's requested first — one call, not two.
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.get).toHaveBeenCalledWith("/products?ids=p2,p1&limit=2");
  });

  // The API has no reason to return rows in `id IN (...)` order — this
  // proves the rail restores most-recently-viewed-first order itself
  // instead of just trusting the response order.
  it("orders the rail by recency regardless of the order the API returns", async () => {
    recordProductView("p1");
    recordProductView("p2");
    recordProductView("p3");
    const p1 = productFixture({ id: "p1", title: "Uno" });
    const p2 = productFixture({ id: "p2", title: "Dos" });
    const p3 = productFixture({ id: "p3", title: "Tres" });
    // Deliberately out of recency order (p1, p2, p3) — p3 was viewed last.
    vi.mocked(api.get).mockResolvedValue({ data: { data: [p1, p2, p3] } });

    render(
      <TestProviders>
        <RecentlyViewed />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Tres")).toBeInTheDocument();
    });
    const titles = screen
      .getAllByRole("link")
      .map((link) => link.textContent)
      .filter((text): text is string => Boolean(text));
    const order = ["Tres", "Dos", "Uno"].map((title) =>
      titles.findIndex((text) => text.includes(title)),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("excludes the current product from the rail", async () => {
    recordProductView("p1");
    recordProductView("p2");
    const p1 = productFixture({ id: "p1", title: "Chaqueta vintage" });
    vi.mocked(api.get).mockResolvedValue({ data: { data: [p1] } });

    render(
      <TestProviders>
        <RecentlyViewed excludeId="p2" />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta vintage")).toBeInTheDocument();
    });
    expect(api.get).toHaveBeenCalledWith("/products?ids=p1&limit=1");
  });

  // A listing viewed in the past can be deleted, unapproved, or sold since —
  // the batch endpoint just omits it from its response, and the rail should
  // drop it silently rather than error or show a gap.
  it("drops a product missing from the batch response instead of breaking the rail", async () => {
    recordProductView("p1");
    recordProductView("p2");
    const p2 = productFixture({ id: "p2", title: "Vestido floral" });
    // p1 is absent from the response — no longer visible/approved.
    vi.mocked(api.get).mockResolvedValue({ data: { data: [p2] } });

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

describe("RecentlyViewedSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // Regression: this wrapper's themed background/padding must not render as
  // a visible blank gap for the common case (no viewing history yet).
  it("renders nothing at all when there is no viewing history", () => {
    const { container } = render(
      <TestProviders>
        <RecentlyViewedSection />
      </TestProviders>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the themed section wrapper around the rail when there is history", async () => {
    recordProductView("p1");
    const p1 = productFixture({ id: "p1", title: "Chaqueta vintage" });
    vi.mocked(api.get).mockResolvedValue({ data: { data: [p1] } });

    render(
      <TestProviders>
        <RecentlyViewedSection />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta vintage")).toBeInTheDocument();
    });
    expect(screen.getByText("Vistos recientemente")).toBeInTheDocument();
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
