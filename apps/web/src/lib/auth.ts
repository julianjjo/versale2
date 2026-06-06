"use client";

import { useEffect, useState } from "react";
import { api } from "./api";
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

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (): Promise<User | null> => {
    if (!tokenStore.get()) return null;
    try {
      const res = await api.get<User>("/users/me");
      return res.data;
    } catch {
      tokenStore.clear();
      return null;
    }
  };

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
    setUser(null);
  };

  const refresh = async () => {
    const profile = await fetchProfile();
    setUser(profile);
  };

  return { user, isLoading, login, signup, logout, refresh };
}
