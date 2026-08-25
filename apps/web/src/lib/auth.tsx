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

// Shared by every "this action needs an account" entry point on a product
// page (favoriting, reviewing, reporting a listing) so the redirect URL's
// shape — and where the visitor lands back on after logging in — can't
// drift between them the way three independently hand-built copies would.
export function loginRedirectUrl(productId: string, reason: string): string {
  return `/login?next=${encodeURIComponent(`/products/${productId}`)}&reason=${reason}`;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    name: string,
    password: string,
    acceptedTerms: boolean,
  ) => Promise<void>;
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
        // Same `next`/`reason` shape loginRedirectUrl already uses elsewhere
        // (favoriting, reviewing) — without them this bounced the visitor to
        // a bare /login with no explanation and no way back to what they
        // were doing (e.g. mid-checkout on /cart).
        router.push(
          `/login?next=${encodeURIComponent(path)}&reason=expired`,
        );
      }
    });
  }, [router, clearAuthState]);

  // A logout (or token expiry) in ANOTHER tab must not leave this tab
  // believing it's still signed in: without this, a stale tab keeps
  // rendering account-only UI and will only discover the session is gone
  // when its next request 401s — by then whatever the visitor was doing here
  // (e.g. filling out /cart's shipping address) is lost with no warning.
  // tokenStore now emits same-tab CustomEvent + BroadcastChannel, so this
  // also covers a clear() done in this tab without a 401 cycle.
  useEffect(() => {
    return tokenStore.subscribe(() => {
      if (!tokenStore.get()) clearAuthState();
    });
  }, [clearAuthState]);

  // Shared by login() and signup(): drops any queries cached under the
  // previous (possibly anonymous or different-user) session before adopting
  // the new one.
  const adoptSession = useCallback(
    (data: AuthResponse) => {
      queryClient.clear();
      tokenStore.set(data.access_token);
      setUser(data.user);
    },
    [queryClient],
  );

  const login = async (email: string, password: string) => {
    const res = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });
    adoptSession(res.data);
  };

  const signup = async (
    email: string,
    name: string,
    password: string,
    acceptedTerms: boolean,
  ) => {
    const res = await api.post<AuthResponse>("/auth/signup", {
      email,
      name,
      password,
      acceptedTerms,
    });
    adoptSession(res.data);
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
