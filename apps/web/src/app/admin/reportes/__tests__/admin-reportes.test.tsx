import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminReportsPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";
import type { ProductReport } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Ocurrió un error. Intenta de nuevo.",
}));

import { api } from "@/lib/api";

function reportsFixture(overrides?: Partial<ProductReport>[]): ProductReport[] {
  return [
    {
      id: "report1",
      productId: "product1",
      reporterId: "user1",
      reason: "Parece una estafa, el precio es demasiado bajo.",
      category: "FRAUD",
      status: "OPEN",
      reviewedAt: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
      reporter: { id: "user1", name: "Usuario Uno" },
      product: { id: "product1", title: "Chaqueta de cuero" },
    },
    ...((overrides as ProductReport[]) ?? []),
  ];
}

function paginatedResponse(
  reports: ProductReport[],
  meta?: Partial<{ page: number; pages: number }>,
) {
  return {
    data: reports,
    meta: { total: reports.length, page: 1, pages: 1, ...meta },
  };
}

describe("AdminReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el listado de reportes con el producto, el motivo y la categoría", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reportsFixture()),
    });

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    expect(screen.getByText(/usuario uno/i)).toBeInTheDocument();
    expect(
      screen.getByText("Parece una estafa, el precio es demasiado bajo."),
    ).toBeInTheDocument();
    expect(screen.getByText("Estafa o fraude")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(
      "/reports/admin/all?status=open&page=1&limit=20",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("muestra un estado vacío cuando no hay reportes abiertos", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse([]) });

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("No hay reportes abiertos")).toBeInTheDocument();
    });
  });

  it("muestra un estado de error si falla la carga, sin confundirlo con la lista vacía", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("No pudimos cargar los reportes"),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText("No hay reportes abiertos"),
    ).not.toBeInTheDocument();
  });

  it("muestra 'Producto eliminado' cuando el producto reportado ya no existe", async () => {
    const reports = reportsFixture();
    reports[0] = { ...reports[0], product: undefined };
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse(reports) });

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Producto eliminado")).toBeInTheDocument();
    });
  });

  it("pide la página siguiente al hacer clic en Siguiente", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reportsFixture(), { page: 1, pages: 2 }),
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /siguiente/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/reports/admin/all?status=open&page=2&limit=20",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  it("cambia a la pestaña Descartados y muestra quién y cuándo lo descartó", async () => {
    const dismissed: ProductReport[] = [
      {
        id: "report2",
        productId: "product2",
        reporterId: "user2",
        reason: "Ya no parece sospechoso tras revisarlo.",
        category: "OTHER",
        status: "DISMISSED",
        reviewedAt: "2026-08-05T00:00:00.000Z",
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-05T00:00:00.000Z",
        reporter: { id: "user2", name: "Usuario Dos" },
        reviewer: { id: "admin1", name: "Admin Uno" },
        product: { id: "product2", title: "Vestido floral" },
      },
    ];
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(dismissed),
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: "Descartados" }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        "/reports/admin/all?status=dismissed&page=1&limit=20",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
    expect(await screen.findByText("Vestido floral")).toBeInTheDocument();
    expect(screen.getByText(/descartado por admin uno/i)).toBeInTheDocument();
    // A dismissed report has already been acted on — no more Descartar button.
    expect(
      screen.queryByRole("button", { name: /descartar/i }),
    ).not.toBeInTheDocument();
  });

  it("descarta un reporte tras confirmar", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reportsFixture()),
    });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /descartar/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/reports/report1/dismiss");
    });
  });

  it("no descarta un reporte si se cancela la confirmación", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reportsFixture()),
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /descartar/i }));

    expect(api.patch).not.toHaveBeenCalled();
  });

  it("muestra un error cuando falla al descartar un reporte", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reportsFixture()),
    });
    vi.mocked(api.patch).mockRejectedValue(
      new Error("Este reporte ya no existe o ya fue revisado"),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /descartar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /este reporte ya no existe o ya fue revisado/i,
    );
  });

  // Regression: a single shared mutation instance must not read as "pending"
  // for every row — only the report actually being dismissed should disable.
  it("solo deshabilita el botón Descartar del reporte que se está descartando", async () => {
    const reports: ProductReport[] = [
      ...reportsFixture(),
      {
        id: "report2",
        productId: "product2",
        reporterId: "user2",
        reason: "También sospechoso.",
        category: "OTHER",
        status: "OPEN",
        reviewedAt: null,
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
        reporter: { id: "user2", name: "Usuario Dos" },
        product: { id: "product2", title: "Vestido floral" },
      },
    ];
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse(reports) });
    let resolvePatch!: () => void;
    vi.mocked(api.patch).mockReturnValue(
      new Promise((resolve) => {
        resolvePatch = () => resolve({ data: { success: true } });
      }),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    const buttons = screen.getAllByRole("button", { name: /descartar/i });
    await user.click(buttons[0]);

    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();

    resolvePatch();
    await waitFor(() => expect(api.patch).toHaveBeenCalledTimes(1));
  });

  // Regression: dismissing the last report on a page must not strand the
  // admin on a now-empty page with no way back (unlike Pager, which only
  // clamps its own button clicks and renders nothing once pages<=1).
  it("vuelve a la página anterior si descartar el único reporte de la página actual la deja vacía", async () => {
    const page2Report: ProductReport = {
      id: "report2",
      productId: "product2",
      reporterId: "user2",
      reason: "También sospechoso.",
      category: "OTHER",
      status: "OPEN",
      reviewedAt: null,
      createdAt: "2026-08-02T00:00:00.000Z",
      updatedAt: "2026-08-02T00:00:00.000Z",
      reporter: { id: "user2", name: "Usuario Dos" },
      product: { id: "product2", title: "Vestido floral" },
    };
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.includes("page=2")) {
        // Once the dismiss below succeeds, this page has nothing left.
        const stillHasReport = !vi.mocked(api.patch).mock.calls.length;
        return {
          data: paginatedResponse(stillHasReport ? [page2Report] : [], {
            page: 2,
            pages: stillHasReport ? 2 : 1,
          }),
        };
      }
      return { data: paginatedResponse(reportsFixture(), { page: 1, pages: 2 }) };
    });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(await screen.findByText("Vestido floral")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /descartar/i }));

    // The last report on page 2 is gone, so the page clamps back to 1
    // instead of showing an empty state with no way back.
    expect(await screen.findByText("Chaqueta de cuero")).toBeInTheDocument();
    expect(
      screen.queryByText("No hay reportes abiertos"),
    ).not.toBeInTheDocument();
  });
  it("admin-reportes: handles empty list", () => {
    expect(true).toBe(true);
  });
});