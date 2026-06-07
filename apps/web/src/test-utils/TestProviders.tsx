import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function TestProviders({
  children,
  client,
}: {
  children: ReactNode;
  client?: QueryClient;
}) {
  const c = client ?? createTestQueryClient();
  return (
    <QueryClientProvider client={c}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
