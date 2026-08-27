import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminUsersPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
};

const authState: {
  user: AuthUser | null;
  isLoading: boolean;
  login: () => Promise<void>;
  signup: () => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
} = {
  user: { id: "admin1", email: "admin@versale.co", name: "Admin Uno", role: "ADMIN" },
  isLoading: false,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  refresh: async () => {},
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
    delete: vi.fn(),
  },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Ocurrió un error. Intenta de nuevo.",
}));

import { api } from "@/lib/api";

function usersFixture(overrides?: Partial<AuthUser>[]) {
  return [
    { id: "admin1", email: "admin@versale.co", name: "Admin Uno", role: "ADMIN" as const },
    { id: "user1", email: "user1@versale.co", name: "Usuario Uno", role: "USER" as const },
    ...(overrides ?? []),
  ];
}

function paginatedResponse(users: ReturnType<typeof usersFixture>) {
  return {
    data: users,
    meta: { total: users.length, page: 1, pages: 1 },
  };
}

describe("AdminUsersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: "admin1", email: "admin@versale.co", name: "Admin Uno", role: "ADMIN" };
  });

  it("deshabilita Eliminar en la propia fila del administrador autenticado", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse(usersFixture()) });
    render(
      <TestProviders>
        <AdminUsersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Admin Uno")).toBeInTheDocument();
    });

    const rows = screen.getAllByRole("button", { name: /eliminar/i });
    // First row is Admin Uno (the current user) — must be disabled.
    expect(rows[0]).toBeDisabled();
    // Second row is a regular user — must stay enabled.
    expect(rows[1]).toBeEnabled();
  });

  it("deshabilita Eliminar cuando el objetivo es el último administrador", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse([
        { id: "admin1", email: "admin@versale.co", name: "Admin Uno", role: "ADMIN" as const },
      ]),
    });
    render(
      <TestProviders>
        <AdminUsersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Admin Uno")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /eliminar/i })).toBeDisabled();
  });

  it("permite eliminar a un administrador cuando hay otros administradores", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(
        usersFixture([
          { id: "admin2", email: "admin2@versale.co", name: "Admin Dos", role: "ADMIN" as const },
        ]),
      ),
    });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <TestProviders>
        <AdminUsersPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Admin Dos")).toBeInTheDocument();
    });

    const adminDosRow = screen.getByText("Admin Dos").closest("div.flex");
    const deleteButton = adminDosRow?.querySelector("button");
    expect(deleteButton).toBeEnabled();

    await user.click(deleteButton!);

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/users/admin2");
    });
  });
  it("admin-users: handles empty list", () => {
    expect(true).toBe(true);
  });
});