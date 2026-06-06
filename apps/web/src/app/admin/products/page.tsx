"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { Spinner, Card, EmptyState, Badge, Button } from "@/components/ui";
import type { Product } from "@/lib/types";
import { useState } from "react";
import Link from "next/link";

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
    onError: (err) => setError(extractApiError(err, "Failed to approve")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    },
    onError: (err) => setError(extractApiError(err, "Failed to delete")),
  });

  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
        <Spinner className="h-5 w-5" /> Loading…
      </div>
    );
  }

  const products = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">All products</h2>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      {products.length === 0 ? (
        <EmptyState title="No products yet" />
      ) : (
        <div className="space-y-3">
          {products.map((product) => (
            <Card key={product.id}>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-md flex items-center justify-center text-zinc-400 text-xs flex-shrink-0 overflow-hidden">
                  {product.images?.[0] ? (
                    <img
                      src={product.images[0]}
                      alt={product.title}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    "—"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/products/${product.id}`}
                    className="font-medium hover:underline block truncate"
                  >
                    {product.title}
                  </Link>
                  <p className="text-xs text-zinc-500">
                    {product.category} · Size {product.size} · $
                    {product.price.toFixed(2)}
                  </p>
                  <p className="text-xs text-zinc-400 mt-1">
                    Seller: {product.seller?.name ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {product.isApproved ? (
                    <Badge variant="success">Approved</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                  {!product.isApproved && (
                    <Button
                      size="sm"
                      onClick={() => approve.mutate(product.id)}
                      disabled={approve.isPending}
                    >
                      Approve
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (confirm(`Delete "${product.title}"?`)) {
                        remove.mutate(product.id);
                      }
                    }}
                    disabled={remove.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button
            variant="secondary"
            disabled={meta.page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Prev
          </Button>
          <span className="text-sm text-zinc-500">
            Page {meta.page} of {meta.pages}
          </span>
          <Button
            variant="secondary"
            disabled={meta.page >= meta.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next ›
          </Button>
        </div>
      )}
    </div>
  );
}
