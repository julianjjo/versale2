import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SellPage from "../page";
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
  },
  isLoading: false,
  login: async () => {},
  signup: async () => {},
  logout: () => {},
  refresh: async () => {},
};

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, useAuth: () => authState };
});

vi.mock("@/lib/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  extractApiError: (_err: unknown, fallback: string) => fallback,
}));

import { api } from "@/lib/api";

// jsdom implements neither of these.
Object.defineProperty(URL, "createObjectURL", {
  value: vi.fn(() => "blob:preview"),
  writable: true,
});
Object.defineProperty(URL, "revokeObjectURL", {
  value: vi.fn(),
  writable: true,
});

function photo(name = "foto.jpg") {
  return new File(["binario"], name, { type: "image/jpeg" });
}

function renderPage() {
  return render(
    <TestProviders>
      <SellPage />
    </TestProviders>,
  );
}

async function fillListing(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^título$/i), "Chaqueta de jean");
  await user.type(screen.getByLabelText(/^descripción$/i), "En buen estado.");
  await user.type(screen.getByLabelText(/^categoría$/i), "Chaquetas");
  await user.selectOptions(screen.getByLabelText(/^talla$/i), "M");
  await user.type(screen.getByLabelText(/precio/i), "80000");
}

describe("SellPage — subida de imágenes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra un mensaje en español cuando la subida falla, no el del backend", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { status: 500, data: { message: "R2 bucket is not configured" } },
    });
    renderPage();

    await user.upload(screen.getByLabelText(/imágenes/i), photo());

    expect(
      await screen.findByText("El servicio de imágenes no está disponible."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/R2 bucket is not configured/i)).toBeNull();
  });

  it("bloquea la publicación mientras haya fotos que fallaron", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockRejectedValueOnce({ response: { status: 500 } });
    renderPage();

    await user.upload(screen.getByLabelText(/imágenes/i), photo());
    await screen.findByText("El servicio de imágenes no está disponible.");

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/una foto no se subió/i);
    expect(alert).toHaveTextContent(/aparecería sin esas fotos/i);

    const submit = screen.getByRole("button", { name: /publicar producto/i });
    expect(submit).toBeDisabled();

    await fillListing(user);
    await user.click(submit);

    // Only the upload attempt happened — the listing was never created.
    expect(vi.mocked(api.post).mock.calls).toHaveLength(1);
    expect(vi.mocked(api.post).mock.calls[0][0]).toBe("/uploads/images");
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("permite reintentar la subida y publicar con la foto ya subida", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post)
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({
        data: { images: [{ url: "https://cdn.versale/foto.jpg", key: "k1" }] },
      })
      .mockResolvedValueOnce({ data: { id: "p1" } });
    renderPage();

    await user.upload(screen.getByLabelText(/imágenes/i), photo());
    const retry = await screen.findByRole("button", {
      name: /reintentar la subida de foto\.jpg/i,
    });

    await fillListing(user);
    await user.click(retry);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /publicar producto/i }),
      ).toBeEnabled();
    });

    await user.click(screen.getByRole("button", { name: /publicar producto/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          title: "Chaqueta de jean",
          images: ["https://cdn.versale/foto.jpg"],
        }),
      );
    });
    expect(pushMock).toHaveBeenCalledWith("/products?published=1");
  });

  it("permite quitar la foto fallida y publicar sin imágenes", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post)
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({ data: { id: "p1" } });
    renderPage();

    await user.upload(screen.getByLabelText(/imágenes/i), photo());
    await screen.findByText("El servicio de imágenes no está disponible.");

    await fillListing(user);
    await user.click(screen.getByRole("button", { name: /quitar foto\.jpg/i }));

    const submit = screen.getByRole("button", { name: /publicar producto/i });
    await waitFor(() => expect(submit).toBeEnabled());
    await user.click(submit);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({ title: "Chaqueta de jean", images: undefined }),
      );
    });
  });
});
