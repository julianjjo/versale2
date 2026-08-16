import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReportProductButton } from "../report-product-button";
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
    post: vi.fn(),
  },
  extractApiError: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

import { api } from "@/lib/api";

describe("ReportProductButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.isLoading = false;
  });

  it("redirige a iniciar sesión al hacer click sin sesión", async () => {
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ReportProductButton productId="p1" />
      </TestProviders>,
    );

    await user.click(
      screen.getByRole("button", { name: /reportar publicación/i }),
    );

    expect(pushMock).toHaveBeenCalledWith(
      "/login?next=%2Fproducts%2Fp1&reason=report",
    );
    expect(api.post).not.toHaveBeenCalled();
  });

  it("no redirige a iniciar sesión mientras la autenticación está cargando", async () => {
    authState.isLoading = true;
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ReportProductButton productId="p1" />
      </TestProviders>,
    );

    const button = screen.getByRole("button", { name: /reportar publicación/i });
    expect(button).toBeDisabled();
    await user.click(button);

    expect(pushMock).not.toHaveBeenCalled();
  });

  it("muestra el formulario al hacer click con sesión iniciada", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ReportProductButton productId="p1" />
      </TestProviders>,
    );

    await user.click(
      screen.getByRole("button", { name: /reportar publicación/i }),
    );

    expect(
      screen.getByLabelText(/por qué quieres reportar/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /enviar reporte/i }),
    ).toBeInTheDocument();
  });

  it("no permite enviar el formulario sin escribir un motivo", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ReportProductButton productId="p1" />
      </TestProviders>,
    );

    await user.click(
      screen.getByRole("button", { name: /reportar publicación/i }),
    );

    expect(screen.getByRole("button", { name: /enviar reporte/i })).toBeDisabled();
  });

  it("envía el reporte y muestra un mensaje de confirmación", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.post).mockResolvedValue({ data: { id: "report1" } });
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ReportProductButton productId="p1" />
      </TestProviders>,
    );

    await user.click(
      screen.getByRole("button", { name: /reportar publicación/i }),
    );
    await user.type(
      screen.getByLabelText(/por qué quieres reportar/i),
      "Parece una estafa",
    );
    await user.click(screen.getByRole("button", { name: /enviar reporte/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/reports", {
        productId: "p1",
        reason: "Parece una estafa",
      });
    });
    expect(
      await screen.findByText(/un administrador revisará esta publicación/i),
    ).toBeInTheDocument();
    // The form (and its "reportar publicación" toggle) is replaced by the
    // confirmation — nothing left to click to report the same listing again.
    expect(
      screen.queryByRole("button", { name: /reportar publicación/i }),
    ).not.toBeInTheDocument();
  });

  // Regression: the caller (ProductDetail) remounts this component via
  // `key={productId}` specifically so state from one product's report never
  // survives navigation to another — this proves that actually resets
  // everything (open form, typed reason, confirmation) rather than just some
  // of it.
  it("no conserva el estado de un producto anterior cuando se vuelve a montar para otro", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.post).mockResolvedValue({ data: { id: "report1" } });
    const user = userEvent.setup();
    const { rerender } = render(
      <TestProviders>
        <ReportProductButton key="p1" productId="p1" />
      </TestProviders>,
    );

    await user.click(
      screen.getByRole("button", { name: /reportar publicación/i }),
    );
    await user.type(
      screen.getByLabelText(/por qué quieres reportar/i),
      "Parece una estafa",
    );
    await user.click(screen.getByRole("button", { name: /enviar reporte/i }));
    await screen.findByText(/un administrador revisará esta publicación/i);

    rerender(
      <TestProviders>
        <ReportProductButton key="p2" productId="p2" />
      </TestProviders>,
    );

    expect(
      screen.queryByText(/un administrador revisará esta publicación/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /reportar publicación/i }),
    ).toBeInTheDocument();
  });

  it("no permite cancelar mientras el envío está en curso", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    let resolvePost!: () => void;
    vi.mocked(api.post).mockReturnValue(
      new Promise((resolve) => {
        resolvePost = () => resolve({ data: { id: "report1" } });
      }),
    );
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ReportProductButton productId="p1" />
      </TestProviders>,
    );

    await user.click(
      screen.getByRole("button", { name: /reportar publicación/i }),
    );
    await user.type(
      screen.getByLabelText(/por qué quieres reportar/i),
      "Motivo",
    );
    await user.click(screen.getByRole("button", { name: /enviar reporte/i }));

    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();

    resolvePost();
    await screen.findByText(/un administrador revisará esta publicación/i);
  });

  it("anuncia un error cuando falla el envío", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    vi.mocked(api.post).mockRejectedValue(new Error("No puedes reportar tu propio producto"));
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ReportProductButton productId="p1" />
      </TestProviders>,
    );

    await user.click(
      screen.getByRole("button", { name: /reportar publicación/i }),
    );
    await user.type(
      screen.getByLabelText(/por qué quieres reportar/i),
      "Motivo",
    );
    await user.click(screen.getByRole("button", { name: /enviar reporte/i }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(/no puedes reportar tu propio producto/i);
  });

  it("cierra el formulario al hacer click en cancelar", async () => {
    authState.user = { id: "u1", email: "a@b.c", name: "Alice", role: "USER" };
    const user = userEvent.setup();
    render(
      <TestProviders>
        <ReportProductButton productId="p1" />
      </TestProviders>,
    );

    await user.click(
      screen.getByRole("button", { name: /reportar publicación/i }),
    );
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(
      screen.queryByLabelText(/por qué quieres reportar/i),
    ).not.toBeInTheDocument();
  });
});
