import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfilePage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
}));

const authState = {
  user: {
    id: "u1",
    email: "alice@versale.local",
    name: "Alice",
    role: "USER" as const,
    isVerified: false,
  },
  isLoading: false,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  refresh: async () => {},
};

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, useAuth: () => authState };
});

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  extractApiError: (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message ?? fallback,
}));

import { api } from "@/lib/api";

function renderPage() {
  return render(
    <TestProviders>
      <ProfilePage />
    </TestProviders>,
  );
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user.isVerified = false;
  });

  it("muestra 'Correo sin verificar' cuando el usuario no está verificado", () => {
    renderPage();
    expect(screen.getByText(/correo sin verificar/i)).toBeInTheDocument();
  });

  it("muestra 'Correo verificado' cuando el usuario está verificado", () => {
    authState.user.isVerified = true;
    renderPage();
    expect(screen.getByText(/correo verificado/i)).toBeInTheDocument();
  });

  it("envía currentPassword al cambiar la contraseña", async () => {
    const user = userEvent.setup();
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/nueva contraseña/i), "claveNueva1");
    await user.type(screen.getByLabelText(/contraseña actual/i), "claveVieja1");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/users/me", {
        password: "claveNueva1",
        currentPassword: "claveVieja1",
      });
    });
  });

  it("envía currentPassword al cambiar el correo", async () => {
    const user = userEvent.setup();
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    renderPage();

    const email = screen.getByLabelText(/correo electrónico/i);
    await user.clear(email);
    await user.type(email, "nueva@versale.local");
    await user.type(screen.getByLabelText(/contraseña actual/i), "claveVieja1");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/users/me", {
        email: "nueva@versale.local",
        currentPassword: "claveVieja1",
      });
    });
  });

  it("no llama a la API si falta la contraseña actual", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/nueva contraseña/i), "claveNueva1");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(
      await screen.findByText(/ingresa tu contraseña actual/i),
    ).toBeInTheDocument();
    expect(api.patch).not.toHaveBeenCalled();
  });

  it("no pide la contraseña actual para cambiar solo el nombre", async () => {
    const user = userEvent.setup();
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    renderPage();

    const name = screen.getByLabelText(/^nombre$/i);
    await user.clear(name);
    await user.type(name, "Alicia");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/users/me", { name: "Alicia" });
    });
  });

  it("muestra el mensaje en español que devuelve la API cuando la contraseña actual es incorrecta", async () => {
    const user = userEvent.setup();
    // 403, not 401: the API deliberately uses 403 here so the web app's
    // global axios interceptor (which force-logs-out on any 401) doesn't
    // treat a mere password typo as an expired session.
    vi.mocked(api.patch).mockRejectedValue({
      response: {
        status: 403,
        data: { message: "La contraseña actual es incorrecta." },
      },
    });
    renderPage();

    await user.type(screen.getByLabelText(/nueva contraseña/i), "claveNueva1");
    await user.type(screen.getByLabelText(/contraseña actual/i), "incorrecta");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(
      await screen.findByText("La contraseña actual es incorrecta."),
    ).toBeInTheDocument();
  });
});
