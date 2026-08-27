import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "@/test-utils/TestProviders";
import { SellerProfileContent } from "../seller-profile-content";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "seller1" }),
  usePathname: () => "/vendedores/seller1",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    get: vi
      .fn()
      .mockResolvedValue({
        data: { data: [], meta: { total: 0, page: 1, pages: 0 } },
      }),
  },
  extractApiError: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

describe("SellerProfileContent", () => {
  it("muestra Miembro desde en es-CO UTC determinista", async () => {
    render(
      <TestProviders>
        <SellerProfileContent
          initialProfile={{
            id: "seller1",
            name: "Ana Gómez",
            memberSince: "2022-03-15T10:00:00Z",
            activeListings: 3,
          }}
        />
      </TestProviders>,
    );

    expect(await screen.findByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText(/Miembro desde marzo de 2022/)).toBeInTheDocument();
    expect(screen.getByText(/3 publicaciones activas/)).toBeInTheDocument();
  });
});
