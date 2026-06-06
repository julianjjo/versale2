import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

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
import { useAuth } from "../auth";

const mockedTokenStore = tokenStore as unknown as {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
};

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts with no user and loading true, then settles to user-null when no token", async () => {
    mockedTokenStore.get.mockReturnValue(null);

    const { result } = renderHook(() => useAuth());

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

    const { result } = renderHook(() => useAuth());

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

  it("clears the token if profile fetch fails", async () => {
    mockedTokenStore.get.mockReturnValue("bad-token");
    mockedApi.get.mockRejectedValue(new Error("401"));

    const { result } = renderHook(() => useAuth());

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

    const { result } = renderHook(() => useAuth());
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

  it("signup sets the token and user", async () => {
    mockedTokenStore.get.mockReturnValue(null);
    mockedApi.get.mockResolvedValue({ data: null });
    mockedApi.post.mockResolvedValue({
      data: {
        access_token: "tok2",
        user: { id: "u3", email: "s@t.u", name: "Sam", role: "USER" },
      },
    });

    const { result } = renderHook(() => useAuth());
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

  it("logout clears token and user", async () => {
    mockedTokenStore.get.mockReturnValue("tok");
    mockedApi.get.mockResolvedValue({
      data: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
    });

    const { result } = renderHook(() => useAuth());
    await waitFor(() => expect(result.current.user).not.toBeNull());

    act(() => result.current.logout());
    expect(mockedTokenStore.clear).toHaveBeenCalled();
    expect(result.current.user).toBeNull();
  });

  it("refresh re-fetches the user", async () => {
    mockedTokenStore.get.mockReturnValue("tok");
    mockedApi.get.mockResolvedValue({
      data: { id: "u1", email: "a@b.c", name: "Alice", role: "USER" },
    });

    const { result } = renderHook(() => useAuth());
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
});
