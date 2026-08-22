import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResetPasswordPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
  useSearchParams: () => mockSearchParams,
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
      <ResetPasswordPage />
    </TestProviders>,
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("token=valid-token");
  });

  it("muestra un enlace inválido cuando no hay token en la URL", () => {
    mockSearchParams = new URLSearchParams();
    renderPage();

    expect(
      screen.getByRole("heading", { name: /enlace inválido/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /solicitar un nuevo enlace/i }),
    ).toHaveAttribute("href", "/forgot-password");
  });

  it("envía el token y la nueva contraseña", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { message: "Tu contraseña se actualizó correctamente" },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Nueva contraseña"), "nuevaClave1");
    await user.type(
      screen.getByLabelText("Confirmar contraseña"),
      "nuevaClave1",
    );
    await user.click(
      screen.getByRole("button", { name: /actualizar contraseña/i }),
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/reset-password", {
        token: "valid-token",
        password: "nuevaClave1",
      });
    });
    expect(
      screen.getByRole("heading", { name: /contraseña actualizada/i }),
    ).toBeInTheDocument();
  });

  it("rechaza contraseñas que no coinciden sin llamar a la API", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Nueva contraseña"), "nuevaClave1");
    await user.type(
      screen.getByLabelText("Confirmar contraseña"),
      "otraClave2",
    );
    await user.click(
      screen.getByRole("button", { name: /actualizar contraseña/i }),
    );

    expect(
      screen.getByText(/las contraseñas no coinciden/i),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("muestra un error cuando el token es inválido o expiró", async () => {
    vi.mocked(api.post).mockRejectedValue(
      Object.assign(new Error("El enlace no es válido o expiró"), {
        response: { data: { message: "El enlace no es válido o expiró" } },
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Nueva contraseña"), "nuevaClave1");
    await user.type(
      screen.getByLabelText("Confirmar contraseña"),
      "nuevaClave1",
    );
    await user.click(
      screen.getByRole("button", { name: /actualizar contraseña/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/el enlace no es válido o expiró/i),
      ).toBeInTheDocument();
    });
  });

  // Regression: the success panel replaces the whole form with no live
  // region and no focus move, so a screen reader user who just submitted
  // got no announcement that the password was actually updated (unlike
  // forgot-password's own success message, which already uses role="status").
  it("anuncia el éxito a lectores de pantalla con una región en vivo", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { message: "Tu contraseña se actualizó correctamente" },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Nueva contraseña"), "nuevaClave1");
    await user.type(
      screen.getByLabelText("Confirmar contraseña"),
      "nuevaClave1",
    );
    await user.click(
      screen.getByRole("button", { name: /actualizar contraseña/i }),
    );

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent(/tu contraseña se actualizó correctamente/i);
  });

  it("navega a login tras confirmar el éxito", async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: { message: "ok" },
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Nueva contraseña"), "nuevaClave1");
    await user.type(
      screen.getByLabelText("Confirmar contraseña"),
      "nuevaClave1",
    );
    await user.click(
      screen.getByRole("button", { name: /actualizar contraseña/i }),
    );

    await user.click(
      await screen.findByRole("button", { name: /iniciar sesión/i }),
    );
    expect(pushMock).toHaveBeenCalledWith("/login");
  });
});
