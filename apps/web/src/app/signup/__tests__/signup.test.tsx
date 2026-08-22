import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignupPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();
const refreshMock = vi.fn();
const loginMock = vi.fn();
const signupMock = vi.fn();
const logoutMock = vi.fn();
const refreshAuthMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock }),
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

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signupMock.mockReset();
    signupMock.mockResolvedValue(undefined);
  });

  function renderSignup() {
    return render(
      <TestProviders>
        <SignupPage />
      </TestProviders>,
    );
  }

  it("renderiza el formulario de registro", () => {
    renderSignup();
    expect(
      screen.getByRole("heading", { name: /crear cuenta/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("llama a signup con nombre, correo y contraseña", async () => {
    const user = userEvent.setup();
    renderSignup();

    await user.type(screen.getByLabelText("Nombre"), "Alice");
    await user.type(screen.getByLabelText("Correo electrónico"), "alice@ejemplo.co");
    await user.type(screen.getByLabelText("Contraseña"), "contraseña123");
    await user.click(screen.getByLabelText(/mayor de 18 años/i));
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(signupMock).toHaveBeenCalledWith(
        "alice@ejemplo.co",
        "Alice",
        "contraseña123",
      );
    });
  });

  it("muestra un mensaje de error si el registro falla", async () => {
    signupMock.mockRejectedValueOnce(new Error("El correo ya está en uso"));
    const user = userEvent.setup();
    renderSignup();

    await user.type(screen.getByLabelText("Nombre"), "Alice");
    await user.type(screen.getByLabelText("Correo electrónico"), "alice@ejemplo.co");
    await user.type(screen.getByLabelText("Contraseña"), "contraseña123");
    await user.click(screen.getByLabelText(/mayor de 18 años/i));
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    await waitFor(() => {
      expect(screen.getByText("El correo ya está en uso")).toBeInTheDocument();
    });
  });

  it("avisa que al crear la cuenta se aceptan los términos y la privacidad", () => {
    renderSignup();
    expect(
      screen.getByLabelText(/mayor de 18 años/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /términos y condiciones/i }),
    ).toHaveAttribute("href", "/terminos");
    expect(
      screen.getByRole("link", { name: /política de privacidad/i }),
    ).toHaveAttribute("href", "/privacidad");
  });

  // Item 8: sin el consentimiento explícito (18+ + términos) el registro no
  // se envía — ni llama al backend ni navega.
  it("rechaza el registro sin el checkbox de edad y términos", async () => {
    const user = userEvent.setup();
    renderSignup();

    await user.type(screen.getByLabelText("Nombre"), "Alice");
    await user.type(screen.getByLabelText("Correo electrónico"), "alice@ejemplo.co");
    await user.type(screen.getByLabelText("Contraseña"), "contraseña123");
    await user.click(screen.getByRole("button", { name: /crear cuenta/i }));

    expect(
      await screen.findByText(
        /debes confirmar que eres mayor de 18 años/i,
      ),
    ).toBeInTheDocument();
    expect(signupMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("enlaza a la página de inicio de sesión", () => {
    renderSignup();
    expect(
      screen.getByRole("link", { name: /iniciar sesión/i }),
    ).toHaveAttribute("href", "/login");
  });
});
