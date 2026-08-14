import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VerifyEmailPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();
const refreshMock = vi.fn();
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

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => ({ refresh: refreshMock }),
  };
});

vi.mock("@/lib/api", () => ({
  api: { post: vi.fn() },
  extractApiError: (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback,
}));

import { api } from "@/lib/api";

function renderPage() {
  return render(
    <TestProviders>
      <VerifyEmailPage />
    </TestProviders>,
  );
}

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams("token=abc123");
  });

  it("muestra un enlace inválido cuando no hay token en la URL", () => {
    mockSearchParams = new URLSearchParams();
    renderPage();

    expect(
      screen.getByRole("heading", { name: /enlace inválido/i }),
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("envía el token automáticamente y muestra éxito", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: "ok" } });
    renderPage();

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/verify-email", {
        token: "abc123",
      });
    });
    expect(
      await screen.findByRole("heading", { name: /correo verificado/i }),
    ).toBeInTheDocument();
    expect(refreshMock).toHaveBeenCalled();
  });

  it("solo envía el token una vez", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: "ok" } });
    renderPage();

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledTimes(1);
    });
    await screen.findByRole("heading", { name: /correo verificado/i });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it("muestra un error cuando el token no es válido", async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: {
        data: {
          message: "El enlace de verificación no es válido o ya fue usado",
        },
      },
    });
    renderPage();

    expect(
      await screen.findByText(
        /el enlace de verificación no es válido o ya fue usado/i,
      ),
    ).toBeInTheDocument();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("navega al perfil tras verificar con éxito", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { message: "ok" } });
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /ir a tu perfil/i }),
    );
    expect(pushMock).toHaveBeenCalledWith("/profile");
  });
});
