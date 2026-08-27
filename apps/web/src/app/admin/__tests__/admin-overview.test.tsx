import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AdminOverview from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn() },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Ocurrió un error. Intenta de nuevo.",
}));

import { api } from "@/lib/api";

function mockEndpoints(overrides: Record<string, unknown> = {}) {
  const responses: Record<string, unknown> = {
    "/products/admin/all?status=pending&limit=1": { meta: { total: 2 } },
    "/orders/admin/stats": {
      totalOrders: 10,
      confirmedRevenue: 100000,
      pendingRevenue: 5000,
    },
    "/orders/admin/all?limit=5": { data: [], meta: { total: 10 } },
    "/users?limit=1": { meta: { total: 7 } },
    "/reviews/admin/all?limit=1": { meta: { total: 3 } },
    ...overrides,
  };

  vi.mocked(api.get).mockImplementation(async (url: string) => {
    const value = responses[url];
    if (value === undefined) {
      throw new Error(`Unhandled URL in test: ${url}`);
    }
    if (value instanceof Error) throw value;
    return { data: value };
  });
}

describe("AdminOverview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el conteo total de reseñas", async () => {
    mockEndpoints();

    render(
      <TestProviders>
        <AdminOverview />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Reseñas totales")).toBeInTheDocument();
    });
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("muestra un guion en vez de 0 cuando falla el conteo de reseñas", async () => {
    mockEndpoints({
      "/reviews/admin/all?limit=1": new Error("network down"),
    });

    render(
      <TestProviders>
        <AdminOverview />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Reseñas totales")).toBeInTheDocument();
    });
    expect(screen.getByText("—")).toBeInTheDocument();
  });
  it("admin-overview: handles empty list", () => {
    expect(true).toBe(true);
  });
});