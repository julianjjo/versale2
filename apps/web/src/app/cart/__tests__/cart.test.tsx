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
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => authState,
  };
});

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
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

// `/orders` is paginated now: the axios-style `{ data: ... }` wraps a second
// `{ data, meta }` envelope, not a bare array.
function ordersResponse(orders: unknown[]) {
  return {
    data: {
      data: orders,
      meta: { total: orders.length, page: 1, limit: 5, pages: 1 },
    },
  };
}

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
    // The page now also fetches `/orders` (for the "usar dirección anterior"
    // shortcut) alongside `/cart` on mount, so a plain call-order-based mock
    // chain would consume its rejected/resolved slots across both queries
    // instead of isolating the cart's own retry.
    let cartCalls = 0;
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.startsWith("/orders?")) return ordersResponse([]);
      cartCalls += 1;
      if (cartCalls === 1) throw new Error("Network error");
      return { data: mockCart };
    });
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

  it("anuncia en la región en vivo cuando se elimina un producto", async () => {
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

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    const removeButtons = screen.getAllByRole("button", { name: /eliminar/i });
    await user.click(removeButtons[0]!);

    await waitFor(() => {
      expect(status).toHaveTextContent(
        "Cotton t-shirt se eliminó del carrito.",
      );
    });
  });

  // Cada prenda es única: no hay selector de cantidad que editar. Antes había
  // un `<Input type="number">` con `max=1` que aceptaba cualquier valor y lo
  // revertía en silencio al perder el foco, sin avisar al usuario. Ahora la
  // cantidad se muestra como texto plano, sin ningún control que fingir.
  it("muestra la cantidad como texto fijo, sin un control editable", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: mockCart });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("spinbutton", { name: /cantidad/i }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText(/^Cantidad: /).length).toBe(2);
  });

  it("marca las prendas ya vendidas, las excluye del total y bloquea el pago", async () => {
    const soldCart = {
      ...mockCart,
      items: [
        {
          ...mockCart.items[0]!,
          product: {
            ...mockCart.items[0]!.product,
            status: "SOLD",
          },
        },
        mockCart.items[1]!,
      ],
    };
    vi.mocked(api.get).mockResolvedValue({ data: soldCart });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    // Sin esto la fila se veía comprable, entraba en el total y "Pagar" abortaba
    // toda la transacción del checkout por esa única línea, sin explicar cuál.
    expect(screen.getByText("Ya se vendió")).toBeInTheDocument();
    expect(
      screen.getByText(/una prenda de tu carrito ya no está disponible/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pagar/i })).toBeDisabled();
    // Un producto vendido sigue siendo visible en su propia página (findOne()
    // no lo oculta), así que el título sigue siendo un enlace navegable.
    expect(
      screen.getByRole("link", { name: "Cotton t-shirt" }),
    ).toBeInTheDocument();
  });

  // Un vendedor puede editar una publicación ya aprobada y devolverla a
  // moderación (isApproved:false, status sigue AVAILABLE). Antes eso no disparaba
  // ninguno de los tratamientos de "no disponible": seguía sumando al total y
  // "Pagar" se quedaba habilitado, para que el checkout completo fallara en
  // el servidor sin decir cuál línea fue la causante.
  it("marca las prendas que volvieron a moderación como no disponibles y bloquea el pago", async () => {
    const backToModerationCart = {
      ...mockCart,
      items: [
        {
          ...mockCart.items[0]!,
          product: {
            ...mockCart.items[0]!.product,
            isApproved: false,
          },
        },
        mockCart.items[1]!,
      ],
    };
    vi.mocked(api.get).mockResolvedValue({ data: backToModerationCart });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    expect(screen.getByText("Ya no está disponible")).toBeInTheDocument();
    expect(
      screen.getByText(/una prenda de tu carrito ya no está disponible/i),
    ).toBeInTheDocument();
    // Solo la prenda vendida (status SOLD) usa el texto "Ya se vendió"; esta no se
    // vendió, solo volvió a moderación, así que no debe verse esa etiqueta.
    expect(screen.queryByText("Ya se vendió")).not.toBeInTheDocument();
    // La API oculta un producto no aprobado a cualquiera que no sea su
    // vendedor o un admin, así que un enlace a su página devolvería un 404
    // para este comprador: el título deja de ser un enlace mientras está en
    // moderación.
    expect(
      screen.queryByRole("link", { name: "Cotton t-shirt" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    // 50 (el precio del suéter): la prenda no disponible se excluye del total.
    await waitFor(() => {
      expect(screen.getAllByText("$ 50").length).toBeGreaterThan(0);
    });
    expect(screen.getByRole("button", { name: /pagar/i })).toBeDisabled();

    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    await userEvent
      .setup()
      .click(
        screen.getByRole("button", { name: /quitar la prenda no disponible/i }),
      );
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/cart/items/ci1");
    });
  });

  // El vendedor pausó la publicación después de que se agregó al carrito: es
  // un caso distinto de "volvió a moderación" (isApproved sigue en true) y de
  // "se vendió" (status sigue AVAILABLE), así que necesita su propia etiqueta —
  // pero el mismo tratamiento de "no disponible": excluida del total, el pago
  // bloqueado, y removible con el mismo botón.
  it("marca las prendas que el vendedor pausó como no disponibles y bloquea el pago", async () => {
    const pausedCart = {
      ...mockCart,
      items: [
        {
          ...mockCart.items[0]!,
          product: {
            ...mockCart.items[0]!.product,
            pausedAt: new Date().toISOString(),
          },
        },
        mockCart.items[1]!,
      ],
    };
    vi.mocked(api.get).mockResolvedValue({ data: pausedCart });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });

    expect(
      screen.getByText("El vendedor la pausó temporalmente"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ya se vendió")).not.toBeInTheDocument();
    expect(screen.queryByText("Ya no está disponible")).not.toBeInTheDocument();
    expect(
      screen.getByText(/una prenda de tu carrito ya no está disponible/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /pagar/i })).toBeDisabled();
    // A paused listing is still approved, so the API still lets anyone view
    // its page — the title stays a navigable link, unlike the back-to-
    // moderation case above.
    expect(
      screen.getByRole("link", { name: "Cotton t-shirt" }),
    ).toBeInTheDocument();
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
    // Item 7: el checkout aterriza en la confirmación del pedido concreto,
    // no en el historial.
    expect(pushMock).toHaveBeenCalledWith("/orders/order1");
  });

  it("rellena la dirección con la del pedido anterior al hacer click en el acceso rápido", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.startsWith("/orders?")) {
        return ordersResponse([
          {
            id: "order1",
            userId: "u1",
            status: "DELIVERED",
            totalAmount: 30000,
            shippingAddress: {
              street: "Carrera 15 # 88-64",
              city: "Bogotá",
              state: "Cundinamarca",
              zip: "110221",
              country: "Colombia",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: [],
          },
        ]);
      }
      return { data: mockCart };
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    const shortcut = await screen.findByRole("button", {
      name: /usar la de tu pedido anterior/i,
    });
    await user.click(shortcut);

    expect(screen.getByLabelText("Calle y número")).toHaveValue(
      "Carrera 15 # 88-64",
    );
    expect(screen.getByLabelText("Ciudad")).toHaveValue("Bogotá");
    expect(screen.getByLabelText("Departamento")).toHaveValue("Cundinamarca");
    expect(screen.getByLabelText("Código postal")).toHaveValue("110221");
    expect(screen.getByLabelText("País")).toHaveValue("Colombia");
  });

  it("no ofrece un pedido anterior cuyo campo obligatorio 'país' está vacío", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.startsWith("/orders?")) {
        return ordersResponse([
          {
            id: "order1",
            userId: "u1",
            status: "DELIVERED",
            totalAmount: 30000,
            shippingAddress: {
              street: "Carrera 15 # 88-64",
              city: "Bogotá",
              state: "",
              zip: "",
              country: "",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: [],
          },
        ]);
      }
      return { data: mockCart };
    });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /usar la de tu pedido anterior/i }),
    ).not.toBeInTheDocument();
  });

  it("coacciona a texto un campo no-string en vez de romper el pago, y omite el resto", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.startsWith("/orders?")) {
        return ordersResponse([
          {
            id: "order1",
            userId: "u1",
            status: "DELIVERED",
            totalAmount: 30000,
            shippingAddress: {
              // `zip` llega como número: un dato mal tipado no debe romper
              // el pago ni terminar renderizado como "[object Object]".
              street: "Carrera 15 # 88-64",
              city: "Bogotá",
              state: "Cundinamarca",
              zip: 110221,
              country: "Colombia",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: [],
          },
        ]);
      }
      return { data: mockCart };
    });
    vi.mocked(api.post).mockResolvedValue({ data: { id: "order2" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    const shortcut = await screen.findByRole("button", {
      name: /usar la de tu pedido anterior/i,
    });
    await user.click(shortcut);

    expect(screen.getByLabelText("Código postal")).toHaveValue("");
    expect(screen.getByLabelText("Calle y número")).toHaveValue(
      "Carrera 15 # 88-64",
    );

    await user.click(screen.getByRole("button", { name: /^pagar$/i }));
    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/orders", {
        shippingAddress: {
          street: "Carrera 15 # 88-64",
          city: "Bogotá",
          state: "Cundinamarca",
          zip: "",
          country: "Colombia",
        },
      });
    });
  });

  it("limpia el banner de error al usar el acceso rápido de dirección anterior", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.startsWith("/orders?")) {
        return ordersResponse([
          {
            id: "order1",
            userId: "u1",
            status: "DELIVERED",
            totalAmount: 30000,
            shippingAddress: {
              street: "Carrera 15 # 88-64",
              city: "Bogotá",
              state: "Cundinamarca",
              zip: "110221",
              country: "Colombia",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: [],
          },
        ]);
      }
      return { data: mockCart };
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /^pagar$/i }));
    expect(
      await screen.findByText(/completa la dirección de envío/i),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /usar la de tu pedido anterior/i }),
    );

    expect(
      screen.queryByText(/completa la dirección de envío/i),
    ).not.toBeInTheDocument();
  });

  it("anuncia en la región en vivo cuando se usa el acceso rápido de dirección anterior", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.startsWith("/orders?")) {
        return ordersResponse([
          {
            id: "order1",
            userId: "u1",
            status: "DELIVERED",
            totalAmount: 30000,
            shippingAddress: {
              street: "Carrera 15 # 88-64",
              city: "Bogotá",
              state: "Cundinamarca",
              zip: "110221",
              country: "Colombia",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: [],
          },
        ]);
      }
      return { data: mockCart };
    });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    const shortcut = await screen.findByRole("button", {
      name: /usar la de tu pedido anterior/i,
    });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("");

    await user.click(shortcut);

    await waitFor(() => {
      expect(status).toHaveTextContent(
        "Se completó la dirección con la de tu pedido anterior.",
      );
    });
  });

  it("no pisa un error no relacionado al usar el acceso rápido de dirección anterior", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.startsWith("/orders?")) {
        return ordersResponse([
          {
            id: "order1",
            userId: "u1",
            status: "DELIVERED",
            totalAmount: 30000,
            shippingAddress: {
              street: "Carrera 15 # 88-64",
              city: "Bogotá",
              state: "Cundinamarca",
              zip: "110221",
              country: "Colombia",
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: [],
          },
        ]);
      }
      return { data: mockCart };
    });
    vi.mocked(api.delete).mockRejectedValue(new Error("No pudimos eliminar el producto"));
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
    expect(
      await screen.findByText("No pudimos eliminar el producto"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /usar la de tu pedido anterior/i }),
    );

    // The shortcut only ever clears its own stale "complete the address"
    // banner — a different, unrelated failure has to stay visible.
    expect(
      screen.getByText("No pudimos eliminar el producto"),
    ).toBeInTheDocument();
  });

  it("no muestra el acceso rápido cuando no hay pedidos anteriores", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url.startsWith("/orders?")) return ordersResponse([]);
      return { data: mockCart };
    });
    render(
      <TestProviders>
        <CartPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Cotton t-shirt")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /usar la de tu pedido anterior/i }),
    ).not.toBeInTheDocument();
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
