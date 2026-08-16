import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminReportsPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";
import type { ProductReport } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
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

  it("muestra el listado de reportes con el producto y el motivo", async () => {
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
    expect(api.get).toHaveBeenCalledWith("/reports/admin/all?page=1&limit=20");
  });

  it("muestra un estado vacío cuando no hay reportes", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse([]) });

    render(
      <TestProviders>
        <AdminReportsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("No hay reportes")).toBeInTheDocument();
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
    expect(screen.queryByText("No hay reportes")).not.toBeInTheDocument();
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
        "/reports/admin/all?page=2&limit=20",
      );
    });
  });

  it("descarta un reporte tras confirmar", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reportsFixture()),
    });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
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
      expect(api.delete).toHaveBeenCalledWith("/reports/report1");
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

    expect(api.delete).not.toHaveBeenCalled();
  });

  it("muestra un error cuando falla al descartar un reporte", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reportsFixture()),
    });
    vi.mocked(api.delete).mockRejectedValue(new Error("Este reporte ya no existe"));
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
      /este reporte ya no existe/i,
    );
  });
});
