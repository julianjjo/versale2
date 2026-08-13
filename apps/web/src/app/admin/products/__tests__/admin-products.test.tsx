import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminProductsPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";
import type { Product } from "@/lib/types";

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
    sellerId: "s1",
    isApproved: false,
    rejectedAt: null,
    soldAt: null,
    rejectionReason: null,
    createdAt: new Date("2026-01-10T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-10T10:00:00Z").toISOString(),
    images: null,
    seller: { id: "s1", name: "Ana Gómez" },
    ...overrides,
  };
}

function paginated(products: Product[]) {
  return {
    data: products,
    meta: { total: products.length, page: 1, pages: 1 },
  };
}

describe("AdminProductsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra Rechazar para una publicación pendiente", async () => {
    const pending = productFixture({ id: "p1", title: "Chaqueta pendiente" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("admin-product-p1");
    expect(
      within(card).getByRole("button", { name: "Rechazar" }),
    ).toBeInTheDocument();
  });

  // FIX-10: antes "Rechazar" solo aparecía en publicaciones pendientes; una ya
  // aprobada solo tenía "Eliminar", que además borra reseñas/pedidos y no es
  // la herramienta correcta para bajar una publicación del catálogo.
  it("muestra Rechazar para una publicación aprobada y no vendida", async () => {
    const approved = productFixture({
      id: "p2",
      title: "Vestido aprobado",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved]) });
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("admin-product-p2");
    expect(
      within(card).getByRole("button", { name: "Rechazar" }),
    ).toBeInTheDocument();
  });

  it("no muestra Rechazar para una publicación aprobada y ya vendida", async () => {
    const sold = productFixture({
      id: "p3",
      title: "Abrigo vendido",
      isApproved: true,
      soldAt: new Date("2026-02-01T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([sold]) });
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("admin-product-p3");
    expect(
      within(card).queryByRole("button", { name: "Rechazar" }),
    ).not.toBeInTheDocument();
  });

  it("no muestra Rechazar para una publicación ya rechazada", async () => {
    const rejected = productFixture({
      id: "p4",
      title: "Camisa rechazada",
      isApproved: false,
      rejectedAt: new Date("2026-01-15T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([rejected]) });
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("admin-product-p4");
    expect(
      within(card).queryByRole("button", { name: "Rechazar" }),
    ).not.toBeInTheDocument();
  });

  // The API already refuses to approve a sold product; the button shouldn't
  // be offered for one either. Covers a rejected-and-sold row, the state a
  // stale-race approve/reject click against a sold product would leave.
  it("no muestra Aprobar para una publicación rechazada y ya vendida", async () => {
    const rejectedAndSold = productFixture({
      id: "p6",
      title: "Bufanda vendida",
      isApproved: false,
      rejectedAt: new Date("2026-01-15T10:00:00Z").toISOString(),
      soldAt: new Date("2026-02-01T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([rejectedAndSold]),
    });
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("admin-product-p6");
    expect(
      within(card).queryByRole("button", { name: "Aprobar" }),
    ).not.toBeInTheDocument();
  });

  it("reutiliza el mismo diálogo para rechazar una publicación ya aprobada", async () => {
    const approved = productFixture({
      id: "p5",
      title: "Falda aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved]) });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("admin-product-p5");
    await user.click(within(card).getByRole("button", { name: "Rechazar" }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", {
        name: /rechazar "falda aprobada"/i,
      }),
    ).toBeInTheDocument();

    await user.type(
      within(dialog).getByLabelText(/motivo/i),
      "Las fotos no muestran bien el producto",
    );
    await user.click(within(dialog).getByRole("button", { name: "Rechazar" }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/admin/p5/reject", {
        reason: "Las fotos no muestran bien el producto",
      });
    });
  });
});
