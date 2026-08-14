import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FavoriteButton } from "../favorite-button";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn() }),
}));

const authState: {
  user: null | { id: string; email: string; name: string; role: "USER" | "ADMIN" };
  isLoading: boolean;
} = {
  user: null,
  isLoading: false,
};

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    useAuth: () => authState,
  };
});

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "@/lib/api";

describe("FavoriteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = false;
  });

  it("redirige a iniciar sesión al hacer click sin sesión", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <FavoriteButton productId="p1" />
      </TestProviders>,
    );

    await user.click(
      screen.getByRole("button", { name: /agregar a favoritos/i }),
    );

    expect(pushMock).toHaveBeenCalledWith(
      "/login?next=%2Fproducts%2Fp1&reason=favorite",
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("muestra 'Agregar a favoritos' y lo agrega cuando aún no es favorito", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    vi.mocked(api.post).mockResolvedValue({ data: { id: "fav1" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <FavoriteButton productId="p1" />
      </TestProviders>,
    );

    const button = await screen.findByRole("button", {
      name: /agregar a favoritos/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "false");

    await user.click(button);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/favorites/p1");
    });
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("muestra 'Quitar de favoritos' y lo elimina cuando ya es favorito", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.get).mockResolvedValue({
      data: [{ id: "fav1", userId: "u1", productId: "p1", createdAt: "" }],
    });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <FavoriteButton productId="p1" />
      </TestProviders>,
    );

    const button = await screen.findByRole("button", {
      name: /quitar de favoritos/i,
    });
    expect(button).toHaveAttribute("aria-pressed", "true");

    await user.click(button);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/favorites/p1");
    });
    expect(api.post).not.toHaveBeenCalled();
  });

  it("no consulta /favorites cuando no hay sesión", async () => {
    render(
      <TestProviders>
        <FavoriteButton productId="p1" />
      </TestProviders>,
    );

    await screen.findByRole("button", { name: /agregar a favoritos/i });
    expect(api.get).not.toHaveBeenCalled();
  });

  // Regression: AuthProvider starts as `{ user: null, isLoading: true }`
  // while it verifies a persisted token. Treating that window as "logged
  // out" wrongly sent an already-authenticated visitor to /login.
  it("no redirige a iniciar sesión mientras la autenticación está cargando", async () => {
    authState.isLoading = true;
    const user = userEvent.setup();
    render(
      <TestProviders>
        <FavoriteButton productId="p1" />
      </TestProviders>,
    );

    const button = screen.getByRole("button", { name: /agregar a favoritos/i });
    expect(button).toBeDisabled();
    await user.click(button);

    expect(pushMock).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("anuncia un error cuando falla agregar a favoritos", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.get).mockResolvedValue({ data: [] });
    vi.mocked(api.post).mockRejectedValue(new Error("Network error"));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <FavoriteButton productId="p1" />
      </TestProviders>,
    );

    const button = await screen.findByRole("button", {
      name: /agregar a favoritos/i,
    });
    await user.click(button);

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/no pudimos agregar/i);
  });
});
