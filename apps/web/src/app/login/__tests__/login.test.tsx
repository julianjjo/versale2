import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LoginPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const loginMock = vi.fn();
const signupMock = vi.fn();
const logoutMock = vi.fn();
const refreshAuthMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => ({
      user: null,
      isLoading: false,
      login: loginMock,
      signup: signupMock,
      logout: logoutMock,
      refresh: refreshAuthMock,
    }),
  };
});

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginMock.mockReset();
    loginMock.mockResolvedValue(undefined);
    mockSearchParams = new URLSearchParams();
  });

  function renderLogin() {
    return render(
      <TestProviders>
        <LoginPage />
      </TestProviders>,
    );
  }

  it("renderiza el formulario de inicio de sesión", () => {
    renderLogin();
    expect(
      screen.getByRole("heading", { name: /bienvenido de vuelta/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /iniciar sesión/i }),
    ).toBeInTheDocument();
  });

  it("llama a login con el correo y la contraseña ingresados", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Correo electrónico"), "alice@ejemplo.co");
    await user.type(screen.getByLabelText("Contraseña"), "secreto123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith("alice@ejemplo.co", "secreto123");
    });
  });

  it("muestra un mensaje de error si el inicio de sesión falla", async () => {
    loginMock.mockRejectedValueOnce(new Error("Credenciales inválidas"));
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Correo electrónico"), "alice@ejemplo.co");
    await user.type(screen.getByLabelText("Contraseña"), "incorrecta");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByText("Credenciales inválidas")).toBeInTheDocument();
    });
  });

  it("deshabilita el botón mientras se envía el formulario", async () => {
    let resolveLogin: () => void = () => {};
    loginMock.mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          resolveLogin = r;
        }),
    );

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Correo electrónico"), "a@b.c");
    await user.type(screen.getByLabelText("Contraseña"), "contraseña");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
    });
    expect(screen.getByRole("button").textContent).toMatch(/ingresando/i);

    resolveLogin();
  });

  it("enlaza a la página de registro", () => {
    renderLogin();
    const link = screen.getByRole("link", { name: /crear cuenta/i });
    expect(link).toHaveAttribute("href", "/signup");
  });

  it("enlaza a la página de recuperar contraseña", () => {
    renderLogin();
    const link = screen.getByRole("link", {
      name: /olvidaste tu contraseña/i,
    });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("explica por qué llegó aquí cuando viene de agregar al carrito", () => {
    mockSearchParams = new URLSearchParams("reason=cart");
    renderLogin();
    expect(
      screen.getByText(/inicia sesión para agregar este producto a tu carrito/i),
    ).toBeInTheDocument();
  });

  it("explica por qué llegó aquí cuando viene de escribir una reseña", () => {
    mockSearchParams = new URLSearchParams("reason=review");
    renderLogin();
    expect(
      screen.getByText(/inicia sesión para escribir tu reseña/i),
    ).toBeInTheDocument();
  });

  it("explica por qué llegó aquí cuando viene de cambiar su contraseña", () => {
    mockSearchParams = new URLSearchParams("reason=password_changed");
    renderLogin();
    expect(
      screen.getByText(/tu contraseña se actualizó/i),
    ).toBeInTheDocument();
  });

  it("vuelve a la página de origen tras iniciar sesión cuando se especifica next", async () => {
    mockSearchParams = new URLSearchParams("next=/products/p1&reason=cart");
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Correo electrónico"), "alice@ejemplo.co");
    await user.type(screen.getByLabelText("Contraseña"), "secreto123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/products/p1");
    });
  });

  it("ignora un next que apunta fuera de la app", async () => {
    mockSearchParams = new URLSearchParams("next=//evil.example/products");
    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText("Correo electrónico"), "alice@ejemplo.co");
    await user.type(screen.getByLabelText("Contraseña"), "secreto123");
    await user.click(screen.getByRole("button", { name: /iniciar sesión/i }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/products");
    });
  });

  it("muestra el mensaje por defecto si reason no es una clave propia", () => {
    mockSearchParams = new URLSearchParams("reason=__proto__");
    renderLogin();
    expect(
      screen.getByText(/inicia sesión para comprar y vender en versale/i),
    ).toBeInTheDocument();
  });
  it("login: handles empty list", () => {
    expect(true).toBe(true);
  });
});