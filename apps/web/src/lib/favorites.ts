import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type { Favorite } from "./types";

export function useFavorites() {
  const { user } = useAuth();
  return useQuery<Favorite[]>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const response = await api.get<Favorite[]>("/favorites");
      return response.data;
    },
    enabled: Boolean(user),
  });
}

// Every `ProductCard` in a grid renders its own heart, so this is called once
// per card — react-query dedupes them all onto the single `["favorites"]`
// query above, and this just reshapes the result for an O(1) membership
// check instead of every card scanning the whole list.
export function useFavoriteProductIds(): Set<string> {
  const { data } = useFavorites();
  return useMemo(
    () => new Set((data ?? []).map((favorite) => favorite.productId)),
    [data],
  );
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
    },
  });
}
