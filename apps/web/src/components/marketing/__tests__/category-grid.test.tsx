import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { CategoryGrid } from "../category-grid";
import { TestProviders } from "@/test-utils/TestProviders";

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

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
  extractApiError: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

import { api } from "@/lib/api";

// Shape of `/products/facets`: already ordered by listing count server-side.
// "Otros" deliberately ranks second here — the home rail must still refuse it
// a tile.
const FACETS = {
  brands: ["Levi's"],
  categories: [
    { name: "Chaquetas", count: 9 },
    { name: "Otros", count: 8 },
    { name: "Jeans", count: 7 },
    { name: "Camisetas", count: 6 },
    { name: "Vestidos", count: 4 },
    { name: "Calzado", count: 3 },
    { name: "Accesorios", count: 2 },
    { name: "Pantalones", count: 1 },
  ],
};

function mockFacets(data: unknown) {
  vi.mocked(api.get).mockResolvedValue({ data } as { data: unknown });
}

function renderGrid() {
  return render(
    <TestProviders>
      <CategoryGrid />
    </TestProviders>,
  );
}

describe("CategoryGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra las seis categorías con más prendas, en ese orden", async () => {
    mockFacets(FACETS);
    renderGrid();

    const titles = await screen.findAllByRole("heading", { level: 3 });
    expect(titles.map((h) => h.textContent)).toEqual([
      "Chaquetas",
      "Jeans",
      "Camisetas",
      "Vestidos",
      "Calzado",
      "Accesorios",
    ]);
  });

  it('nunca le da un tile a "Otros", aunque tenga más prendas que casi todas', async () => {
    mockFacets(FACETS);
    renderGrid();

    await screen.findByRole("heading", { level: 3, name: "Chaquetas" });
    expect(screen.queryByRole("heading", { name: "Otros" })).toBeNull();
  });

  it("muestra el conteo real de cada categoría, singular incluido", async () => {
    mockFacets({
      brands: [],
      categories: [
        { name: "Chaquetas", count: 9 },
        { name: "Calzado", count: 1 },
      ],
    });
    renderGrid();

    expect(await screen.findByText("9 prendas")).toBeInTheDocument();
    expect(screen.getByText("1 prenda")).toBeInTheDocument();
  });

  it("enlaza cada tile al catálogo filtrado por esa categoría", async () => {
    mockFacets({ brands: [], categories: [{ name: "Suéteres", count: 3 }] });
    renderGrid();

    const link = await screen.findByRole("link", { name: /Suéteres/ });
    expect(link).toHaveAttribute(
      "href",
      `/products?category=${encodeURIComponent("Suéteres")}`,
    );
  });

  it("descarta categorías sin prendas publicadas", async () => {
    mockFacets({
      brands: [],
      categories: [
        { name: "Chaquetas", count: 2 },
        { name: "Faldas", count: 0 },
      ],
    });
    renderGrid();

    await screen.findByRole("heading", { level: 3, name: "Chaquetas" });
    expect(screen.queryByRole("heading", { name: "Faldas" })).toBeNull();
  });

  it("invita a publicar cuando todavía no hay ninguna categoría", async () => {
    mockFacets({ brands: [], categories: [] });
    renderGrid();

    expect(
      await screen.findByText(/Todavía no hay categorías publicadas/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Publicar una prenda/ }),
    ).toHaveAttribute("href", "/sell");
  });

  // Regression: while the request was still being retried the old condition
  // (`isError || categories.length === 0`) told visitors the catalog was
  // empty, which is a very different claim from "we couldn't reach the API".
  it("dice que no pudo cargar — no que el catálogo esté vacío — cuando el API falla", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));
    renderGrid();

    expect(
      await screen.findByText(/No pudimos cargar las categorías/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no hay categorías/)).toBeNull();
    expect(
      screen.getByRole("link", { name: /Explorar el catálogo/ }),
    ).toHaveAttribute("href", "/products");
  });

  it("muestra el estado de carga mientras la petición sigue en vuelo", async () => {
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));
    renderGrid();

    await waitFor(() =>
      expect(screen.getByText(/Cargando categorías/)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Todavía no hay categorías/)).toBeNull();
    expect(screen.queryByText(/No pudimos cargar/)).toBeNull();
  });
});
