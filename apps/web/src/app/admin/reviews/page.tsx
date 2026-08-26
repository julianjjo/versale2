"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import Link from "next/link";
import { api, extractApiError } from "@/lib/api";
import { Spinner, Card, EmptyState, Button, StarRating } from "@/components/ui";
import { Pager } from "@/components/admin/pager";
import type { Review } from "@/lib/types";
import { useState } from "react";

export default function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["admin-reviews", page],
    queryFn: async ({ signal }) => {
      const res = await api.get<{
        data: Review[];
        meta: { total: number; page: number; pages: number };
      }>(`/reviews/admin/all?page=${page}&limit=20`, { signal });
      return res.data;
    },
    // Igual que en las otras listas del panel: se conserva la página anterior
    // en pantalla mientras llega la siguiente en vez de vaciarla.
    placeholderData: keepPreviousData,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/reviews/${id}`);
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      // The /admin dashboard's "Reseñas totales" card reads a differently-
      // named key (["admin-reviews-count"]) for the same count a deletion
      // here just changed — invalidating only ["admin-reviews"] never
      // touched it.
      queryClient.invalidateQueries({ queryKey: ["admin-reviews-count"] });
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar la reseña")),
  });

  const reviews = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <h1 className="heading-section mb-4 text-text-primary">
        Todas las reseñas
      </h1>

      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      ) : isError ? (
        <EmptyState title="No pudimos cargar las reseñas" />
      ) : reviews.length === 0 ? (
        <EmptyState title="No hay reseñas" />
      ) : (
        <div className="space-y-3" aria-busy={isFetching}>
          {reviews.map((review) => (
            <Card key={review.id}>
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  {review.product ? (
                    <Link
                      href={`/products/${review.product.id}?preview=1`}
                      className="block truncate font-medium text-text-primary hover:underline"
                    >
                      {review.product.title}
                    </Link>
                  ) : (
                    <p className="truncate font-medium text-text-primary">
                      Producto eliminado
                    </p>
                  )}
                  <p className="mt-1 text-xs text-text-muted">
                    {review.user?.name ?? "Usuario eliminado"}
                  </p>
                  <div className="mt-1">
                    <StarRating value={review.rating} />
                  </div>
                  {review.comment && (
                    <p className="mt-2 text-sm text-text-primary">
                      {review.comment}
                    </p>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm("¿Eliminar esta reseña?")) {
                      remove.mutate(review.id);
                    }
                  }}
                  disabled={remove.isPending}
                >
                  Eliminar
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pager
        page={page}
        pages={meta?.pages ?? 0}
        isFetching={isFetching}
        onPageChange={setPage}
      />
    </div>
  );
}
