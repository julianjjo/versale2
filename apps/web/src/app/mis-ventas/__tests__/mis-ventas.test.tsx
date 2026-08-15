import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MisVentasPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useParams: () => ({}),
}));

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
};

const authState: {
  user: AuthUser | null;
  isLoading: boolean;
  login: () => Promise<void>;
  signup: () => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
} = {
  user: { id: "seller1", email: "seller@b.c", name: "Seller", role: "USER" },
  isLoading: false,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  refresh: async () => {},
};

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => authState,
  };
});

function paginatedResponse(orders: unknown[]) {
  return {
    data: orders,
    meta: { total: orders.length, page: 1, pages: 1 },
  };
}

const paidOrder = {
  id: "order1",
  userId: "buyer1",
  status: "PAID" as const,
  totalAmount: 50,
  shippingAddress: { city: "Bogotá", state: "Cundinamarca" },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  user: { id: "buyer1", name: "Bruno" },
  items: [
    { id: "oi1", productId: "p1", quantity: 1, price: 50, product: { id: "p1", title: "Chaqueta" } },
  ],
};

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Ocurrió un error. Intenta de nuevo.",
}));

import { api } from "@/lib/api";

describe("MisVentasPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "seller1", email: "seller@b.c", name: "Seller", role: "USER" };
    authState.isLoading = false;
  });

  it("muestra las ventas del vendedor con el comprador y la dirección de envío", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse([paidOrder]) });
    render(
      <TestProviders>
        <MisVentasPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/pedido #order1/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/bruno/i)).toBeInTheDocument();
    expect(screen.getByText(/bogotá, cundinamarca/i)).toBeInTheDocument();
    expect(screen.getByText(/chaqueta/i)).toBeInTheDocument();
  });

  it("muestra un estado de error si falla la carga, sin confundirlo con la lista vacía", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));
    render(
      <TestProviders>
        <MisVentasPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no pudimos cargar tus ventas/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/aún no tienes ventas/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("muestra un estado vacío cuando no hay ventas", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse([]) });
    render(
      <TestProviders>
        <MisVentasPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/aún no tienes ventas/i)).toBeInTheDocument();
    });
  });

  it("marca un pedido pagado como enviado con un número de guía", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse([paidOrder]) });
    vi.mocked(api.patch).mockResolvedValue({ data: { id: "order1", status: "SHIPPED" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <MisVentasPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/pedido #order1/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/número de guía/i), "ABC123");
    await user.click(screen.getByRole("button", { name: /marcar como enviado/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/orders/mine/sales/order1/ship", {
        trackingNumber: "ABC123",
      });
    });
  });

  it("no ofrece marcar como enviado un pedido que ya no está en estado pagado", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse([{ ...paidOrder, status: "SHIPPED", trackingNumber: "XYZ" }]),
    });
    render(
      <TestProviders>
        <MisVentasPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/pedido #order1/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /marcar como enviado/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/xyz/i)).toBeInTheDocument();
  });

  it("muestra un mensaje de error si falla marcar como enviado", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse([paidOrder]) });
    vi.mocked(api.patch).mockRejectedValue(new Error("Pedido en estado inválido"));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <MisVentasPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/pedido #order1/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /marcar como enviado/i }));

    await waitFor(() => {
      expect(screen.getByText(/pedido en estado inválido/i)).toBeInTheDocument();
    });
  });

  it("pide al usuario iniciar sesión si no está autenticado", async () => {
    authState.user = null;
    const user = userEvent.setup();
    render(
      <TestProviders>
        <MisVentasPage />
      </TestProviders>,
    );
    expect(screen.getByText(/inicia sesión/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
