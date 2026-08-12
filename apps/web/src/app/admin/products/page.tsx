"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Button,
  Price,
  Modal,
  Textarea,
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

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobados" },
  { value: "rejected", label: "Rechazados" },
];

const EMPTY_STATE_COPY: Record<StatusFilter, string> = {
  all: "Aún no hay publicaciones",
  pending: "No hay publicaciones pendientes",
  approved: "No hay publicaciones aprobadas",
  rejected: "No hay publicaciones rechazadas",
};

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Product | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-products", status, page],
    queryFn: async () => {
      const res = await api.get<{
        data: Product[];
        meta: { total: number; page: number; pages: number };
      }>(`/products/admin/all?status=${status}&page=${page}&limit=20`);
      return res.data;
    },
    // Cada pestaña y página es una queryKey nueva: mantenemos la lista anterior
    // a la vista para no vaciar la pantalla en cada cambio de filtro.
    placeholderData: keepPreviousData,
  });

  const { data: pendingCount } = useQuery({
    queryKey: ["admin-products-pending-count"],
    queryFn: async () => {
      const res = await api.get<{ meta: { total: number } }>(
        "/products/admin/all?status=pending&page=1&limit=1",
      );
      return res.data.meta.total;
    },
  });

  const invalidateProducts = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    queryClient.invalidateQueries({ queryKey: ["admin-products-pending-count"] });
  };

  const approve = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/products/admin/${id}/approve`);
    },
    onSuccess: invalidateProducts,
    onError: (err) =>
      setError(extractApiError(err, "No pudimos aprobar la publicación")),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.patch(`/products/admin/${id}/reject`, {
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: () => {
      invalidateProducts();
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos rechazar la publicación")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: invalidateProducts,
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar la publicación")),
  });

  const products = data?.data ?? [];
  const meta = data?.meta;

  const setTab = (next: StatusFilter) => {
    setStatus(next);
    setPage(1);
  };

  return (
    <div>
      <h2 className="heading-section mb-4 text-text-primary">
        Todas las publicaciones
      </h2>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Filtros, no pestañas: son botones que filtran una sola lista, sin
            paneles asociados ni navegación por flechas. Declarar role="tab" sin
            el patrón completo le promete al lector de pantalla una interacción
            que no existe, así que se quedan como botones con aria-pressed. */}
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filtrar por estado"
        >
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-pressed={status === tab.value}
              onClick={() => setTab(tab.value)}
              className={`filter-pill ${status === tab.value ? "is-active" : ""}`}
            >
              {tab.label}
              {tab.value === "pending" && !!pendingCount && (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 text-[10px] font-semibold text-paper">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {isFetching && !isLoading && (
          <span className="inline-flex flex-shrink-0 items-center gap-1.5 text-xs text-text-muted">
            <Spinner className="h-3.5 w-3.5" /> Actualizando…
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      ) : products.length === 0 ? (
        <EmptyState title={EMPTY_STATE_COPY[status]} />
      ) : (
        <div className="space-y-3" aria-busy={isFetching}>
          {products.map((product, index) => {
            const isPending = !product.isApproved && !product.rejectedAt;
            const isRejected = !product.isApproved && !!product.rejectedAt;
            return (
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
                    {isRejected && product.rejectionReason && (
                      <p className="mt-1 text-xs text-danger">
                        Motivo del rechazo: {product.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {product.isApproved ? (
                      <Badge variant="success">Aprobado</Badge>
                    ) : isRejected ? (
                      <Badge variant="danger">Rechazado</Badge>
                    ) : (
                      <Badge variant="warning">Pendiente</Badge>
                    )}
                    {(isPending || isRejected) && (
                      <Button
                        size="sm"
                        variant="accent"
                        onClick={() => approve.mutate(product.id)}
                        disabled={approve.isPending}
                      >
                        Aprobar
                      </Button>
                    )}
                    {isPending && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRejectTarget(product)}
                        disabled={reject.isPending}
                      >
                        Rechazar
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
            );
          })}
        </div>
      )}

      {/* Límites sobre `page` y no sobre `meta.page`: keepPreviousData deja la
          meta anterior visible mientras llega la nueva, y con eso un doble clic
          rápido saltaba una página. */}
      {meta && meta.pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹ Anterior
          </Button>
          <span className="text-sm text-text-muted">
            Página {page} de {meta.pages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= meta.pages || isFetching}
            onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
          >
            Siguiente ›
          </Button>
        </div>
      )}

      <Modal
        open={!!rejectTarget}
        onClose={() => {
          if (reject.isPending) return;
          setRejectTarget(null);
          setRejectReason("");
        }}
        title={`Rechazar "${rejectTarget?.title ?? ""}"`}
      >
        <p className="text-sm text-text-muted">
          El motivo queda guardado como nota interna: se ve en la pestaña
          “Rechazados” de este panel. Hoy el vendedor no recibe ninguna
          notificación del rechazo.
        </p>
        <Textarea
          className="mt-3"
          label="Motivo (opcional)"
          placeholder="Ej: las fotos no muestran bien el producto"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          disabled={reject.isPending}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setRejectTarget(null);
              setRejectReason("");
            }}
            disabled={reject.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={reject.isPending}
            onClick={() =>
              rejectTarget &&
              reject.mutate({ id: rejectTarget.id, reason: rejectReason })
            }
          >
            {reject.isPending ? <Spinner className="h-4 w-4" /> : "Rechazar"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
