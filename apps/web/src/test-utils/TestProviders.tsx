import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

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
  return <QueryClientProvider client={c}>{children}</QueryClientProvider>;
}
