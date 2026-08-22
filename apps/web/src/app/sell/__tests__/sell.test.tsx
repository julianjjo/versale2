import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SellPage from "../page";
import { TestProviders } from "@/test-utils/TestProviders";

const pushMock = vi.fn();

// Backing store for useSearchParams — individual tests point it at
// "Publicar otro igual" query strings before rendering.
let mockQuery: Record<string, string> = {};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, refresh: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => ({
    get: (key: string) => mockQuery[key] ?? null,
  }),
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
    mockQuery = {};
  });

  it("precarga título, categoría y talla desde los query params (Publicar otro igual)", async () => {
    mockQuery = { title: "Jean Levi's 501 ", category: "Jeans", size: "L" };
    renderPage();

    expect(
      await screen.findByLabelText(/^título$/i),
    ).toHaveValue("Jean Levi's 501");
    expect(screen.getByLabelText(/^categoría$/i)).toHaveValue("Jeans");
    expect(screen.getByLabelText(/^talla$/i)).toHaveValue("L");
  });

  it("ignora una talla precargada fuera de la lista fija en vez de dejar un valor invisible", async () => {
    mockQuery = { title: "Chaqueta", category: "Chaquetas", size: "XXXL" };
    renderPage();

    expect(
      await screen.findByLabelText(/^título$/i),
    ).toHaveValue("Chaqueta");
    // The select stays on its empty placeholder rather than holding a value
    // it cannot display.
    expect(screen.getByLabelText(/^talla$/i)).toHaveValue("");
  });

  it("normaliza una categoría precargada fuera de la lista cerrada a Otros", async () => {
    // Item 5: legacy categories ("Jackets") or typos must not leave the
    // select holding a value it cannot display — same backfill rule the API
    // applies to existing rows.
    mockQuery = { title: "Chaqueta", category: "Jackets", size: "M" };
    renderPage();

    expect(await screen.findByLabelText(/^categoría$/i)).toHaveValue("Otros");
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
    // La publicación queda bloqueada mientras haya fotos fallidas, así que el
    // aviso debe decir eso y no ofrecer publicar sin ellas.
    expect(alert).toHaveTextContent(/no puedes publicar hasta resolverlas/i);

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

    // Item 4: la publicación exige descripción (alt) por foto.
    await user.type(
      screen.getByLabelText(/descripción de la foto 1/i),
      "Frente de la chaqueta",
    );
    await user.click(screen.getByRole("button", { name: /publicar producto/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({
          title: "Chaqueta de jean",
          images: [
            { url: "https://cdn.versale/foto.jpg", alt: "Frente de la chaqueta" },
          ],
        }),
      );
    });
    expect(pushMock).toHaveBeenCalledWith("/products?published=1");
  });

  it("bloquea la publicación si falta la descripción de una foto", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        data: { images: [{ url: "https://cdn.versale/foto.jpg", key: "k1" }] },
      });
    renderPage();

    await user.upload(screen.getByLabelText(/imágenes/i), photo());
    await screen.findByRole("button", { name: /publicar producto/i });

    await fillListing(user);
    await user.click(screen.getByRole("button", { name: /publicar producto/i }));

    expect(
      await screen.findByText(/describe la foto que falta/i),
    ).toBeInTheDocument();
    expect(vi.mocked(api.post).mock.calls.some(([url]) => url === "/products")).toBe(
      false,
    );
    expect(pushMock).not.toHaveBeenCalled();
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
