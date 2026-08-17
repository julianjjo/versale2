import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  createTestQueryClient,
  TestProviders,
} from "@/test-utils/TestProviders";

vi.mock("../token", () => ({
  tokenStore: {
    get: vi.fn(),
    set: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("../api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
  extractApiError: vi.fn(),
}));

import { tokenStore } from "../token";
import { api } from "../api";
import { useAuth, fetchProfile } from "../auth";
import { notifyUnauthorized } from "../auth-events";

const mockedTokenStore = tokenStore as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

function wrapper({ children }: { children: ReactNode }) {
  return <TestProviders>{children}</TestProviders>;
}

describe("fetchProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no token is present", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    expect(await fetchProfile()).toBeNull();
  });

  it("returns the user when the api call succeeds", async () => {
    mockedTokenStore.get.mockReturnValue("tok");
    mockedApi.get.mockResolvedValue({
      data: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
    });
    expect(await fetchProfile()).toEqual({
      id: "u1",
      email: "a@b.c",
      name: "Alice",
      role: "USER",
    });
  });

  it("clears the token and returns null on failure", async () => {
    mockedTokenStore.get.mockReturnValue("stale");
    mockedApi.get.mockRejectedValue(new Error("401"));
    expect(await fetchProfile()).toBeNull();
    expect(mockedTokenStore.clear).toHaveBeenCalled();
  });
});

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with no user and loading true, then settles to null when no token", async () => {
    mockedTokenStore.get.mockReturnValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.user).toBeNull();
  });

  it("fetches the user profile on mount when a token is present", async () => {
    mockedTokenStore.get.mockReturnValue("token");
    mockedApi.get.mockResolvedValue({
      data: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockedApi.get).toHaveBeenCalledWith("/users/me");
    expect(result.current.user).toEqual({
      id: "u1",
      email: "a@b.c",
      name: "Alice",
      role: "USER",
    });
  });

  it("clears the token if profile fetch fails on mount", async () => {
    mockedTokenStore.get.mockReturnValue("bad-token");
    mockedApi.get.mockRejectedValue(new Error("401"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockedTokenStore.clear).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("login sets the token and user", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    mockedApi.get.mockResolvedValue({ data: null });
    mockedApi.post.mockResolvedValue({
      data: {
        access_token: "tok",
        user: { id: "u2", email: "x@y.z", name: "Bob", role: "USER" },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login("x@y.z", "secret123");
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/auth/login", {
      email: "x@y.z",
      password: "secret123",
    });
    expect(mockedTokenStore.set).toHaveBeenCalledWith("tok");
    expect(result.current.user).toEqual({
      id: "u2",
      email: "x@y.z",
      name: "Bob",
      role: "USER",
    });
  });

  it("login clears the React Query cache before adopting the new user", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    mockedApi.get.mockResolvedValue({ data: null });
    mockedApi.post.mockResolvedValue({
      data: {
        access_token: "tok",
        user: { id: "u2", email: "x@y.z", name: "Bob", role: "USER" },
      },
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["cart", "anonymous"], { dummy: true });
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    function localWrapper({ children }: { children: ReactNode }) {
      return <TestProviders client={queryClient}>{children}</TestProviders>;
    }

    const { result } = renderHook(() => useAuth(), { wrapper: localWrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.login("x@y.z", "secret123");
    });

    expect(queryClient.getQueryCache().getAll().length).toBe(0);
    expect(result.current.user).toEqual({
      id: "u2",
      email: "x@y.z",
      name: "Bob",
      role: "USER",
    });
  });

  it("signup sets the token and user", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    mockedApi.get.mockResolvedValue({ data: null });
    mockedApi.post.mockResolvedValue({
      data: {
        access_token: "tok2",
        user: { id: "u3", email: "s@t.u", name: "Sam", role: "USER" },
      },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signup("s@t.u", "Sam", "password");
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/auth/signup", {
      email: "s@t.u",
      name: "Sam",
      password: "password",
    });
    expect(mockedTokenStore.set).toHaveBeenCalledWith("tok2");
    expect(result.current.user?.name).toBe("Sam");
  });

  it("signup clears the React Query cache before adopting the new user", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    mockedApi.get.mockResolvedValue({ data: null });
    mockedApi.post.mockResolvedValue({
      data: {
        access_token: "tok2",
        user: { id: "u3", email: "s@t.u", name: "Sam", role: "USER" },
      },
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["favorites", "anonymous"], { dummy: true });
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    function localWrapper({ children }: { children: ReactNode }) {
      return <TestProviders client={queryClient}>{children}</TestProviders>;
    }

    const { result } = renderHook(() => useAuth(), { wrapper: localWrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.signup("s@t.u", "Sam", "password");
    });

    expect(queryClient.getQueryCache().getAll().length).toBe(0);
    expect(result.current.user?.name).toBe("Sam");
  });

  it("logout clears token and user", async () => {
    mockedTokenStore.get.mockReturnValue("tok");
    mockedApi.get.mockResolvedValue({
      data: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    act(() => result.current.logout());
    expect(mockedTokenStore.clear).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("logout clears the React Query cache", async () => {
    mockedTokenStore.get.mockReturnValue("tok");
    mockedApi.get.mockResolvedValue({
      data: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["cart", "u1"], { dummy: true });
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    function localWrapper({ children }: { children: ReactNode }) {
      return <TestProviders client={queryClient}>{children}</TestProviders>;
    }

    const { result } = renderHook(() => useAuth(), { wrapper: localWrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    act(() => result.current.logout());

    expect(queryClient.getQueryCache().getAll().length).toBe(0);
  });

  it("a global 401 also clears the React Query cache", async () => {
    mockedTokenStore.get.mockReturnValue("tok");
    mockedApi.get.mockResolvedValue({
      data: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
    });

    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["orders"], [{ id: "o1" }]);
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    function localWrapper({ children }: { children: ReactNode }) {
      return <TestProviders client={queryClient}>{children}</TestProviders>;
    }

    const { result } = renderHook(() => useAuth(), { wrapper: localWrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    act(() => {
      notifyUnauthorized();
    });

    expect(result.current.user).toBeNull();
    expect(queryClient.getQueryCache().getAll().length).toBe(0);
  });

  it("refresh re-fetches the user", async () => {
    mockedTokenStore.get.mockReturnValue("tok");
    mockedApi.get.mockResolvedValue({
      data: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
    });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());

    mockedApi.get.mockResolvedValueOnce({
      data: { id: "u1", email: "new@b.c", name: "Alice2", role: "ADMIN" },
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.user?.email).toBe("new@b.c");
    expect(result.current.user?.role).toBe("ADMIN");
  });

  it("throws when used outside of an AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});
