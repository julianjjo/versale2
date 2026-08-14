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
    soldAt: null,
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
    expect(within(card).getByText("Pendiente")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(
      "/products/mine?status=all&page=1&limit=20",
    );
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
      soldAt: new Date("2026-02-01T10:00:00Z").toISOString(),
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
});
