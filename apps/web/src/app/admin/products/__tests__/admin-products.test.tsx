import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminProductsPage from "../page";
import { TestProviders, createTestQueryClient } from "@/test-utils/TestProviders";
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
    status: "AVAILABLE",
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

  // Regression: pausedAt is independent of isApproved/rejectedAt, so an admin
  // approving/rejecting a paused listing previously had no indication it
  // still wouldn't show up in the catalog either way.
  it("muestra que una publicación aprobada fue pausada por el vendedor", async () => {
    const pausedApproved = productFixture({
      id: "p9",
      title: "Falda pausada",
      isApproved: true,
      pausedAt: new Date("2026-02-10T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pausedApproved]) });
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("admin-product-p9");
    expect(within(card).getByText("Aprobado")).toBeInTheDocument();
    expect(
      within(card).getByText("Pausado por el vendedor"),
    ).toBeInTheDocument();
  });

  it("no muestra Rechazar para una publicación aprobada y ya vendida", async () => {
    const sold = productFixture({
      id: "p3",
      title: "Abrigo vendido",
      isApproved: true,
      status: "SOLD",
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

  // Item 6: un rechazo silencioso es un vendedor perdido — el motivo que el
  // PATCH guardó debe ser visible en la grilla, no solo persistido.
  it("expone el motivo del rechazo guardado por el PATCH", async () => {
    const rejected = productFixture({
      id: "p5",
      title: "Camisa rechazada con motivo",
      isApproved: false,
      rejectedAt: new Date("2026-01-15T10:00:00Z").toISOString(),
      rejectionReason: "Las fotos no muestran bien el producto",
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([rejected]) });
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("admin-product-p5");
    expect(
      within(card).getByText(/motivo del rechazo/i),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(/las fotos no muestran bien el producto/i),
    ).toBeInTheDocument();
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
      status: "SOLD",
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

  it("ofrece la casilla de selección para una publicación pendiente y para una rechazada, pero no para una vendida", async () => {
    const pending = productFixture({ id: "p20", title: "Pendiente" });
    const rejected = productFixture({
      id: "p21",
      title: "Rechazada",
      rejectedAt: new Date("2026-01-15T10:00:00Z").toISOString(),
    });
    const sold = productFixture({
      id: "p22",
      title: "Vendida",
      isApproved: true,
      status: "SOLD",
    });
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([pending, rejected, sold]),
    });
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    const pendingCard = await screen.findByTestId("admin-product-p20");
    const rejectedCard = screen.getByTestId("admin-product-p21");
    const soldCard = screen.getByTestId("admin-product-p22");

    expect(
      within(pendingCard).getByLabelText(/seleccionar pendiente/i),
    ).toBeInTheDocument();
    expect(
      within(rejectedCard).getByLabelText(/seleccionar rechazada/i),
    ).toBeInTheDocument();
    expect(
      within(soldCard).queryByLabelText(/seleccionar vendida/i),
    ).not.toBeInTheDocument();
  });

  // Regression: a currently-approved (not sold) listing can be part of a
  // bulk-reject batch even though it can't be part of a bulk-approve one —
  // the checkbox has to appear whenever either bulk action applies.
  it("ofrece la casilla de selección para una publicación aprobada y no vendida", async () => {
    const approved = productFixture({
      id: "p23",
      title: "Aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved]) });
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("admin-product-p23");
    expect(within(card).getByLabelText(/seleccionar aprobada/i)).toBeInTheDocument();
  });

  // Regression: the bulk-selection checkbox is shared by both actions
  // (isBulkSelectable), so a moderator on the "Aprobados" tab who selects
  // every eligible (reject-only) row must not be able to fire "Aprobar
  // seleccionadas" at all — every prior version silently no-opped 100% of
  // the batch instead.
  it("deshabilita Aprobar seleccionadas cuando ninguna seleccionada es aprobable", async () => {
    const approved = productFixture({
      id: "p24",
      title: "Aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([approved]) });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p24");
    await user.click(screen.getByLabelText(/seleccionar aprobada/i));

    expect(
      screen.getByRole("button", { name: "Aprobar seleccionadas" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Rechazar seleccionadas" }),
    ).toBeEnabled();
  });

  // Symmetric case: a "Rechazados" tab full of already-rejected rows is
  // approve-only-eligible (re-approval), so "Rechazar seleccionadas" must be
  // disabled for that same reason.
  it("deshabilita Rechazar seleccionadas cuando ninguna seleccionada es rechazable", async () => {
    const rejected = productFixture({
      id: "p25",
      title: "Rechazada",
      rejectedAt: new Date("2026-01-15T10:00:00Z").toISOString(),
    });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([rejected]) });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p25");
    await user.click(screen.getByLabelText(/seleccionar rechazada/i));

    expect(
      screen.getByRole("button", { name: "Rechazar seleccionadas" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Aprobar seleccionadas" }),
    ).toBeEnabled();
  });

  // A mixed selection (one row eligible for each action) must leave both
  // buttons enabled and submit successfully.
  it("mantiene ambos botones habilitados con una selección mixta y rechaza en lote solo las elegibles", async () => {
    const pending = productFixture({ id: "p26", title: "Pendiente" });
    const approved = productFixture({
      id: "p27",
      title: "Aprobada",
      isApproved: true,
    });
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([pending, approved]),
    });
    vi.mocked(api.patch).mockResolvedValue({
      data: { rejected: 2, requested: 2 },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p26");
    await user.click(screen.getByLabelText(/seleccionar pendiente/i));
    await user.click(screen.getByLabelText(/seleccionar aprobada/i));

    expect(
      screen.getByRole("button", { name: "Aprobar seleccionadas" }),
    ).toBeEnabled();
    const rejectButton = screen.getByRole("button", {
      name: "Rechazar seleccionadas",
    });
    expect(rejectButton).toBeEnabled();

    await user.click(rejectButton);
    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Rechazar seleccionadas" }),
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/admin/bulk-reject", {
        ids: ["p26", "p27"],
        reason: undefined,
      });
    });
  });

  it("aprueba en lote las publicaciones seleccionadas", async () => {
    const first = productFixture({ id: "p30", title: "Primera pendiente" });
    const second = productFixture({ id: "p31", title: "Segunda pendiente" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first, second]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { approved: 2, requested: 2 },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p30");
    await user.click(screen.getByLabelText(/seleccionar primera pendiente/i));
    await user.click(screen.getByLabelText(/seleccionar segunda pendiente/i));

    expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Aprobar seleccionadas" }),
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/admin/bulk-approve", {
        ids: ["p30", "p31"],
      });
    });
    // The selection bar and its checkboxes clear once the batch succeeds.
    await waitFor(() => {
      expect(screen.queryByText(/seleccionadas$/)).not.toBeInTheDocument();
    });
  });

  it("selecciona todas las elegibles de la página con la casilla general", async () => {
    const first = productFixture({ id: "p32", title: "Uno" });
    const second = productFixture({ id: "p33", title: "Dos" });
    const sold = productFixture({
      id: "p34",
      title: "Tres vendida",
      isApproved: true,
      status: "SOLD",
    });
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([first, second, sold]),
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p32");
    await user.click(
      screen.getByLabelText(/seleccionar todas las elegibles en esta página/i),
    );

    expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();
    expect(screen.getByLabelText(/seleccionar uno/i)).toBeChecked();
    expect(screen.getByLabelText(/seleccionar dos/i)).toBeChecked();
  });

  // The message doesn't blame a specific cause (sold, deleted, already
  // handled by another admin) — the API's compare-and-swap can't tell those
  // apart, so the UI only reports the effect.
  it("muestra un aviso, no un error, cuando algunas seleccionadas ya no se pudieron aprobar", async () => {
    const first = productFixture({ id: "p40", title: "Chaqueta" });
    const second = productFixture({ id: "p41", title: "Camiseta" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first, second]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { approved: 1, requested: 2 },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p40");
    await user.click(
      screen.getByLabelText(/seleccionar todas las elegibles en esta página/i),
    );
    await user.click(
      screen.getByRole("button", { name: "Aprobar seleccionadas" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /se aprobaron 1 de 2 publicaciones\. las demás ya no estaban disponibles para aprobar\./i,
        ),
      ).toBeInTheDocument();
    });
    // It's an informational notice, not styled or announced as an error.
    expect(
      screen.getByText(/se aprobaron 1 de 2/i).closest('[role="status"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // Regression: an all-or-nothing shortfall ("0 de N") used to reuse the
  // partial-shortfall wording ("Se aprobaron 0 de N... Las demás ya no
  // estaban disponibles"), which reads like a race that spared some of the
  // batch when actually none of it went through (e.g. the one selected item
  // was sold or otherwise resolved between page load and the click).
  it("usa un aviso distinto cuando ninguna de las seleccionadas se pudo aprobar", async () => {
    const only = productFixture({ id: "p42", title: "Bufanda" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([only]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { approved: 0, requested: 1 },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p42");
    await user.click(screen.getByLabelText(/seleccionar bufanda/i));
    await user.click(
      screen.getByRole("button", { name: "Aprobar seleccionadas" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /ninguna de las publicaciones seleccionadas estaba disponible para aprobar\./i,
        ),
      ).toBeInTheDocument();
    });
  });

  it("distingue publicaciones con el mismo título en la casilla de selección", async () => {
    const first = productFixture({ id: "aaaaaaaa-1", title: "Camiseta" });
    const second = productFixture({ id: "bbbbbbbb-2", title: "Camiseta" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first, second]) });
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-aaaaaaaa-1");

    expect(
      within(screen.getByTestId("admin-product-aaaaaaaa-1")).getByLabelText(
        "Seleccionar Camiseta (#aaaaaaaa)",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("admin-product-bbbbbbbb-2")).getByLabelText(
        "Seleccionar Camiseta (#bbbbbbbb)",
      ),
    ).toBeInTheDocument();
  });

  it("descarta la selección de una publicación que se aprobó individualmente", async () => {
    const first = productFixture({ id: "p45", title: "Uno" });
    const second = productFixture({ id: "p46", title: "Dos" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first, second]) });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p45");
    await user.click(screen.getByLabelText(/seleccionar uno/i));
    await user.click(screen.getByLabelText(/seleccionar dos/i));
    expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();

    // The per-row "Aprobar" button, not the bulk action bar.
    await user.click(
      within(screen.getByTestId("admin-product-p45")).getByRole("button", {
        name: "Aprobar",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("1 seleccionada")).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/seleccionar dos/i)).toBeChecked();
  });

  // The whole reason selection isn't page-scoped: an admin should be able to
  // pick eligible rows across several pages, then approve them all together.
  it("mantiene la selección entre páginas y envía la unión al aprobar en lote", async () => {
    const pageOneProduct = productFixture({ id: "p60", title: "Página uno" });
    const pageTwoProduct = productFixture({ id: "p61", title: "Página dos" });
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const page = new URLSearchParams(url.split("?")[1]).get("page");
      if (page === "2") {
        return {
          data: { data: [pageTwoProduct], meta: { total: 2, page: 2, pages: 2 } },
        };
      }
      return {
        data: { data: [pageOneProduct], meta: { total: 2, page: 1, pages: 2 } },
      };
    });
    vi.mocked(api.patch).mockResolvedValue({
      data: { approved: 2, requested: 2 },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p60");
    await user.click(screen.getByLabelText(/seleccionar página uno/i));

    await user.click(screen.getByRole("button", { name: /siguiente/i }));
    await screen.findByTestId("admin-product-p61");
    expect(screen.getByText("1 seleccionada")).toBeInTheDocument();

    await user.click(screen.getByLabelText(/seleccionar página dos/i));
    expect(screen.getByText("2 seleccionadas")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Aprobar seleccionadas" }),
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/admin/bulk-approve", {
        ids: ["p60", "p61"],
      });
    });
  });

  it("rechaza en lote las publicaciones seleccionadas con un motivo compartido", async () => {
    const first = productFixture({ id: "p70", title: "Primera pendiente" });
    const second = productFixture({ id: "p71", title: "Segunda pendiente" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first, second]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { rejected: 2, requested: 2 },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p70");
    await user.click(screen.getByLabelText(/seleccionar primera pendiente/i));
    await user.click(screen.getByLabelText(/seleccionar segunda pendiente/i));

    await user.click(
      screen.getByRole("button", { name: "Rechazar seleccionadas" }),
    );

    const dialog = screen.getByRole("dialog");
    await user.type(
      within(dialog).getByLabelText(/motivo/i),
      "Fotos borrosas",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Rechazar seleccionadas" }),
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/products/admin/bulk-reject", {
        ids: ["p70", "p71"],
        reason: "Fotos borrosas",
      });
    });
    // The selection bar and its checkboxes clear once the batch succeeds,
    // and the modal closes.
    await waitFor(() => {
      expect(screen.queryByText(/seleccionadas$/)).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("cancela el rechazo en lote sin enviar la solicitud", async () => {
    const only = productFixture({ id: "p72", title: "Única" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([only]) });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p72");
    await user.click(screen.getByLabelText(/seleccionar única/i));
    await user.click(
      screen.getByRole("button", { name: "Rechazar seleccionadas" }),
    );

    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
    // The selection itself survives closing the modal — only the reason
    // draft and the dialog are discarded.
    expect(screen.getByText("1 seleccionada")).toBeInTheDocument();
  });

  // Same reasoning as bulkApprove's own shortfall notice: the API's
  // compare-and-swap can't say which selected ids were already sold,
  // deleted, or rejected by another admin.
  it("muestra un aviso, no un error, cuando algunas seleccionadas ya no se pudieron rechazar", async () => {
    const first = productFixture({ id: "p73", title: "Chaqueta" });
    const second = productFixture({ id: "p74", title: "Camiseta" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([first, second]) });
    vi.mocked(api.patch).mockResolvedValue({
      data: { rejected: 1, requested: 2 },
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p73");
    await user.click(
      screen.getByLabelText(/seleccionar todas las elegibles en esta página/i),
    );
    await user.click(
      screen.getByRole("button", { name: "Rechazar seleccionadas" }),
    );

    const dialog = screen.getByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Rechazar seleccionadas" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          /se rechazaron 1 de 2 publicaciones\. las demás ya no estaban disponibles para rechazar\./i,
        ),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/se rechazaron 1 de 2/i).closest('[role="status"]'),
    ).not.toBeNull();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("limpia la selección al cambiar de pestaña de estado", async () => {
    const pending = productFixture({ id: "p50", title: "Pendiente" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p50");
    await user.click(screen.getByLabelText(/seleccionar pendiente/i));
    expect(screen.getByText("1 seleccionada")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Rechazados" }));

    expect(screen.queryByText(/seleccionada$/)).not.toBeInTheDocument();
  });

  // Regression: deleting the last row on a page shrank `meta.pages` without
  // `page` following it down. Pager only clamps its own button clicks and
  // renders nothing once `pages <= 1`, so the admin was stuck looking at an
  // empty list with no control to get back to page 1.
  it("vuelve a la página 1 cuando una acción deja vacía la página actual", async () => {
    const pageOneProduct = productFixture({
      id: "p10",
      title: "Producto página 1",
    });
    const pageTwoProduct = productFixture({
      id: "p11",
      title: "Producto página 2",
    });
    let deleted = false;

    vi.mocked(api.get).mockImplementation(async (url: string) => {
      const page = new URLSearchParams(url.split("?")[1]).get("page");
      if (page === "2") {
        return {
          data: deleted
            ? { data: [], meta: { total: 1, page: 2, pages: 1 } }
            : { data: [pageTwoProduct], meta: { total: 2, page: 2, pages: 2 } },
        };
      }
      return {
        data: {
          data: [pageOneProduct],
          meta: { total: deleted ? 1 : 2, page: 1, pages: deleted ? 1 : 2 },
        },
      };
    });
    vi.mocked(api.delete).mockImplementation(async () => {
      deleted = true;
      return { data: { success: true } };
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminProductsPage />
      </TestProviders>,
    );

    await screen.findByTestId("admin-product-p10");
    await user.click(screen.getByRole("button", { name: /siguiente/i }));
    await screen.findByTestId("admin-product-p11");

    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => {
      expect(screen.getByTestId("admin-product-p10")).toBeInTheDocument();
    });
    expect(screen.queryByText(/página \d+ de/i)).not.toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  // Regression: invalidateProducts() only ever hit ["admin-products"] and
  // ["admin-products-pending-count"] — a near-miss of the /admin dashboard's
  // own differently-named ["admin-products-pending"] card, which never
  // refreshed after approving/rejecting here.
  it("invalida también la query del dashboard admin al aprobar una publicación", async () => {
    const pending = productFixture({ id: "p1", title: "Chaqueta pendiente" });
    vi.mocked(api.get).mockResolvedValue({ data: paginated([pending]) });
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    render(
      <TestProviders client={queryClient}>
        <AdminProductsPage />
      </TestProviders>,
    );

    const card = await screen.findByTestId("admin-product-p1");
    await user.click(within(card).getByRole("button", { name: "Aprobar" }));

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ["admin-products-pending"] }),
      );
    });
  });
});
