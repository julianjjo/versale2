import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrdersPage from "../page";
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
  user: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
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

const mockOrders = [
  {
    id: "order1",
    userId: "u1",
    status: "PENDING" as const,
    totalAmount: 100,
    shippingAddress: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: "oi1",
        productId: "p1",
        quantity: 2,
        price: 25,
        product: {
          id: "p1",
          title: "Chaqueta de jean vintage",
          images: ["https://example.com/jean.jpg"],
        },
      },
    ],
  },
];

function ordersResponse(orders: unknown[], meta?: Partial<Record<string, number>>) {
  return {
    data: {
      data: orders,
      meta: {
        total: orders.length,
        page: 1,
        limit: 10,
        pages: 1,
        ...meta,
      },
    },
  };
}

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from "@/lib/api";

describe("OrdersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    authState.isLoading = false;
  });

  it("renderiza el historial de pedidos con el producto y su imagen", async () => {
    vi.mocked(api.get).mockResolvedValue(ordersResponse(mockOrders));
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /historial de pedidos/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/pedido #order1/i)).toBeInTheDocument();
    expect(screen.getByText("Chaqueta de jean vintage")).toBeInTheDocument();
    expect(screen.getByAltText("Chaqueta de jean vintage")).toHaveAttribute(
      "src",
      "https://example.com/jean.jpg",
    );
  });

  it("indica cuántos productos más trae el pedido, además del primero", async () => {
    vi.mocked(api.get).mockResolvedValue(
      ordersResponse([
        {
          ...mockOrders[0],
          items: [
            ...mockOrders[0].items,
            {
              id: "oi2",
              productId: "p2",
              quantity: 1,
              price: 50,
              product: { id: "p2", title: "Suéter de lana", images: null },
            },
          ],
        },
      ]),
    );
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    expect(
      await screen.findByText(/chaqueta de jean vintage y 1 producto más/i),
    ).toBeInTheDocument();
  });

  it("muestra el número de guía cuando el pedido ya fue enviado", async () => {
    vi.mocked(api.get).mockResolvedValue(
      ordersResponse([
        { ...mockOrders[0], status: "SHIPPED", trackingNumber: "ABC123" },
      ]),
    );
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/guía: abc123/i)).toBeInTheDocument();
    });
  });

  it("no muestra la guía cuando el pedido no tiene una", async () => {
    vi.mocked(api.get).mockResolvedValue(ordersResponse(mockOrders));
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/pedido #order1/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/guía:/i)).not.toBeInTheDocument();
  });

  it("muestra un estado vacío cuando no hay pedidos", async () => {
    vi.mocked(api.get).mockResolvedValue(ordersResponse([]));
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/aún no tienes pedidos/i)).toBeInTheDocument();
    });
  });

  it("muestra un error cuando falla la carga, en vez de una lista vacía silenciosa", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no pudimos cargar tus pedidos/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/aún no tienes pedidos/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reintentar/i }),
    ).toBeInTheDocument();
  });

  it("recupera la lista al reintentar después de un error de carga", async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(ordersResponse(mockOrders));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no pudimos cargar tus pedidos/i),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() => {
      expect(screen.getByText(/pedido #order1/i)).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/no pudimos cargar tus pedidos/i),
    ).not.toBeInTheDocument();
  });

  it("pide al usuario iniciar sesión si no está autenticado", async () => {
    authState.user = null;
    const user = userEvent.setup();
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );
    expect(screen.getByText(/inicia sesión/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("busca pedidos por producto o ID, con el término en la URL", async () => {
    vi.mocked(api.get).mockResolvedValue(ordersResponse(mockOrders));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/pedido #order1/i)).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText(/buscar por producto o id de pedido/i),
      "chaqueta",
    );

    await waitFor(
      () => {
        expect(api.get).toHaveBeenCalledWith(
          expect.stringContaining("search=chaqueta"),
        );
      },
      { timeout: 1000 },
    );
  });

  it("filtra por estado y reinicia a la primera página", async () => {
    vi.mocked(api.get).mockResolvedValue(ordersResponse(mockOrders));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/pedido #order1/i)).toBeInTheDocument();
    });

    await user.selectOptions(
      screen.getByRole("combobox", { name: /filtrar por estado/i }),
      "DELIVERED",
    );

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("status=DELIVERED"),
      );
    });
  });

  it("distingue 'sin pedidos' de 'sin resultados para el filtro'", async () => {
    vi.mocked(api.get).mockResolvedValue(ordersResponse([]));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/aún no tienes pedidos/i)).toBeInTheDocument();
    });

    await user.type(
      screen.getByPlaceholderText(/buscar por producto o id de pedido/i),
      "algo que no existe",
    );

    await waitFor(
      () => {
        expect(
          screen.getByText(/ningún pedido coincide con tu búsqueda/i),
        ).toBeInTheDocument();
      },
      { timeout: 1000 },
    );
    expect(
      screen.queryByText(/aún no tienes pedidos/i),
    ).not.toBeInTheDocument();
  });

  it("muestra el paginador cuando hay más de una página", async () => {
    vi.mocked(api.get).mockResolvedValue(
      ordersResponse(mockOrders, { total: 25, pages: 3 }),
    );
    render(
      <TestProviders>
        <OrdersPage />
      </TestProviders>,
    );

    expect(
      await screen.findByText(/página 1 de 3/i),
    ).toBeInTheDocument();
  });
});
