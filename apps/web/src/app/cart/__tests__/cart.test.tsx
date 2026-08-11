import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartPage from "../page";
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

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const mockCart = {
  id: "cart1",
  userId: "u1",
  items: [
    {
      id: "ci1",
      cartId: "cart1",
      productId: "p1",
      quantity: 2,
      priceAtAdd: 25.0,
      product: {
        id: "p1",
        title: "Cotton t-shirt",
        description: "Soft cotton tee",
        category: "Tops",
        brand: null,
        size: "M",
        condition: "Good",
        price: 25.0,
        sellerId: "s1",
        isApproved: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        images: null,
      },
    },
    {
      id: "ci2",
      cartId: "cart1",
      productId: "p2",
      quantity: 1,
      priceAtAdd: 50.0,
      product: {
        id: "p2",
        title: "Wool sweater",
        description: "Cozy knit",
        category: "Sweaters",
        brand: null,
        size: "L",
        condition: "Like New",
        price: 50.0,
        sellerId: "s2",
        isApproved: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        images: null,
      },
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const emptyCart = {
  id: "cart1",
  userId: "u1",
  items: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Request failed",
}));

import { api } from "@/lib/api";

describe("CartPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    authState.isLoading = false;
  });

  it("renderiza el encabezado y los productos del carrito", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /tu carrito/i }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    expect(screen.getByText("Wool sweater")).toBeInTheDocument();
  });

  it("muestra el total correcto", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    // 2*25 + 1*50 = 100; both subtotal and total show this value, formatted as $ 100
    await waitFor(() => {
      expect(screen.getAllByText("$ 100").length).toBeGreaterThan(0);
    });
  });

  it("muestra un error cuando falla la carga del carrito, sin caer en el estado vacío", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no pudimos cargar tu carrito/i),
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText(/tu carrito está vacío/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reintentar/i }),
    ).toBeInTheDocument();
  });

  it("recupera la vista del carrito al reintentar después de un error de carga", async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ data: mockCart });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByText(/no pudimos cargar tu carrito/i),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });
    expect(screen.getByText("Wool sweater")).toBeInTheDocument();
    expect(
      screen.queryByText(/no pudimos cargar tu carrito/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/tu carrito está vacío/i),
    ).not.toBeInTheDocument();
    // 2*25 + 1*50 = 100; both subtotal and total show this value, formatted as $ 100
    expect(screen.getAllByText("$ 100").length).toBeGreaterThan(0);
  });

  it("muestra un estado vacío cuando el carrito no tiene productos", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: emptyCart });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/tu carrito está vacío/i)).toBeInTheDocument();
    });
  });

  it("pide al usuario iniciar sesión si no está autenticado", async () => {
    authState.user = null;
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );
    expect(screen.getByText(/inicia sesión/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("llama a la api para eliminar un producto al hacer click en Eliminar", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    const removeButtons = screen.getAllByRole("button", { name: /eliminar/i });
    await user.click(removeButtons[0]!);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/cart/items/ci1");
    });
  });

  it("bloquea el pago y marca los campos si la dirección está en blanco", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /pagar/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/completa la dirección de envío/i),
      ).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getAllByText("Obligatorio").length).toBeGreaterThan(0);
  });

  it("bloquea el pago si solo se llena un campo de la dirección", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Calle y número"), "Calle 10 # 5-20");
    await user.click(screen.getByRole("button", { name: /pagar/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/completa la dirección de envío/i),
      ).toBeInTheDocument();
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("realiza el pedido con la dirección al hacer click en Pagar", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    vi.mocked(api.post).mockResolvedValue({ data: { id: "order1" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Calle y número"), "Calle 10 # 5-20");
    await user.type(screen.getByLabelText("Ciudad"), "Bogotá");
    await user.type(screen.getByLabelText("País"), "Colombia");
    await user.click(screen.getByRole("button", { name: /pagar/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/orders", {
        shippingAddress: {
          street: "Calle 10 # 5-20",
          city: "Bogotá",
          state: "",
          zip: "",
          country: "Colombia",
        },
      });
    });
    expect(pushMock).toHaveBeenCalledWith("/orders");
  });

  it("muestra un error si el pago falla", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    vi.mocked(api.post).mockRejectedValue(new Error("El carrito está vacío"));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText("Calle y número"), "Calle 10 # 5-20");
    await user.type(screen.getByLabelText("Ciudad"), "Bogotá");
    await user.type(screen.getByLabelText("País"), "Colombia");
    await user.click(screen.getByRole("button", { name: /pagar/i }));

    await waitFor(() => {
      expect(screen.getByText("El carrito está vacío")).toBeInTheDocument();
    });
  });
});
