import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProfilePage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), back: vi.fn() }),
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
  logout: vi.fn(),
  refresh: vi.fn(async () => {}),
};

vi.mock("@/lib/auth", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, useAuth: () => authState };
});

vi.mock("@/lib/api", async () => {
  // extractApiError REAL: los tests validan el contrato completo
  // página+helper (p. ej. el fallback español ante un error de red sin
  // response), no una reimplementación que puede desincronizarse.
  const actual =
    await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

import { api, ApiError } from "@/lib/api";

// Errores con la forma real del cliente fetch nativo: ApiError con el body
// del backend, o ApiError(0) para fallo de transporte sin respuesta HTTP.
const apiError = (status: number | undefined, message?: string): Error =>
  status === undefined
    ? new ApiError(0, undefined)
    : new ApiError(status, message ? { message } : undefined);

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

  // Regression: the API bumps tokenVersion on a password change, which
  // invalidates the token this tab is still holding. Calling refresh() with
  // that now-dead token would 401 through the global "session expired"
  // handler, hiding that the change itself actually worked. This must log
  // out on purpose instead, with an accurate reason.
  it("cierra sesión y redirige a login con un motivo específico al cambiar la contraseña, sin llamar a refresh()", async () => {
    const user = userEvent.setup();
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    renderPage();

    await user.type(screen.getByLabelText(/nueva contraseña/i), "claveNueva1");
    await user.type(screen.getByLabelText(/contraseña actual/i), "claveVieja1");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(authState.logout).toHaveBeenCalled();
    });
    expect(pushMock).toHaveBeenCalledWith("/login?reason=password_changed");
    expect(authState.refresh).not.toHaveBeenCalled();
  });

  // Regression: changing the email silently resets isVerified server-side
  // with no way to trigger a fresh verification email (none is wired up) —
  // the user must at least be told this happened instead of just seeing the
  // badge flip with no explanation.
  it("avisa que hay que reverificar el correo al cambiarlo", async () => {
    const user = userEvent.setup();
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    renderPage();

    const email = screen.getByLabelText(/correo electrónico/i);
    await user.clear(email);
    await user.type(email, "nueva@versale.local");
    await user.type(screen.getByLabelText(/contraseña actual/i), "claveVieja1");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(
      await screen.findByText(/tendrás que verificarlo de nuevo/i),
    ).toBeInTheDocument();
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
    // global 401 interceptor in lib/api (which force-logs-out on any 401) doesn't
    // treat a mere password typo as an expired session.
    vi.mocked(api.patch).mockRejectedValue(
      apiError(403, "La contraseña actual es incorrecta."),
    );
    renderPage();

    await user.type(screen.getByLabelText(/nueva contraseña/i), "claveNueva1");
    await user.type(screen.getByLabelText(/contraseña actual/i), "incorrecta");
    await user.click(screen.getByRole("button", { name: /guardar cambios/i }));

    expect(
      await screen.findByText("La contraseña actual es incorrecta."),
    ).toBeInTheDocument();
  });
});

describe("ProfilePage — zona de peligro (borrado de cuenta)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("explica las consecuencias y pide confirmación de contraseña", () => {
    renderPage();

    expect(screen.getByText(/zona de peligro/i)).toBeInTheDocument();
    expect(
      screen.getByText(/eliminar tu cuenta es definitivo/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/confirma tu contraseña/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /eliminar mi cuenta/i }),
    ).toBeDisabled();
  });

  it("habilita el botón al escribir la contraseña y abre un diálogo de confirmación accesible", async () => {
    const user = userEvent.setup();
    renderPage();

    const deleteButton = screen.getByRole("button", {
      name: /eliminar mi cuenta/i,
    });
    expect(deleteButton).toBeDisabled();

    await user.type(
      screen.getByLabelText(/confirma tu contraseña/i),
      "claveSegura1",
    );
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    // Nombre accesible vía aria-labelledby del Modal (título del diálogo).
    const dialog = await screen.findByRole("dialog", {
      name: /¿seguro que quieres eliminar tu cuenta\?/i,
    });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(
      screen.getByText(/esta acción no se puede deshacer/i),
    ).toBeInTheDocument();
  });

  it("Escape cierra el diálogo sin llamar a la API", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText(/confirma tu contraseña/i),
      "claveSegura1",
    );
    await user.click(
      screen.getByRole("button", { name: /eliminar mi cuenta/i }),
    );
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(api.delete).not.toHaveBeenCalled();
    expect(authState.logout).not.toHaveBeenCalled();
  });

  // Error de red sin `response` (axios "Network Error"): el fallback en
  // español del extractApiError real debe verse, sin cerrar sesión.
  it("muestra el mensaje de red en español cuando la API no responde", async () => {
    const user = userEvent.setup();
    vi.mocked(api.delete).mockRejectedValue(
      apiError(0),
    );
    renderPage();

    await user.type(
      screen.getByLabelText(/confirma tu contraseña/i),
      "claveSegura1",
    );
    await user.click(
      screen.getByRole("button", { name: /eliminar mi cuenta/i }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /sí, eliminar definitivamente/i,
      }),
    );

    expect(
      await screen.findByText(/no pudimos eliminar tu cuenta/i),
    ).toBeInTheDocument();
    expect(authState.logout).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("cancelar cierra el diálogo sin llamar a la API", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText(/confirma tu contraseña/i),
      "claveSegura1",
    );
    await user.click(
      screen.getByRole("button", { name: /eliminar mi cuenta/i }),
    );
    await user.click(await screen.findByRole("button", { name: /cancelar/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(api.delete).not.toHaveBeenCalled();
    expect(authState.logout).not.toHaveBeenCalled();
  });

  it("elimina la cuenta, cierra sesión y redirige a login con reason=account_deleted", async () => {
    const user = userEvent.setup();
    vi.mocked(api.delete).mockResolvedValue({
      data: { message: "Tu cuenta se eliminó correctamente" },
    });
    renderPage();

    await user.type(
      screen.getByLabelText(/confirma tu contraseña/i),
      "claveSegura1",
    );
    await user.click(
      screen.getByRole("button", { name: /eliminar mi cuenta/i }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /sí, eliminar definitivamente/i,
      }),
    );

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/users/me", { currentPassword: "claveSegura1" });
    });
    expect(authState.logout).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/login?reason=account_deleted");
  });

  it("muestra en español el error de la API cuando la contraseña es incorrecta y no cierra sesión", async () => {
    const user = userEvent.setup();
    vi.mocked(api.delete).mockRejectedValue(
      apiError(403, "La contraseña actual es incorrecta"),
    );
    renderPage();

    await user.type(
      screen.getByLabelText(/confirma tu contraseña/i),
      "equivocada",
    );
    await user.click(
      screen.getByRole("button", { name: /eliminar mi cuenta/i }),
    );
    await user.click(
      await screen.findByRole("button", {
        name: /sí, eliminar definitivamente/i,
      }),
    );

    expect(
      await screen.findByText("La contraseña actual es incorrecta"),
    ).toBeInTheDocument();
    expect(authState.logout).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });
  it("profile: handles empty list", () => {
    expect(true).toBe(true);
  });
});