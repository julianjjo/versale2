import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ProductQuestions } from "../product-questions";
import { TestProviders } from "@/test-utils/TestProviders";
import type { ProductQuestion } from "@/lib/types";

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
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  extractApiError: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

import { api } from "@/lib/api";

function questionFixture(overrides: Partial<ProductQuestion> = {}): ProductQuestion {
  return {
    id: "q1",
    productId: "p1",
    askerId: "buyer1",
    question: "¿Es talla M o L?",
    answer: null,
    answeredAt: null,
    createdAt: new Date("2026-01-10T10:00:00Z").toISOString(),
    asker: { id: "buyer1", name: "Alice" },
    ...overrides,
  };
}

describe("ProductQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = false;
  });

  it("muestra 'Aún no hay preguntas' cuando la lista está vacía", () => {
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[]}
        />
      </TestProviders>,
    );

    expect(screen.getByText(/aún no hay preguntas/i)).toBeInTheDocument();
  });

  it("muestra las preguntas existentes junto con la respuesta del vendedor", () => {
    const answered = questionFixture({
      question: "¿Tiene manchas?",
      answer: "No, está impecable",
    });
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[answered]}
        />
      </TestProviders>,
    );

    expect(screen.getByText("¿Tiene manchas?")).toBeInTheDocument();
    expect(screen.getByText("No, está impecable")).toBeInTheDocument();
    expect(screen.getByText(/alice preguntó/i)).toBeInTheDocument();
  });

  it("muestra el formulario para preguntar a un comprador con sesión iniciada", () => {
    authState.user = { id: "buyer2", email: "a@b.c", name: "Bob", role: "USER" };
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[]}
        />
      </TestProviders>,
    );

    expect(
      screen.getByRole("button", { name: /enviar pregunta/i }),
    ).toBeInTheDocument();
  });

  it("no muestra el formulario de preguntar al propio vendedor", () => {
    authState.user = { id: "seller1", email: "a@b.c", name: "Seller", role: "USER" };
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={true}
          isApproved={true}
          questions={[]}
        />
      </TestProviders>,
    );

    expect(
      screen.queryByRole("button", { name: /enviar pregunta/i }),
    ).not.toBeInTheDocument();
  });

  it("no muestra el formulario de preguntar sin sesión iniciada", () => {
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[]}
        />
      </TestProviders>,
    );

    expect(
      screen.queryByRole("button", { name: /enviar pregunta/i }),
    ).not.toBeInTheDocument();
  });

  it("no muestra el formulario de preguntar si el producto no está aprobado", () => {
    authState.user = { id: "buyer2", email: "a@b.c", name: "Bob", role: "USER" };
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={false}
          questions={[]}
        />
      </TestProviders>,
    );

    expect(
      screen.queryByRole("button", { name: /enviar pregunta/i }),
    ).not.toBeInTheDocument();
  });

  it("envía una pregunta y limpia el formulario", async () => {
    authState.user = { id: "buyer2", email: "a@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.post).mockResolvedValue({ data: { id: "q2" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[]}
        />
      </TestProviders>,
    );

    const textarea = screen.getByLabelText(/tu pregunta para el vendedor/i);
    await user.type(textarea, "¿Incluye envío?");
    await user.click(screen.getByRole("button", { name: /enviar pregunta/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/questions", {
        productId: "p1",
        question: "¿Incluye envío?",
      });
    });
    await waitFor(() => {
      expect(textarea).toHaveValue("");
    });
  });

  it("no permite enviar una pregunta en blanco", () => {
    authState.user = { id: "buyer2", email: "a@b.c", name: "Bob", role: "USER" };
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[]}
        />
      </TestProviders>,
    );

    expect(
      screen.getByRole("button", { name: /enviar pregunta/i }),
    ).toBeDisabled();
  });

  it("anuncia un error cuando falla el envío de la pregunta", async () => {
    authState.user = { id: "buyer2", email: "a@b.c", name: "Bob", role: "USER" };
    vi.mocked(api.post).mockRejectedValue(new Error("El producto no está disponible para preguntas"));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[]}
        />
      </TestProviders>,
    );

    await user.type(
      screen.getByLabelText(/tu pregunta para el vendedor/i),
      "¿Incluye envío?",
    );
    await user.click(screen.getByRole("button", { name: /enviar pregunta/i }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/no está disponible para preguntas/i);
  });

  it("el vendedor puede responder una pregunta sin respuesta", async () => {
    authState.user = { id: "seller1", email: "a@b.c", name: "Seller", role: "USER" };
    vi.mocked(api.patch).mockResolvedValue({ data: { id: "q1", answer: "Es talla M" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={true}
          isApproved={true}
          questions={[questionFixture()]}
        />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: /^responder$/i }));
    await user.type(screen.getByLabelText(/tu respuesta/i), "Es talla M");
    await user.click(screen.getByRole("button", { name: /guardar respuesta/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/questions/q1/answer", {
        answer: "Es talla M",
      });
    });
  });

  it("el vendedor puede editar una respuesta ya publicada", async () => {
    authState.user = { id: "seller1", email: "a@b.c", name: "Seller", role: "USER" };
    vi.mocked(api.patch).mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={true}
          isApproved={true}
          questions={[questionFixture({ answer: "Es talla M" })]}
        />
      </TestProviders>,
    );

    await user.click(screen.getByRole("button", { name: /editar respuesta/i }));
    const textarea = screen.getByLabelText(/tu respuesta/i);
    expect(textarea).toHaveValue("Es talla M");
    await user.clear(textarea);
    await user.type(textarea, "Es talla L");
    await user.click(screen.getByRole("button", { name: /guardar respuesta/i }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/questions/q1/answer", {
        answer: "Es talla L",
      });
    });
  });

  it("no muestra el botón de responder a un comprador que no es el vendedor", () => {
    authState.user = { id: "buyer2", email: "a@b.c", name: "Bob", role: "USER" };
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[questionFixture()]}
        />
      </TestProviders>,
    );

    expect(
      screen.queryByRole("button", { name: /responder/i }),
    ).not.toBeInTheDocument();
  });

  it("el autor de la pregunta puede eliminarla tras confirmar", async () => {
    authState.user = { id: "buyer1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.delete).mockResolvedValue({ data: { success: true } });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[questionFixture()]}
        />
      </TestProviders>,
    );

    try {
      await user.click(screen.getByRole("button", { name: /eliminar/i }));
      await waitFor(() => {
        expect(api.delete).toHaveBeenCalledWith("/questions/q1");
      });
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("no elimina la pregunta si se cancela la confirmación", async () => {
    authState.user = { id: "buyer1", email: "a@b.c", name: "Alice", role: "USER" };
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[questionFixture()]}
        />
      </TestProviders>,
    );

    try {
      await user.click(screen.getByRole("button", { name: /eliminar/i }));
      expect(api.delete).not.toHaveBeenCalled();
    } finally {
      confirmSpy.mockRestore();
    }
  });

  it("no muestra el botón de eliminar a otro comprador que no hizo la pregunta", () => {
    authState.user = { id: "someoneElse", email: "a@b.c", name: "Carla", role: "USER" };
    render(
      <TestProviders>
        <ProductQuestions
          productId="p1"
          isOwn={false}
          isApproved={true}
          questions={[questionFixture()]}
        />
      </TestProviders>,
    );

    expect(
      screen.queryByRole("button", { name: /eliminar/i }),
    ).not.toBeInTheDocument();
  });
});
