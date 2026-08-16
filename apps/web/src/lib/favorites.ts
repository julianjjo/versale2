import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import { useAuth } from "./auth";
import type { Favorite, PaginatedResponse } from "./types";

// GET /favorites is paginated like every other list endpoint; the favoritos
// page and the heart-icon membership check below have no pager UI, so this
// asks for the API's max page size to keep showing everything a buyer has
// favorited instead of silently truncating to the default page size.
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

// Every `ProductCard` in a grid renders its own heart, so this is called once
// per card — react-query dedupes them all onto one shared query, and this
// just reshapes the result for an O(1) membership check instead of every
// card scanning the whole list. Backed by GET /favorites/ids rather than the
// full `useFavorites()` list above: a heart icon only ever needs a productId
// set, never the product details or rating enrichment the Favoritos page
// renders, so sharing that heavier endpoint would pay for a product join and
// a review aggregate on every page that has so much as one heart icon.
export function useFavoriteProductIds(): Set<string> {
  const { user } = useAuth();
  const { data } = useQuery<{ productIds: string[] }>({
    queryKey: ["favorite-ids"],
    queryFn: async () => {
      const response = await api.get<{ productIds: string[] }>(
        "/favorites/ids",
      );
      return response.data;
    },
    enabled: Boolean(user),
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
