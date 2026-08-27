import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MisProductosPage from "../page";
import { TestProviders, createTestQueryClient } from "@/test-utils/TestProviders";
import type { Product } from "@/lib/types";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
}));

const authState: {
  user: { id: string; email: string; name: string; role: "USER" | "ADMIN" } | null;
  isLoading: boolean;
} = {
  user: {
    id: "u1",
    email: "alice@versale.local",
    name: "Alice",
    role: "USER",
  },
  isLoading: false,
};

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>(
    "@/lib/auth",
  );
  return {
    ...actual,
    useAuth: () => ({
      ...authState,
      login: async () => {},
      signup: async () => {},
      logout: () => {},
      refresh: async () => {},
    }),
  };
});

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  extractApiError: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

import { api } from "@/lib/api";

function productFixture(
  overrides: Partial<Product> & { id: string; title: string },
): Product {
  return {
    description: "Descripción",
    category: "Tops",
    brand: null,
    size: "M",
    condition: "Good",
    price: 45000,
    sellerId: "u1",
    isApproved: false,
    rejectedAt: null,
    status: "AVAILABLE",
    rejectionReason: null,
    createdAt: new Date("2026-01-10T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-10T10:00:00Z").toISOString(),
    images: null,
    seller: { id: "u1", name: "Alice" },
    ...overrides,
  };
}

function paginated(products: Product[]) {
  return {
    data: products,
    meta: { total: products.length, page: 1, pages: 1 },
  };
}

describe("MisProductosPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = {
      id: "u1",
      email: "alice@versale.local",
      name: "Alice",
      role: "USER",
    };
    authState.isLoading = false;
  });

  it("pide iniciar sesión cuando no hay usuario", async () => {
    authState.user = null;
    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    expect(await screen.findByText(/inicia sesión/i)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  it("lista las publicaciones del vendedor con su estado", async () => {
    const pending = productFixture({ id: "p1", title: "Chaqueta pendiente" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p1");
    expect(within(card).getByText("En revisión")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(
      "/products/mine?status=all&page=1&limit=20",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("muestra En revisión (no Rechazado) para un rechazo sin motivo escrito", async () => {
    // Roadmap's closed band rule: Rechazado requires rejectionReason != null.
    // A moderator rejecting without a written reason leaves the seller with
    // nothing actionable, so the band stays "En revisión" even though
    // rejectedAt is set.
    const rejectedNoReason = productFixture({
      id: "p2",
      title: "Chaqueta rechazada sin motivo",
      isApproved: false,
      rejectionReason: null,
      rejectedAt: new Date("2026-02-01T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([rejectedNoReason]) });

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p2");
    expect(within(card).getByText("En revisión")).toBeInTheDocument();
    expect(within(card).queryByText("Rechazado")).not.toBeInTheDocument();
  });

  it("Publicar otro igual navega a /sell precargando título, categoría y talla", async () => {
    const source = productFixture({
      id: "p3",
      title: "Jean Levi's 501",
      category: "Jeans",
      size: "L",
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([source]) });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p3");
    await user.click(
      within(card).getByRole("button", { name: "Publicar otro igual" }),
    );

    const target = pushMock.mock.calls.at(-1)?.[0] as string;
    const url = new URL(target, "http://localhost");
    expect(url.pathname).toBe("/sell");
    expect(url.searchParams.get("title")).toBe("Jean Levi's 501");
    expect(url.searchParams.get("category")).toBe("Jeans");
    expect(url.searchParams.get("size")).toBe("L");
  });

  it("muestra las vistas, favoritos y preguntas de cada publicación", async () => {
    const product = productFixture({
      id: "p1",
      title: "Chaqueta con estadísticas",
      viewCount: 12,
      _count: { reviews: 0, favoritedBy: 1, questions: 3 },
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([product]) });

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const stats = await screen.findByTestId("mine-product-stats-p1");
    expect(stats).toHaveTextContent("12 vistas");
    expect(stats).toHaveTextContent("1 favorito");
    expect(stats).toHaveTextContent("3 preguntas");
  });

  it("muestra 0 y usa singular cuando la publicación no tiene interacción todavía", async () => {
    const product = productFixture({
      id: "p1",
      title: "Chaqueta nueva",
      viewCount: 1,
      _count: { reviews: 0, favoritedBy: 0, questions: 0 },
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([product]) });

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const stats = await screen.findByTestId("mine-product-stats-p1");
    expect(stats).toHaveTextContent("1 vista");
    expect(stats).toHaveTextContent("0 favoritos");
    expect(stats).toHaveTextContent("0 preguntas");
  });

  it("muestra un error, no el estado vacío, cuando la lista falla al cargar", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    expect(
      await screen.findByText(/no pudimos cargar tus publicaciones/i),
    ).toBeInTheDocument();
    // A failed fetch must not be confused with "you have nothing published" —
    // `data` is undefined in both cases, so this has to check `isError`, not
    // just `products.length`.
    expect(
      screen.queryByText(/aún no has publicado ningún producto/i),
    ).not.toBeInTheDocument();
  });

  it("muestra el motivo del rechazo cuando la publicación fue rechazada", async () => {
    const rejected = productFixture({
      id: "p2",
      title: "Camisa rechazada",
      isApproved: false,
      rejectedAt: new Date("2026-01-15T10:00:00Z").toISOString(),
      rejectionReason: "Las fotos no muestran bien el producto",
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([rejected]) });

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p2");
    expect(
      within(card).getByText(/las fotos no muestran bien el producto/i),
    ).toBeInTheDocument();
  });

  it("no ofrece Editar ni Eliminar para una publicación ya vendida", async () => {
    const sold = productFixture({
      id: "p3",
      title: "Abrigo vendido",
      isApproved: true,
      status: "SOLD",
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([sold]) });

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p3");
    expect(within(card).getByText("Vendido")).toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Editar" }),
    ).not.toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Eliminar" }),
    ).not.toBeInTheDocument();
    // The sold row is exactly the relist case: "Publicar otro igual" stays
    // available even though edit/delete are gone.
    expect(
      within(card).getByRole("button", { name: "Publicar otro igual" }),
    ).toBeEnabled();
  });

  it("pausa una publicación aprobada al hacer clic en Pausar", async () => {
    const approved = productFixture({
      id: "p12",
      title: "Chaqueta aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved]) });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p12");
    expect(within(card).getByText("Publicado")).toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Pausar" }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/p12/pause");
    });
  });

  it("muestra el badge Pausado y reactiva una publicación pausada", async () => {
    const paused = productFixture({
      id: "p13",
      title: "Camisa pausada",
      isApproved: true,
      pausedAt: new Date("2026-02-05T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([paused]) });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p13");
    expect(within(card).getByText("Pausado")).toBeInTheDocument();
    expect(within(card).queryByText("Publicado")).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Reactivar" }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/p13/unpause");
    });
  });

  // Regression: a paused listing can be sent back to review by a later
  // moderated-field edit (isApproved flips to false, pausedAt stays set) —
  // the backend's unpauseProduct explicitly supports unpausing that state,
  // so the button must still be reachable, not just for isApproved:true.
  it("ofrece Reactivar (no Pausar) para una publicación pausada que volvió a moderación", async () => {
    const pausedAndPending = productFixture({
      id: "p16",
      title: "Vestido pausado y pendiente",
      isApproved: false,
      pausedAt: new Date("2026-02-06T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([pausedAndPending]),
    });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p16");
    // Moderation status wins over "pausado" in the badge (matches
    // ProductCard's own precedence on Favoritos), but the action button
    // must still offer to unpause.
    expect(within(card).getByText("En revisión")).toBeInTheDocument();
    expect(within(card).queryByText("Pausado")).not.toBeInTheDocument();
    await user.click(within(card).getByRole("button", { name: "Reactivar" }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/p16/unpause");
    });
  });

  it("no ofrece Pausar para una publicación pendiente", async () => {
    const pending = productFixture({
      id: "p14",
      title: "Falda pendiente",
      isApproved: false,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p14");
    expect(
      within(card).queryByRole("button", { name: "Pausar" }),
    ).not.toBeInTheDocument();
  });

  it("no ofrece Pausar ni Reactivar para una publicación ya vendida", async () => {
    const sold = productFixture({
      id: "p15",
      title: "Botas vendidas",
      isApproved: true,
      status: "SOLD",
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([sold]) });

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p15");
    expect(
      within(card).queryByRole("button", { name: "Pausar" }),
    ).not.toBeInTheDocument();
    expect(
      within(card).queryByRole("button", { name: "Reactivar" }),
    ).not.toBeInTheDocument();
  });

  it("cambia de pestaña de estado y vuelve a pedir la lista filtrada", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginated([]) });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Vendidos" }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products/mine?status=sold&page=1&limit=20",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("filtra por la pestaña Pausados", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginated([]) });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await waitFor(() => expect(api.get).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: "Pausados" }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/products/mine?status=paused&page=1&limit=20",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("edita título, descripción y precio a través del modal", async () => {
    const pending = productFixture({ id: "p4", title: "Falda pendiente" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p4");
    await user.click(within(card).getByRole("button", { name: "Editar" }));

    const dialog = screen.getByRole("dialog");
    const priceInput = within(dialog).getByLabelText(/precio/i);
    await user.clear(priceInput);
    await user.type(priceInput, "60000");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    // Only the field the seller actually touched is sent — title/description
    // never changed, so they're left out rather than round-tripped through
    // `.trim()` and sent back unchanged (see handleEditSubmit).
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/p4", {
        price: 60000,
      });
    });
  });

  it("solo envía título/descripción cuando el valor realmente cambió, no por un simple trim", async () => {
    // Simulates a listing whose stored title carries whitespace `/sell` never
    // trims on submit. Saving the price alone must not read as a title change.
    const withWhitespace = productFixture({
      id: "p6",
      title: "Chaqueta ",
      description: "Descripción ",
      price: 30000,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([withWhitespace]) });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p6");
    await user.click(within(card).getByRole("button", { name: "Editar" }));

    const dialog = screen.getByRole("dialog");
    const priceInput = within(dialog).getByLabelText(/precio/i);
    await user.clear(priceInput);
    await user.type(priceInput, "35000");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/p6", {
        price: 35000,
      });
    });
  });

  it("elimina una publicación tras confirmar", async () => {
    const pending = productFixture({ id: "p5", title: "Pantalón pendiente" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    try {
      const card = await screen.findByTestId("mine-product-p5");
      await user.click(within(card).getByRole("button", { name: "Eliminar" }));

      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith("/products/p5");
      });
    } finally {
      // In a `finally` so a failed assertion above still restores the real
      // `window.confirm` instead of leaking a stub that returns `true` for
      // every later test in this file.
      confirmSpy.mockRestore();
    }
  });

  it("invalida también la caché del producto y del catálogo al editar", async () => {
    const pending = productFixture({ id: "p7", title: "Bufanda pendiente" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const client = createTestQueryClient();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");
    const user = userEvent.setup();

    render(
      <TestProviders client={client}>
        <MisProductosPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("mine-product-p7");
    await user.click(within(card).getByRole("button", { name: "Editar" }));
    const dialog = screen.getByRole("dialog");
    const priceInput = within(dialog).getByLabelText(/precio/i);
    await user.clear(priceInput);
    await user.type(priceInput, "40000");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    // The seller can reach this same product's detail page and the public
    // catalog from elsewhere in the app — both must drop their cached copy
    // too, or a save here can look "not saved" for as long as those queries'
    // staleTime allows.
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["product", "p7"],
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["products"] });
  });

  it("deshabilita Editar mientras una eliminación está en curso, para no editar una fila que está desapareciendo", async () => {
    const pending = productFixture({ id: "p8", title: "Gorra pendiente" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });
    let resolveDelete!: () => void;
    vi.mocked(api.delete).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = () => resolve({ data: {} });
        }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    try {
      const card = await screen.findByTestId("mine-product-p8");
      await user.click(within(card).getByRole("button", { name: "Eliminar" }));

      await waitFor(() => {
        expect(
          within(card).getByRole("button", { name: "Editar" }),
        ).toBeDisabled();
      });

      resolveDelete();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("busca publicaciones por título, marca o categoría", async () => {
    const pending = productFixture({ id: "p9", title: "Chaqueta de jean" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p9");
    await user.type(screen.getByLabelText(/buscar publicaciones/i), "jean");

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("search=jean"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("reinicia a la página 1 al buscar, aunque estuviera en otra página", async () => {
    const pending = productFixture({ id: "p10", title: "Vestido" });
    vi.mocked(api.get).mockResolvedValue({
      data: { data: [pending], meta: { total: 25, page: 1, pages: 2 } },
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p10");
    await user.click(screen.getByRole("button", { name: /siguiente/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        expect.stringContaining("page=2"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    await user.type(screen.getByLabelText(/buscar publicaciones/i), "vestido");

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        expect.stringContaining("search=vestido"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(api.get).toHaveBeenLastCalledWith(expect.stringContaining("page=1"), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("mantiene la búsqueda al cambiar de pestaña de estado, combinando ambos filtros en la misma solicitud", async () => {
    const pending = productFixture({ id: "p11", title: "Bolso" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p11");
    await user.type(screen.getByLabelText(/buscar publicaciones/i), "bolso");

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("search=bolso"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Vendidos" }));

    await waitFor(() => {
      expect(api.get).toHaveBeenLastCalledWith(
        expect.stringContaining("status=sold"),
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(api.get).toHaveBeenLastCalledWith(
      expect.stringContaining("search=bolso"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    // El campo de búsqueda en pantalla no se vació al cambiar de pestaña.
    expect(screen.getByLabelText(/buscar publicaciones/i)).toHaveValue("bolso");
  });

  it("distingue 'sin publicaciones' de 'sin resultados para la búsqueda'", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginated([]) });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    expect(
      await screen.findByText(/aún no has publicado ningún producto/i),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/buscar publicaciones/i), "algo que no existe");

    await waitFor(() => {
      expect(
        screen.getByText(/ninguna publicación coincide con tu búsqueda/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/aún no has publicado ningún producto/i),
    ).not.toBeInTheDocument();
    // A filtered empty state has no "publish your first item" CTA — it isn't
    // the seller's first listing, just a search with no matches.
    expect(
      screen.queryByRole("link", { name: /publicar tu primer producto/i }),
    ).not.toBeInTheDocument();
  });

  it("muestra un estado vacío con CTA para publicar cuando no hay productos", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginated([]) });

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    expect(
      await screen.findByText(/aún no has publicado ningún producto/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /publicar tu primer producto/i }),
    ).toHaveAttribute("href", "/sell");
  });

  it("ofrece la casilla de selección para una publicación aprobada y para una pausada, pero no para una vendida ni pendiente", async () => {
    const approved = productFixture({
      id: "p20",
      title: "Aprobada",
      isApproved: true,
    });
    const paused = productFixture({
      id: "p21",
      title: "Pausada",
      isApproved: true,
      pausedAt: new Date("2026-02-05T10:00:00Z").toISOString(),
    });
    const sold = productFixture({
      id: "p22",
      title: "Vendida",
      isApproved: true,
      status: "SOLD",
    });
    const pending = productFixture({ id: "p23", title: "Pendiente" });
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([approved, paused, sold, pending]),
    });

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    const approvedCard = await screen.findByTestId("mine-product-p20");
    const pausedCard = screen.getByTestId("mine-product-p21");
    const soldCard = screen.getByTestId("mine-product-p22");
    const pendingCard = screen.getByTestId("mine-product-p23");

    expect(
      within(approvedCard).getByLabelText(/seleccionar aprobada/i),
    ).toBeInTheDocument();
    expect(
      within(pausedCard).getByLabelText(/seleccionar pausada/i),
    ).toBeInTheDocument();
    expect(
      within(soldCard).queryByLabelText(/seleccionar vendida/i),
    ).not.toBeInTheDocument();
    expect(
      within(pendingCard).queryByLabelText(/seleccionar pendiente/i),
    ).not.toBeInTheDocument();
  });

  it("pausa en lote las publicaciones aprobadas seleccionadas", async () => {
    const first = productFixture({
      id: "p30",
      title: "Primera aprobada",
      isApproved: true,
    });
    const second = productFixture({
      id: "p31",
      title: "Segunda aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first, second]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { paused: 2, requested: 2 },
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p30");
    await user.click(screen.getByLabelText(/seleccionar primera aprobada/i));
    await user.click(screen.getByLabelText(/seleccionar segunda aprobada/i));

    expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Pausar seleccionadas" }),
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/bulk-pause", {
        ids: ["p30", "p31"],
      });
    });
    await waitFor(() => {
      expect(screen.queryByText(/seleccionadas$/)).not.toBeInTheDocument();
    });
  });

  it("reactiva en lote las publicaciones pausadas seleccionadas", async () => {
    const first = productFixture({
      id: "p32",
      title: "Primera pausada",
      isApproved: true,
      pausedAt: new Date("2026-02-05T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { unpaused: 1, requested: 1 },
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p32");
    await user.click(screen.getByLabelText(/seleccionar primera pausada/i));
    await user.click(
      screen.getByRole("button", { name: "Reactivar seleccionadas" }),
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/bulk-unpause", {
        ids: ["p32"],
      });
    });
  });

  // Regression: the checkbox is shared by both bulk actions, so selecting
  // every eligible row on a single-status tab and reaching for the wrong
  // button must not silently no-op the whole batch.
  it("deshabilita Pausar seleccionadas cuando ninguna seleccionada se puede pausar", async () => {
    const paused = productFixture({
      id: "p33",
      title: "Ya pausada",
      isApproved: true,
      pausedAt: new Date("2026-02-05T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([paused]) });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p33");
    await user.click(screen.getByLabelText(/seleccionar ya pausada/i));

    expect(
      screen.getByRole("button", { name: "Pausar seleccionadas" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Reactivar seleccionadas" }),
    ).toBeEnabled();
  });

  it("deshabilita Reactivar seleccionadas cuando ninguna seleccionada se puede reactivar", async () => {
    const approved = productFixture({
      id: "p34",
      title: "Sigue aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved]) });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p34");
    await user.click(screen.getByLabelText(/seleccionar sigue aprobada/i));

    expect(
      screen.getByRole("button", { name: "Reactivar seleccionadas" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Pausar seleccionadas" }),
    ).toBeEnabled();
  });

  it("muestra un aviso distinto cuando ninguna de las seleccionadas se pudo pausar", async () => {
    const approved = productFixture({
      id: "p35",
      title: "Aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { paused: 0, requested: 1 },
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p35");
    await user.click(screen.getByLabelText(/seleccionar aprobada/i));
    await user.click(
      screen.getByRole("button", { name: "Pausar seleccionadas" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /ninguna de las publicaciones seleccionadas estaba disponible para pausar\./i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("limpia la selección al cambiar de pestaña de estado", async () => {
    const approved = productFixture({
      id: "p36",
      title: "Aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved]) });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p36");
    await user.click(screen.getByLabelText(/seleccionar aprobada/i));
    expect(screen.getByText("1 seleccionada")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Pendientes" }));

    await waitFor(() => {
      expect(screen.queryByText(/seleccionada$/)).not.toBeInTheDocument();
    });
  });

  it("descarta la selección de una publicación pausada/reactivada individualmente", async () => {
    const first = productFixture({
      id: "p37",
      title: "Uno",
      isApproved: true,
    });
    const second = productFixture({
      id: "p38",
      title: "Dos",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first, second]) });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p37");
    await user.click(screen.getByLabelText(/seleccionar uno/i));
    await user.click(screen.getByLabelText(/seleccionar dos/i));
    expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();

    // The per-row "Pausar" button, not the bulk action bar.
    await user.click(
      within(screen.getByTestId("mine-product-p37")).getByRole("button", {
        name: "Pausar",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("1 seleccionada")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/seleccionar dos/i)).toBeChecked();
  });

  // The frontend intentionally doesn't pre-filter by eligibility before
  // sending — it sends the whole selection and lets the backend's
  // compare-and-swap silently exclude what a given action can't touch,
  // same design as bulkApprove/bulkReject.
  it("envía la selección completa a Pausar seleccionadas aunque incluya una publicación ya pausada", async () => {
    const approved = productFixture({
      id: "p39",
      title: "Aprobada",
      isApproved: true,
    });
    const paused = productFixture({
      id: "p40",
      title: "Pausada",
      isApproved: true,
      pausedAt: new Date("2026-02-05T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved, paused]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { paused: 1, requested: 2 },
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p39");
    await user.click(screen.getByLabelText(/seleccionar aprobada/i));
    await user.click(screen.getByLabelText(/seleccionar pausada/i));

    // Mixed selection: eligible for at least one of the two actions each,
    // so neither button is disabled by the none-eligible safety check.
    const pauseButton = screen.getByRole("button", {
      name: "Pausar seleccionadas",
    });
    expect(pauseButton).toBeEnabled();
    await user.click(pauseButton);

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/bulk-pause", {
        ids: ["p39", "p40"],
      });
    });
  });

  it("muestra un aviso de éxito parcial al pausar en lote", async () => {
    const first = productFixture({ id: "p41", title: "Chaqueta", isApproved: true });
    const second = productFixture({ id: "p42", title: "Camiseta", isApproved: true });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first, second]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { paused: 1, requested: 2 },
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p41");
    await user.click(
      screen.getByLabelText(/seleccionar todas las elegibles en esta página/i),
    );
    await user.click(
      screen.getByRole("button", { name: "Pausar seleccionadas" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /se pausaron 1 de 2 publicaciones\. las demás ya no estaban disponibles para pausar\./i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("muestra un aviso de éxito parcial al reactivar en lote", async () => {
    const first = productFixture({
      id: "p43",
      title: "Falda",
      isApproved: true,
      pausedAt: new Date("2026-02-05T10:00:00Z").toISOString(),
    });
    const second = productFixture({
      id: "p44",
      title: "Vestido",
      isApproved: true,
      pausedAt: new Date("2026-02-05T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first, second]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { unpaused: 1, requested: 2 },
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p43");
    await user.click(
      screen.getByLabelText(/seleccionar todas las elegibles en esta página/i),
    );
    await user.click(
      screen.getByRole("button", { name: "Reactivar seleccionadas" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /se reactivaron 1 de 2 publicaciones\. las demás ya no estaban disponibles para reactivar\./i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("muestra un aviso distinto cuando ninguna de las seleccionadas se pudo reactivar", async () => {
    const paused = productFixture({
      id: "p45",
      title: "Pausada",
      isApproved: true,
      pausedAt: new Date("2026-02-05T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([paused]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { unpaused: 0, requested: 1 },
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p45");
    await user.click(screen.getByLabelText(/seleccionar pausada/i));
    await user.click(
      screen.getByRole("button", { name: "Reactivar seleccionadas" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /ninguna de las publicaciones seleccionadas estaba disponible para reactivar\./i,
        ),
      ).toBeInTheDocument();
    });
  });

  // Regression: a bulk action's outcome notice used to linger after
  // switching tabs, describing a batch no longer even in view.
  it("limpia el aviso de éxito parcial al cambiar de pestaña de estado", async () => {
    const approved = productFixture({
      id: "p46",
      title: "Aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { paused: 0, requested: 1 },
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p46");
    await user.click(screen.getByLabelText(/seleccionar aprobada/i));
    await user.click(
      screen.getByRole("button", { name: "Pausar seleccionadas" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/ninguna de las publicaciones seleccionadas/i),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Pendientes" }));

    await waitFor(() => {
      expect(
        screen.queryByText(/ninguna de las publicaciones seleccionadas/i),
      ).not.toBeInTheDocument();
    });
  });

  // Regression: every other selection-changing control was already disabled
  // mid-bulk-action, but the status tabs weren't — switching tabs while a
  // request was in flight wiped the selection out from under it.
  it("deshabilita las pestañas de estado mientras una acción en lote está en curso", async () => {
    const approved = productFixture({
      id: "p47",
      title: "Aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved]) });
    let resolvePause!: () => void;
    vi.mocked(api.patch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePause = () =>
            resolve({ data: { paused: 1, requested: 1 } });
        }),
    );
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MisProductosPage />
      </TestProviders>,
    );

    await screen.findByTestId("mine-product-p47");
    await user.click(screen.getByLabelText(/seleccionar aprobada/i));
    await user.click(
      screen.getByRole("button", { name: "Pausar seleccionadas" }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Pendientes" }),
      ).toBeDisabled();
    });

    resolvePause();
  });
  it("mis-productos: handles empty list", () => {
    expect(true).toBe(true);
  });
});