import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminReviewsPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";
import type { Review } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
  },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Ocurrió un error. Intenta de nuevo.",
}));

import { api } from "@/lib/api";

function reviewsFixture(overrides?: Partial<Review>[]): Review[] {
  return [
    {
      id: "review1",
      userId: "user1",
      productId: "product1",
      rating: 4,
      comment: "Muy buen estado, tal cual la foto.",
      createdAt: "2026-08-01T00:00:00.000Z",
      user: { id: "user1", name: "Usuario Uno" },
      product: { id: "product1", title: "Chaqueta de cuero" },
    },
    ...((overrides as Review[]) ?? []),
  ];
}

function paginatedResponse(reviews: Review[]) {
  return {
    data: reviews,
    meta: { total: reviews.length, page: 1, pages: 1 },
  };
}

describe("AdminReviewsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra un estado de carga y luego el listado de reseñas", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reviewsFixture()),
    });

    render(
      <TestProviders>
        <AdminReviewsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    expect(screen.getByText("Usuario Uno")).toBeInTheDocument();
    expect(
      screen.getByText("Muy buen estado, tal cual la foto."),
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/reviews/admin/all?page=1&limit=20");
  });

  it("muestra un estado vacío cuando no hay reseñas", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse([]) });

    render(
      <TestProviders>
        <AdminReviewsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("No hay reseñas")).toBeInTheDocument();
    });
  });

  it("elimina una reseña tras confirmar", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reviewsFixture()),
    });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminReviewsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/reviews/review1");
    });
  });

  it("no elimina la reseña si el administrador cancela la confirmación", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reviewsFixture()),
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminReviewsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    expect(api.delete).not.toHaveBeenCalled();
  });

  it("muestra un mensaje de error si falla la eliminación", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(reviewsFixture()),
    });
    vi.mocked(api.delete).mockRejectedValue(new Error("Falló la eliminación"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminReviewsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    await waitFor(() => {
      expect(screen.getByText("Falló la eliminación")).toBeInTheDocument();
    });
  });
});
