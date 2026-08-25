import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type { Favorite, PaginatedResponse } from "./types";

const FAVORITES_PAGE_LIMIT = 100;

export function useFavorites() {
  const { user } = useAuth();
  return useQuery<PaginatedResponse<Favorite>>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Favorite>>(
        `/favorites?limit=${FAVORITES_PAGE_LIMIT}`,
      );
      return response.data;
    },
    enabled: Boolean(user),
  });
}

export function useFavoriteProductIds(options?: { enabled?: boolean }): Set<string> {
  const { user } = useAuth();
  const { data } = useQuery<{ productIds: string[] }>({
    queryKey: ["favorite-ids"],
    queryFn: async () => {
      const response = await api.get<{ productIds: string[] }>(
        "/favorites/ids",
      );
      return response.data;
    },
    enabled: Boolean(user) && (options?.enabled ?? true),
  });
  return useMemo(() => new Set(data?.productIds ?? []), [data]);
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      productId,
      isFavorite,
    }: {
      productId: string;
      isFavorite: boolean;
    }) => {
      if (isFavorite) {
        await api.delete(`/favorites/${productId}`);
      } else {
        await api.post(`/favorites/${productId}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
    },
  });
}
