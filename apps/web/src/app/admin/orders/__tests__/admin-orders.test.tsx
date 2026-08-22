import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminOrdersPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";
import type { Order, OrderStatus } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
  extractApiError: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
  // Mirrors the real extractBlobApiError's shape closely enough to exercise
  // handleExportCsv's error path: read a Blob-typed response.data as JSON
  // before falling back, same as the real implementation does.
  extractBlobApiError: async (err: unknown, fallback: string) => {
    const response = (err as { response?: { data?: unknown } })?.response;
    if (response?.data instanceof Blob) {
      try {
        const parsed = JSON.parse(await response.data.text()) as {
          message?: string;
        };
        if (parsed?.message) return parsed.message;
      } catch {
        // fall through
      }
    }
    return err instanceof Error ? err.message : fallback;
  },
}));

import { api } from "@/lib/api";

function orderFixture(id: string, status: OrderStatus = "PENDING"): Order {
  return {
    id,
    userId: "u1",
    status,
    totalAmount: 120000,
    shippingAddress: {},
    createdAt: new Date("2026-01-10T10:00:00Z").toISOString(),
    updatedAt: new Date("2026-01-10T10:00:00Z").toISOString(),
    items: [{ id: `${id}-i1`, productId: "p1", quantity: 1, price: 120000 }],
    user: { id: "u1", name: "Ana Gómez", email: "ana@versale.co" },
  };
}

function paginated(orders: Order[]) {
  return { data: orders, meta: { total: orders.length, page: 1, pages: 1 } };
}

describe("AdminOrdersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no desmonta el buscador al escribir: conserva foco, valor y cursor", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([orderFixture("aaaaaaaa1")]),
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminOrdersPage />
      </TestProviders>,
    );

    await screen.findByText(/Pedido #aaaaaaaa/, undefined, { timeout: 5000 });

    const input = screen.getByRole("searchbox", { name: "Buscar pedidos" });
    await user.click(input);
    await user.type(input, "ana");

    // El término debounced dispara una queryKey nueva (sin caché).
    await waitFor(
      () => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining("search=ana"),
        );
      },
      { timeout: 5000 },
    );

    const inputAfter = screen.getByRole("searchbox", { name: "Buscar pedidos" });
    expect(inputAfter).toBe(input);
    expect(inputAfter).toHaveFocus();
    expect(inputAfter).toHaveValue("ana");
  });

  it("informa el resultado parcial, conserva los fallidos y refresca la lista", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([orderFixture("aaaaaaaa1"), orderFixture("bbbbbbbb2")]),
    });
    vi.mocked(api.patch)
      .mockResolvedValueOnce({ data: {} })
      .mockRejectedValueOnce(new Error("500"));
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminOrdersPage />
      </TestProviders>,
    );

    await screen.findByText(/Pedido #aaaaaaaa/, undefined, { timeout: 5000 });
    const getCallsBefore = vi.mocked(api.get).mock.calls.length;

    await user.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todos los pedidos visibles",
      }),
    );
    await screen.findByText("2 pedidos seleccionados", undefined, {
      timeout: 5000,
    });

    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Nuevo estado para los pedidos seleccionados",
      }),
      "PAID",
    );
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    await waitFor(
      () => {
        expect(api.patch).toHaveBeenCalledTimes(2);
      },
      { timeout: 5000 },
    );
    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "Actualizamos 1 de 2 pedidos. 1 quedó sin actualizar y sigue seleccionado.",
        );
      },
      { timeout: 5000 },
    );

    // El pedido que falló sigue seleccionado para poder reintentar.
    expect(screen.getByText("1 pedido seleccionado")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar pedido bbbbbbbb" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar pedido aaaaaaaa" }),
    ).not.toBeChecked();

    // La lista se recarga aunque una de las escrituras haya fallado.
    await waitFor(
      () => {
        expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThan(
          getCallsBefore,
        );
      },
      { timeout: 5000 },
    );
  });

  it("descarga el CSV de pedidos con el término de búsqueda actual", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.startsWith("/orders/admin/export")) {
        return { data: new Blob(["ID,Comprador"], { type: "text/csv" }) };
      }
      return { data: paginated([orderFixture("aaaaaaaa1")]) };
    });
    // jsdom no implementa la API real de Blob URLs — solo verificamos que se
    // invoque, no el manejo del archivo en sí (fuera del alcance de un test
    // de componente).
    const createObjectURL = vi.fn().mockReturnValue("blob:mock");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminOrdersPage />
      </TestProviders>,
    );

    await screen.findByText(/Pedido #aaaaaaaa/, undefined, { timeout: 5000 });
    await user.click(screen.getByRole("button", { name: "Descargar CSV" }));

    try {
      await waitFor(() => {
        expect(api.get).toHaveBeenCalledWith(
          "/orders/admin/export?search=",
          { responseType: "blob" },
        );
      });
      expect(createObjectURL).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      // Revoking is deferred a tick (guards against Safari's create→click→
      // immediate-revoke download race), so this needs waitFor too.
      await waitFor(() => {
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
      });
    } finally {
      clickSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("muestra el mensaje real del backend cuando la exportación a CSV falla", async () => {
    // A `responseType: "blob"` request also decodes its ERROR body as a
    // Blob, not parsed JSON — this reconstructs that shape to prove the
    // real backend message (not just a generic fallback) reaches the user.
    const errorBody = new Blob(
      [JSON.stringify({ message: "No tienes autorización" })],
      { type: "application/json" },
    );
    const blobError = Object.assign(new Error("Request failed"), {
      response: { data: errorBody },
    });
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.startsWith("/orders/admin/export")) {
        throw blobError;
      }
      return { data: paginated([orderFixture("aaaaaaaa1")]) };
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminOrdersPage />
      </TestProviders>,
    );

    await screen.findByText(/Pedido #aaaaaaaa/, undefined, { timeout: 5000 });
    await user.click(screen.getByRole("button", { name: "Descargar CSV" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No tienes autorización",
      );
    });
  });

  it("cae al mensaje genérico si la exportación falla sin un cuerpo de error legible", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (typeof url === "string" && url.startsWith("/orders/admin/export")) {
        throw new Error("Network Error");
      }
      return { data: paginated([orderFixture("aaaaaaaa1")]) };
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminOrdersPage />
      </TestProviders>,
    );

    await screen.findByText(/Pedido #aaaaaaaa/, undefined, { timeout: 5000 });
    await user.click(screen.getByRole("button", { name: "Descargar CSV" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network Error");
    });
  });

  it("pide confirmación antes de cancelar un pedido desde el selector por fila, y respeta un 'Cancelar' del admin", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([orderFixture("aaaaaaaa1", "PAID")]),
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminOrdersPage />
      </TestProviders>,
    );

    await screen.findByText(/Pedido #aaaaaaaa/, undefined, { timeout: 5000 });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Estado del pedido" }),
      "CANCELLED",
    );

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("no se puede deshacer"),
    );
    // El admin dijo que no: la cancelación (que relista la prenda y avisa a
    // comprador/vendedor) nunca debe dispararse.
    expect(api.patch).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("aplica el cambio de estado por fila cuando el admin confirma", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([orderFixture("aaaaaaaa1", "PAID")]),
    });
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminOrdersPage />
      </TestProviders>,
    );

    await screen.findByText(/Pedido #aaaaaaaa/, undefined, { timeout: 5000 });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Estado del pedido" }),
      "CANCELLED",
    );

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/orders/admin/aaaaaaaa1/status", {
        status: "CANCELLED",
      });
    });

    confirmSpy.mockRestore();
  });

  it("no pide confirmación para una transición reversible como PAID → SHIPPED", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([orderFixture("aaaaaaaa1", "PAID")]),
    });
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminOrdersPage />
      </TestProviders>,
    );

    await screen.findByText(/Pedido #aaaaaaaa/, undefined, { timeout: 5000 });
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Estado del pedido" }),
      "SHIPPED",
    );

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/orders/admin/aaaaaaaa1/status", {
        status: "SHIPPED",
      });
    });

    confirmSpy.mockRestore();
  });

  it("pide confirmación antes de reembolsar en lote, y respeta un 'Cancelar' del admin", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginated([orderFixture("aaaaaaaa1", "PAID")]),
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminOrdersPage />
      </TestProviders>,
    );

    await screen.findByText(/Pedido #aaaaaaaa/, undefined, { timeout: 5000 });
    await user.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todos los pedidos visibles",
      }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", {
        name: "Nuevo estado para los pedidos seleccionados",
      }),
      "REFUNDED",
    );
    await user.click(screen.getByRole("button", { name: "Aplicar" }));

    expect(confirmSpy).toHaveBeenCalledWith(
      expect.stringContaining("no se puede deshacer"),
    );
    expect(api.patch).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });
});
