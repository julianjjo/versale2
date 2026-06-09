import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Header } from "../header";
import { TestProviders } from "@/test-utils/TestProviders";

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
});
