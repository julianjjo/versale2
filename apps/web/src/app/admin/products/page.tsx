"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Button,
  Price,
} from "@/components/ui";
import type { Product } from "@/lib/types";
import { useState } from "react";
import Link from "next/link";

const CONDITION_LABELS: Record<string, string> = {
  New: "Nuevo",
  "Like New": "Como nuevo",
  Good: "Buen estado",
  Fair: "Aceptable",
};

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", page],
    queryFn: async () => {
      const res = await api.get<{
        data: Product[];
        meta: { total: number; page: number; pages: number };
      }>(`/products/admin/all?page=${page}&limit=20`);
      return res.data;
    },
  });

  const approve = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/products/admin/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos aprobar la publicación")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar la publicación")),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
        <Spinner className="h-5 w-5" /> Cargando…
      </div>
    );
  }

  const products = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <h2 className="heading-section mb-4 text-text-primary">
        Todas las publicaciones
      </h2>
      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {products.length === 0 ? (
        <EmptyState title="Aún no hay publicaciones" />
      ) : (
        <div className="space-y-3">
          {products.map((product, index) => (
            <Card key={product.id}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted text-xs text-text-muted">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      loading={index === 0 ? undefined : "lazy"}
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    "—"
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/products/${product.id}`}
                    className="block truncate font-medium text-text-primary hover:underline"
                  >
                    {product.title}
                  </Link>
                  <p className="text-xs text-text-muted">
                    {product.category} · Talla {product.size} ·{" "}
                    <Price value={product.price} />
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Vendedor: {product.seller?.name ?? "—"}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    Condición:{" "}
                    {CONDITION_LABELS[product.condition] ?? product.condition}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {product.isApproved ? (
                    <Badge variant="success">Aprobado</Badge>
                  ) : (
                    <Badge variant="warning">Pendiente</Badge>
                  )}
                  {!product.isApproved && (
                    <Button
                      size="sm"
                      onClick={() => approve.mutate(product.id)}
                      disabled={approve.isPending}
                    >
                      Aprobar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm(`¿Eliminar "${product.title}"?`)) {
                        remove.mutate(product.id);
                      }
                    }}
                    disabled={remove.isPending}
                  >
                    Eliminar
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {meta && meta.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            disabled={meta.page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Anterior
          </Button>
          <span className="text-sm text-text-muted">
            Página {meta.page} de {meta.pages}
          </span>
          <Button
            variant="secondary"
            disabled={meta.page >= meta.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente ›
          </Button>
        </div>
      )}
    </div>
  );
}
