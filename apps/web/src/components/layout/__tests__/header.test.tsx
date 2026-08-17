import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "../header";
import { TestProviders } from "@/test-utils/TestProviders";

// A logged-in Header renders NotificationBell, which fires its own
// GET /notifications/unread-count on mount. Mocked here so existing tests
// stay focused on nav/auth behavior instead of also having to stub that.
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

const pushMock = vi.fn();
const refreshMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
}));

const authState = {
  user: null as null | { id: string; email: string; name: string; role: "USER" | "ADMIN" },
  isLoading: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
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

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = false;
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/notifications/unread-count") return { data: { count: 0 } };
      if (url === "/notifications") {
        return { data: { data: [], meta: { total: 0, page: 1, limit: 10, pages: 0 } } };
      }
      return { data: {} };
    });
  });

  it("muestra la marca en todos los viewports", () => {
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    expect(screen.getByText("Versale")).toBeInTheDocument();
  });

  it("muestra los botones Iniciar sesión y Crear cuenta cuando no hay sesión", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    const loginBtn = screen.getByRole("button", { name: /iniciar sesión/i });
    const signupBtn = screen.getByRole("button", { name: /crear cuenta/i });
    expect(loginBtn).toBeInTheDocument();
    expect(signupBtn).toBeInTheDocument();

    await user.click(loginBtn);
    expect(pushMock).toHaveBeenCalledWith("/login");

    await user.click(signupBtn);
    expect(pushMock).toHaveBeenCalledWith("/signup");
  });

  it("muestra Carrito, Pedidos, Vender y el nombre del usuario al iniciar sesión", () => {
    authState.user = {
      id: "u1",
      email: "a@b.c",
      name: "Alice",
      role: "USER",
    };
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    // Cart aparece en el nav inline (sm+) y como ícono en mobile (<sm).
    const cartTargets = screen.getAllByRole("link", { name: /carrito/i });
    expect(cartTargets.length).toBeGreaterThan(0);
    expect(cartTargets[0]).toHaveAttribute("href", "/cart");
    expect(screen.getByRole("link", { name: /^pedidos$/i })).toHaveAttribute(
      "href",
      "/orders",
    );
    expect(screen.getByRole("link", { name: /^vender$/i })).toHaveAttribute(
      "href",
      "/sell",
    );
    expect(
      screen.getByRole("link", { name: /^mis publicaciones$/i }),
    ).toHaveAttribute("href", "/mis-productos");
    expect(
      screen.getByRole("link", { name: /^favoritos$/i }),
    ).toHaveAttribute("href", "/favoritos");
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("muestra el enlace Admin solo para usuarios ADMIN", () => {
    authState.user = {
      id: "admin1",
      email: "admin@b.c",
      name: "Admin User",
      role: "ADMIN",
    };
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    const adminLink = screen.getByRole("link", { name: /^admin$/i });
    expect(adminLink).toHaveAttribute("href", "/admin");
  });

  it("no muestra el enlace Admin para usuarios no administradores", () => {
    authState.user = {
      id: "u1",
      email: "a@b.c",
      name: "Alice",
      role: "USER",
    };
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    expect(screen.queryByRole("link", { name: /admin/i })).toBeNull();
  });

  it("cierra sesión y navega al inicio al hacer click en Cerrar sesión", async () => {
    authState.user = {
      id: "u1",
      email: "a@b.c",
      name: "Alice",
      role: "USER",
    };
    const user = userEvent.setup();
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    await user.click(screen.getByRole("button", { name: /cerrar sesión/i }));
    expect(authState.logout).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("expone un disparador de menú móvil con atributos aria correctos", () => {
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    const trigger = screen.getByRole("button", { name: /abrir menú/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", "mobile-menu");
  });

  it("abre y cierra el menú móvil al hacer click en el disparador", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    const trigger = screen.getByRole("button", { name: /abrir menú/i });
    await user.click(trigger);
    expect(
      screen.getByRole("button", { name: /cerrar menú/i }),
    ).toBeInTheDocument();
    const dialog = screen.getByRole("dialog", { name: /navegación móvil/i });
    expect(dialog).toBeInTheDocument();
  });

  it('el menú "Más" del nav de escritorio expone Mis publicaciones, Mis ventas, Favoritos y Mi perfil, y se cierra tras seleccionar', async () => {
    authState.user = {
      id: "u1",
      email: "a@b.c",
      name: "Alice",
      role: "USER",
    };
    const user = userEvent.setup();
    const { container } = render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    const moreTrigger = screen.getByRole("button", { name: /^más$/i });
    expect(moreTrigger).toHaveAttribute("aria-expanded", "false");

    await user.click(moreTrigger);
    expect(moreTrigger).toHaveAttribute("aria-expanded", "true");
    const panel = within(container.querySelector("#header-more-menu")!);
    const misPublicaciones = panel.getByRole("link", {
      name: /^mis publicaciones$/i,
    });
    expect(misPublicaciones).toHaveAttribute("href", "/mis-productos");
    const misVentas = panel.getByRole("link", { name: /^mis ventas$/i });
    expect(misVentas).toHaveAttribute("href", "/mis-ventas");
    const favoritos = panel.getByRole("link", { name: /^favoritos$/i });
    expect(favoritos).toHaveAttribute("href", "/favoritos");
    const miPerfil = panel.getByRole("link", { name: /mi perfil \(alice\)/i });
    expect(miPerfil).toHaveAttribute("href", "/profile");

    await user.click(miPerfil);
    expect(moreTrigger).toHaveAttribute("aria-expanded", "false");
  });

  it('el menú "Más" se cierra con Escape y devuelve el foco al disparador', async () => {
    authState.user = {
      id: "u1",
      email: "a@b.c",
      name: "Alice",
      role: "USER",
    };
    const user = userEvent.setup();
    render(
      <TestProviders>
        <Header />
      </TestProviders>,
    );
    const moreTrigger = screen.getByRole("button", { name: /^más$/i });
    await user.click(moreTrigger);
    expect(moreTrigger).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(moreTrigger).toHaveAttribute("aria-expanded", "false");
    expect(moreTrigger).toHaveFocus();
  });
});
