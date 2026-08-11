"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { onUnauthorized } from "./auth-events";
import { tokenStore } from "./token";
import type { AuthResponse, User } from "./types";

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, name: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

const PUBLIC_AUTH_PATHS = ["/login", "/signup"];

export async function fetchProfile(): Promise<User | null> {
  if (!tokenStore.get()) return null;
  try {
    const res = await api.get<User>("/users/me");
    return res.data;
  } catch {
    tokenStore.clear();
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const profile = await fetchProfile();
      if (mounted) {
        setUser(profile);
        setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Clears the in-memory user and the React Query cache (so no other
  // user's cached data lingers). Shared by logout() and the 401 handler
  // below; logout() additionally clears the stored token.
  const clearAuthState = useCallback(() => {
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // Subscribe to global 401 events. We avoid a full-page reload — instead we
  // clear the user and the React Query cache (so no other user's cached
  // data lingers) and route to /login.
  useEffect(() => {
    return onUnauthorized(() => {
      clearAuthState();
      const path =
        typeof window !== "undefined" ? window.location.pathname : "/";
      const isPublic = PUBLIC_AUTH_PATHS.some(
        (p) => path === p || path.startsWith(`${p}/`),
      );
      if (!isPublic) {
        router.push("/login");
      }
    });
  }, [router, clearAuthState]);

  const login = async (email: string, password: string) => {
    const res = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });
    tokenStore.set(res.data.access_token);
    setUser(res.data.user);
  };

  const signup = async (email: string, name: string, password: string) => {
    const res = await api.post<AuthResponse>("/auth/signup", {
      email,
      name,
      password,
    });
    tokenStore.set(res.data.access_token);
    setUser(res.data.user);
  };

  const logout = () => {
    tokenStore.clear();
    clearAuthState();
  };

  const refresh = async () => {
    const profile = await fetchProfile();
    setUser(profile);
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, login, signup, logout, refresh }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
