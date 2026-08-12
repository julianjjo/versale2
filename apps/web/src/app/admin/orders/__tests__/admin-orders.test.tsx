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
});
