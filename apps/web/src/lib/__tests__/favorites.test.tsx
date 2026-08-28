import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  TestProviders,
  createTestQueryClient,
} from "@/test-utils/TestProviders";

vi.mock("../api", () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));
vi.mock("../auth", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, useAuth: vi.fn() };
});

import { api } from "../api";
import { useAuth } from "../auth";
import {
  useFavorites,
  useFavoriteProductIds,
  useToggleFavorite,
  FAVORITES_PAGE_LIMIT,
} from "../favorites";

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};
const mockedUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

function wrapper({ children }: { children: ReactNode }) {
  return <TestProviders>{children}</TestProviders>;
}

describe("favorites lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useFavorites", () => {
    it("fetches favorites when user present", async () => {
      mockedUseAuth.mockReturnValue({ user: { id: "u1" } });
      mockedApi.get.mockResolvedValue({ data: { items: [], total: 0 } });
      const { result } = renderHook(() => useFavorites(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockedApi.get).toHaveBeenCalledWith(
        expect.stringContaining("/favorites?limit=100"),
        expect.any(Object),
      );
    });

    it("disables query when no user", () => {
      mockedUseAuth.mockReturnValue({ user: null });
      const { result } = renderHook(() => useFavorites(), { wrapper });
      expect(result.current.fetchStatus).toBe("idle");
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe("useFavoriteProductIds", () => {
    it("returns Set from ids", async () => {
      mockedUseAuth.mockReturnValue({ user: { id: "u1" } });
      mockedApi.get.mockResolvedValue({ data: { productIds: ["p1", "p2"] } });
      const { result } = renderHook(() => useFavoriteProductIds(), { wrapper });
      await waitFor(() => expect(result.current.size).toBe(2));
      expect(result.current.has("p1")).toBe(true);
    });

    it("returns empty Set when no user", () => {
      mockedUseAuth.mockReturnValue({ user: null });
      const { result } = renderHook(() => useFavoriteProductIds(), {
        wrapper,
      });
      expect(result.current.size).toBe(0);
    });

    it("respects enabled:false option", () => {
      mockedUseAuth.mockReturnValue({ user: { id: "u1" } });
      const { result } = renderHook(
        () => useFavoriteProductIds({ enabled: false }),
        { wrapper },
      );
      expect(result.current.size).toBe(0);
      expect(mockedApi.get).not.toHaveBeenCalled();
    });
  });

  describe("useToggleFavorite", () => {
    it("posts when not favorite and deletes when favorite", async () => {
      mockedUseAuth.mockReturnValue({ user: { id: "u1" } });
      mockedApi.post.mockResolvedValue({});
      mockedApi.delete.mockResolvedValue({});
      const qc = createTestQueryClient();
      const wrapperWithClient = ({ children }: { children: ReactNode }) => (
        <TestProviders client={qc}>{children}</TestProviders>
      );
      const { result } = renderHook(() => useToggleFavorite(), {
        wrapper: wrapperWithClient,
      });
      await result.current.mutateAsync({ productId: "p1", isFavorite: false });
      expect(mockedApi.post).toHaveBeenCalledWith("/favorites/p1");
      await result.current.mutateAsync({ productId: "p1", isFavorite: true });
      expect(mockedApi.delete).toHaveBeenCalledWith("/favorites/p1");
    });

    it("trims and encodes padded productId", async () => {
      mockedApi.post.mockResolvedValue({});
      mockedApi.delete.mockResolvedValue({});
      const qc = createTestQueryClient();
      const wrapperWithClient = ({ children }: { children: ReactNode }) => (
        <TestProviders client={qc}>{children}</TestProviders>
      );
      const { result } = renderHook(() => useToggleFavorite(), {
        wrapper: wrapperWithClient,
      });
      await result.current.mutateAsync({
        productId: "  p1  ",
        isFavorite: false,
      });
      expect(mockedApi.post).toHaveBeenCalledWith("/favorites/p1");
      await result.current.mutateAsync({
        productId: "  p1  ",
        isFavorite: true,
      });
      expect(mockedApi.delete).toHaveBeenCalledWith("/favorites/p1");
    });

    it("encodes special characters in productId", async () => {
      mockedApi.post.mockResolvedValue({});
      const qc = createTestQueryClient();
      const wrapperWithClient = ({ children }: { children: ReactNode }) => (
        <TestProviders client={qc}>{children}</TestProviders>
      );
      const { result } = renderHook(() => useToggleFavorite(), {
        wrapper: wrapperWithClient,
      });
      await result.current.mutateAsync({
        productId: "a/b c",
        isFavorite: false,
      });
      expect(mockedApi.post).toHaveBeenCalledWith("/favorites/a%2Fb%20c");
    });

    it("does not call api for whitespace-only productId", async () => {
      const qc = createTestQueryClient();
      const wrapperWithClient = ({ children }: { children: ReactNode }) => (
        <TestProviders client={qc}>{children}</TestProviders>
      );
      const { result } = renderHook(() => useToggleFavorite(), {
        wrapper: wrapperWithClient,
      });
      await result.current.mutateAsync({ productId: "   ", isFavorite: false });
      expect(mockedApi.post).not.toHaveBeenCalled();
      await result.current.mutateAsync({ productId: "   ", isFavorite: true });
      expect(mockedApi.delete).not.toHaveBeenCalled();
    });

    it("invalidates queries on success", async () => {
      mockedApi.post.mockResolvedValue({});
      const qc = createTestQueryClient();
      const spy = vi.spyOn(qc, "invalidateQueries");
      const wrapperWithClient = ({ children }: { children: ReactNode }) => (
        <TestProviders client={qc}>{children}</TestProviders>
      );
      const { result } = renderHook(() => useToggleFavorite(), {
        wrapper: wrapperWithClient,
      });
      await result.current.mutateAsync({ productId: "p1", isFavorite: false });
      expect(spy).toHaveBeenCalledWith({ queryKey: ["favorites"] });
      expect(spy).toHaveBeenCalledWith({ queryKey: ["favorite-ids"] });
    });
  });

  it("exports FAVORITES_PAGE_LIMIT as 100", () => {
    expect(FAVORITES_PAGE_LIMIT).toBe(100);
  });
});
