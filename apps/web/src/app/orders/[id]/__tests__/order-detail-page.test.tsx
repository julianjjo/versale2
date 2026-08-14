import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrderDetailPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useParams: () => ({ id: "order1" }),
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const authState: {
  user: null | { id: string; email: string; name: string; role: "USER" | "ADMIN" };
  isLoading: boolean;
} = {
  user: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
  isLoading: false,
};

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => authState,
  };
});

const mockOrder = {
  id: "order1",
  userId: "u1",
  status: "PENDING" as const,
  totalAmount: 50000,
  shippingAddress: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  items: [{ id: "oi1", productId: "p1", quantity: 1, price: 50000 }],
};

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    patch: vi.fn(),
  },
  extractApiError: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

import { api } from "@/lib/api";

describe("OrderDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    authState.isLoading = false;
  });

  it("renderiza el detalle del pedido", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockOrder });
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("#order1")).toBeInTheDocument();
    });
  });

  // Regression: un 404 real (el pedido no existe) mostraba "Pedido no
  // encontrado", el comportamiento correcto para ese caso.
  it("muestra 'Pedido no encontrado' cuando el pedido no existe (404)", async () => {
    vi.mocked(api.get).mockRejectedValue(
      Object.assign(new Error("Not found"), { response: { status: 404 } }),
    );
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/pedido no encontrado/i)).toBeInTheDocument();
    });
  });

  // Regression: un 403 (el pedido existe pero es de otra persona) debe caer
  // en el mismo "Pedido no encontrado" que un 404, para no revelarle a quien
  // no tiene acceso que el pedido sí existe.
  it("muestra 'Pedido no encontrado' cuando el pedido es de otra persona (403), sin distinguirlo de un 404", async () => {
    vi.mocked(api.get).mockRejectedValue(
      Object.assign(new Error("Forbidden"), { response: { status: 403 } }),
    );
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/pedido no encontrado/i)).toBeInTheDocument();
    });
  });

  // Regression: antes CUALQUIER fallo de la consulta (red, timeout, 5xx)
  // caía en "Pedido no encontrado" sin posibilidad de reintentar, igual que
  // un 404 real. Un fallo transitorio debe ofrecer reintentar en vez de un
  // mensaje terminal.
  it("ofrece reintentar cuando la carga falla por un error temporal, en vez de decir que no existe", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network Error"));
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no pudimos cargar el pedido/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("button", { name: /reintentar/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/pedido no encontrado/i)).not.toBeInTheDocument();
  });

  it("recupera el pedido al reintentar después de un error transitorio", async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockResolvedValueOnce({ data: mockOrder });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no pudimos cargar el pedido/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() => {
      expect(screen.getByText("#order1")).toBeInTheDocument();
    });
  });

  it("pide iniciar sesión si no está autenticado", async () => {
    authState.user = null;
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );
    expect(screen.getByText(/inicia sesión/i)).toBeInTheDocument();
  });

  it("ofrece Cancelar pedido cuando está pendiente", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockOrder });
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    expect(
      await screen.findByRole("button", { name: /cancelar pedido/i }),
    ).toBeInTheDocument();
  });

  it("ofrece Cancelar pedido cuando ya está pagado, porque todavía no se envió", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...mockOrder, status: "PAID" },
    });
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    expect(
      await screen.findByRole("button", { name: /cancelar pedido/i }),
    ).toBeInTheDocument();
  });

  it("no ofrece Cancelar pedido una vez enviado", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...mockOrder, status: "SHIPPED" },
    });
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    await screen.findByText("#order1");
    expect(
      screen.queryByRole("button", { name: /cancelar pedido/i }),
    ).not.toBeInTheDocument();
  });

  it("no ofrece Cancelar pedido para un pedido ya cancelado", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...mockOrder, status: "CANCELLED" },
    });
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    await screen.findByText("#order1");
    expect(
      screen.queryByRole("button", { name: /cancelar pedido/i }),
    ).not.toBeInTheDocument();
  });

  it("cancela el pedido tras confirmar", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockOrder });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    try {
      const cancelButton = await screen.findByRole("button", {
        name: /cancelar pedido/i,
      });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith("/orders/order1/cancel");
      });
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("confirma la cancelación con un mensaje accesible una vez que el pedido queda cancelado", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockOrder })
      .mockResolvedValue({ data: { ...mockOrder, status: "CANCELLED" } });
    vi.mocked(api.patch).mockResolvedValue({ data: { success: true } });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    try {
      const cancelButton = await screen.findByRole("button", {
        name: /cancelar pedido/i,
      });
      await user.click(cancelButton);

      // The confirmation has to survive the button's own unmount: `canCancel`
      // flips to false the moment the refetch reports CANCELLED, and that's
      // exactly the render where a screen-reader user needs to hear the
      // outcome of the click they just made.
      expect(await screen.findByRole("status")).toHaveTextContent(
        /pedido cancelado/i,
      );
      expect(
        screen.queryByRole("button", { name: /cancelar pedido/i }),
      ).not.toBeInTheDocument();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("refresca el pedido cuando la cancelación falla por un conflicto de estado", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: mockOrder })
      .mockResolvedValue({ data: { ...mockOrder, status: "SHIPPED" } });
    vi.mocked(api.patch).mockRejectedValue(
      Object.assign(new Error("Este pedido cambió de estado"), {
        response: { status: 400 },
      }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    try {
      const cancelButton = await screen.findByRole("button", {
        name: /cancelar pedido/i,
      });
      await user.click(cancelButton);

      await screen.findByText("Este pedido cambió de estado");
      // The badge now reflects the real (post-conflict) status, and the
      // button that just failed correctly stops offering the same action.
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: /cancelar pedido/i }),
        ).not.toBeInTheDocument();
      });
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("no cancela el pedido si el usuario no confirma el diálogo", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockOrder });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    try {
      const cancelButton = await screen.findByRole("button", {
        name: /cancelar pedido/i,
      });
      await user.click(cancelButton);

      expect(api.patch).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("muestra un error si la cancelación falla en el servidor", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockOrder });
    vi.mocked(api.patch).mockRejectedValue(
      Object.assign(new Error("Ya fue enviado"), { response: { status: 400 } }),
    );
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    try {
      const cancelButton = await screen.findByRole("button", {
        name: /cancelar pedido/i,
      });
      await user.click(cancelButton);

      expect(await screen.findByText("Ya fue enviado")).toBeInTheDocument();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("no ofrece Cancelar pedido cuando el pedido visto es de otra persona", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: { ...mockOrder, userId: "otherUser" },
    });
    render(
      <TestProviders>
        <OrderDetailPage />
      </TestProviders>,
    );

    await screen.findByText("#order1");
    expect(
      screen.queryByRole("button", { name: /cancelar pedido/i }),
    ).not.toBeInTheDocument();
  });
});
