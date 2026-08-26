import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminQuestionsPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";
import type { ProductQuestion } from "@/lib/types";

vi.mock("@/lib/api", () => ({
  api: {
    get: vi.fn(),
    delete: vi.fn(),
  },
  extractApiError: (err: unknown) =>
    err instanceof Error ? err.message : "Ocurrió un error. Intenta de nuevo.",
}));

import { api } from "@/lib/api";

function questionsFixture(
  overrides?: Partial<ProductQuestion>[],
): ProductQuestion[] {
  return [
    {
      id: "question1",
      productId: "product1",
      askerId: "user1",
      question: "¿Esta chaqueta tiene manchas?",
      answer: null,
      answeredAt: null,
      createdAt: "2026-08-01T00:00:00.000Z",
      asker: { id: "user1", name: "Usuario Uno" },
      product: { id: "product1", title: "Chaqueta de cuero" },
    },
    ...((overrides as ProductQuestion[]) ?? []),
  ];
}

function paginatedResponse(
  questions: ProductQuestion[],
  meta?: Partial<{ page: number; pages: number }>,
) {
  return {
    data: questions,
    meta: { total: questions.length, page: 1, pages: 1, ...meta },
  };
}

describe("AdminQuestionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el listado de preguntas con el producto y quién preguntó", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(questionsFixture()),
    });

    render(
      <TestProviders>
        <AdminQuestionsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    expect(screen.getByText(/usuario uno/i)).toBeInTheDocument();
    expect(
      screen.getByText("¿Esta chaqueta tiene manchas?"),
    ).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/questions/admin/all?page=1&limit=20", expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("muestra la respuesta del vendedor cuando la pregunta ya fue contestada", async () => {
    const answered = questionsFixture();
    answered[0] = {
      ...answered[0]!,
      answer: "No, está impecable.",
      answeredAt: "2026-08-02T00:00:00.000Z",
    };
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(answered),
    });

    render(
      <TestProviders>
        <AdminQuestionsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText(/no, está impecable/i)).toBeInTheDocument();
    });
  });

  it("muestra un estado vacío cuando no hay preguntas", async () => {
    vi.mocked(api.get).mockResolvedValue({ data: paginatedResponse([]) });

    render(
      <TestProviders>
        <AdminQuestionsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("No hay preguntas")).toBeInTheDocument();
    });
  });

  it("muestra un estado de error si falla la carga, sin confundirlo con la lista vacía", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("network down"));

    render(
      <TestProviders>
        <AdminQuestionsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("No pudimos cargar las preguntas"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("No hay preguntas")).not.toBeInTheDocument();
  });

  it("muestra 'Producto eliminado' cuando el producto ya no existe", async () => {
    const questions = questionsFixture();
    questions[0] = { ...questions[0]!, product: undefined };
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(questions),
    });

    render(
      <TestProviders>
        <AdminQuestionsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Producto eliminado")).toBeInTheDocument();
    });
  });

  it("pide la página siguiente al hacer clic en Siguiente", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(questionsFixture(), { page: 1, pages: 2 }),
    });
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminQuestionsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /siguiente/i }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/questions/admin/all?page=2&limit=20", expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });
  });

  it("elimina una pregunta tras confirmar", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(questionsFixture()),
    });
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminQuestionsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/questions/question1");
    });
  });

  it("no elimina una pregunta si se cancela la confirmación", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(questionsFixture()),
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminQuestionsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    expect(api.delete).not.toHaveBeenCalled();
  });

  it("muestra un error cuando falla al eliminar una pregunta", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: paginatedResponse(questionsFixture()),
    });
    vi.mocked(api.delete).mockRejectedValue(
      new Error("No se encontró la pregunta con ID question1"),
    );
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    render(
      <TestProviders>
        <AdminQuestionsPage />
      </TestProviders>,
    );

    await waitFor(() => {
      expect(screen.getByText("Chaqueta de cuero")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /eliminar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no se encontró la pregunta/i,
    );
  });
});
