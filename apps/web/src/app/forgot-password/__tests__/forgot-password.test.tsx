import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ForgotPasswordPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

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

vi.mock("@/lib/api", () => ({
  api: { post: vi.fn() },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Request failed",
}));

import { api } from "@/lib/api";

function renderPage() {
  return render(
    <TestProviders>
      <ForgotPasswordPage />
    </TestProviders>,
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el formulario", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /recuperar contraseña/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Correo electrónico")).toBeInTheDocument();
  });

  it("envía el correo y muestra el mensaje de confirmación", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        message:
          "Si el correo existe, enviaremos instrucciones para restablecer la contraseña",
      },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "alice@ejemplo.co",
    );
    await user.click(
      screen.getByRole("button", { name: /enviar instrucciones/i }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/forgot-password", {
        email: "alice@ejemplo.co",
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      /si el correo existe/i,
    );
  });

  it("muestra el enlace directo de desarrollo cuando la API lo incluye", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { message: "listo", resetToken: "abc123" },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "alice@ejemplo.co",
    );
    await user.click(
      screen.getByRole("button", { name: /enviar instrucciones/i }),
    );

    const link = await screen.findByRole("link", {
      name: /restablecer contraseña/i,
    });
    expect(link).toHaveAttribute(
      "href",
      "/reset-password?token=abc123",
    );
  });

  it("muestra un error cuando falla la solicitud", async () => {
    vi.mocked(api.post).mockRejectedValue(new Error("Error de red"));
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText("Correo electrónico"),
      "alice@ejemplo.co",
    );
    await user.click(
      screen.getByRole("button", { name: /enviar instrucciones/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Error de red")).toBeInTheDocument();
    });
  });
});
