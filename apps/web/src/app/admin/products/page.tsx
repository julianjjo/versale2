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
import { Pager } from "@/components/admin/pager";
import { conditionLabel } from "@/lib/product-condition";
import type { Product } from "@/lib/types";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";

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

// Mirrors the DTO's own cap (apps/api/src/products/dto/bulk-approve.dto.ts):
// enforced here too so an admin who selects across many pages gets a clear,
// actionable message instead of only finding out after the request 400s.
const MAX_BULK_APPROVE = 100;

// A listing can be bulk-approved from the same two states its own row's
// "Aprobar" button already covers (pending or previously rejected), as long
// as it hasn't been sold since — mirrors the per-row condition so a selected
// checkbox never promises an action the request would silently drop.
function isBulkApprovable(product: Product): boolean {
  const isPending = !product.isApproved && !product.rejectedAt;
  const isRejected = !product.isApproved && !!product.rejectedAt;
  return (isPending || isRejected) && !product.soldAt;
}

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [lastSeenPages, setLastSeenPages] = useState<number | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  // Distinct from `error`: a partial-success outcome isn't a failure, so it
  // isn't styled or announced as one.
  const [notice, setNotice] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = useState("");

  const discardSelected = (id: string) => {
    setSelectedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

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
    queryClient.invalidateQueries({
      queryKey: ["admin-products-pending-count"],
    });
  };

  const approve = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/products/admin/${id}/approve`);
    },
    onSuccess: (_data, id) => {
      invalidateProducts();
      // The row this approved may have also been part of a pending bulk
      // selection; approving it individually already resolved it, so it
      // shouldn't linger in the batch and get resubmitted.
      discardSelected(id);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos aprobar la publicación")),
  });

  const reject = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.patch(`/products/admin/${id}/reject`, {
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: (_data, { id }) => {
      invalidateProducts();
      discardSelected(id);
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
    onSuccess: (_data, id) => {
      invalidateProducts();
      discardSelected(id);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar la publicación")),
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await api.patch<{ approved: number; requested: number }>(
        "/products/admin/bulk-approve",
        { ids },
      );
      return res.data;
    },
    onSuccess: (result, ids) => {
      invalidateProducts();
      // Only the ids actually submitted are resolved — anything checked
      // after the request was already sent (the checkboxes are disabled
      // meanwhile, but this stays correct even if that ever changes) stays
      // selected instead of being silently discarded.
      setSelectedIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setError(null);
      // A shortfall can come from more than one cause (sold, deleted, or
      // already handled by another admin) — the message names the effect,
      // not a specific guessed cause, all covered by the API's own
      // compare-and-swap silently excluding that id from `approved`.
      setNotice(
        result.approved < result.requested
          ? `Se aprobaron ${result.approved} de ${result.requested} ${
              result.requested === 1 ? "publicación" : "publicaciones"
            }. Las demás ya no estaban disponibles para aprobar.`
          : null,
      );
    },
    onError: (err) => {
      setNotice(null);
      setError(
        extractApiError(err, "No pudimos aprobar las publicaciones seleccionadas"),
      );
    },
  });

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const products = data?.data ?? [];
  const meta = data?.meta;

  // Approving, rejecting, or deleting the last item on a page shrinks
  // `meta.pages` without `page` following it down — Pager only clamps its
  // own button clicks, and renders nothing once `pages <= 1`, leaving no way
  // back from a now-empty page except switching status tabs. Clamped inline
  // during render (React's documented pattern for "adjust state when a prop
  // changes") rather than in a useEffect, which would setState after an
  // extra committed render instead of before this one paints.
  if (meta && meta.pages !== lastSeenPages) {
    setLastSeenPages(meta.pages);
    setPage((currentPage) => Math.min(currentPage, Math.max(1, meta.pages)));
  }

  const setTab = (next: StatusFilter) => {
    setStatus(next);
    setPage(1);
    // A selection made under one status filter doesn't carry meaning under
    // another — e.g. a pending item selected before switching to "Rechazados"
    // would leave the bulk bar counting a row no longer even on screen.
    setSelectedIds(new Set());
  };

  const eligibleOnPage = products.filter(isBulkApprovable);
  const someEligibleSelected = eligibleOnPage.some((product) =>
    selectedIds.has(product.id),
  );
  const allEligibleSelected =
    eligibleOnPage.length > 0 &&
    eligibleOnPage.every((product) => selectedIds.has(product.id));
  // A plain checked/unchecked box can't say "some, but not all, of this
  // page's eligible rows are selected" — a real state once a selection
  // carries over from another page. Only the DOM property (no React/ARIA
  // prop for it) can show that third state.
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        someEligibleSelected && !allEligibleSelected;
    }
  }, [someEligibleSelected, allEligibleSelected]);

  const toggleSelectAllOnPage = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allEligibleSelected) {
        eligibleOnPage.forEach((product) => next.delete(product.id));
      } else {
        eligibleOnPage.forEach((product) => next.add(product.id));
      }
      return next;
    });
  };

  const exceedsBulkApproveLimit = selectedIds.size > MAX_BULK_APPROVE;

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

      {notice && (
        <p className="mb-3 text-sm text-text-primary" role="status">
          {notice}
        </p>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-muted px-4 py-2">
          <span className="text-sm text-text-primary">
            {selectedIds.size} seleccionada
            {selectedIds.size === 1 ? "" : "s"}
            {exceedsBulkApproveLimit && ` (máximo ${MAX_BULK_APPROVE} por lote)`}
          </span>
          <Button
            size="sm"
            variant="accent"
            onClick={() => bulkApprove.mutate(Array.from(selectedIds))}
            disabled={bulkApprove.isPending || exceedsBulkApproveLimit}
          >
            {bulkApprove.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              "Aprobar seleccionadas"
            )}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkApprove.isPending}
          >
            Cancelar selección
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      ) : products.length === 0 ? (
        <EmptyState title={EMPTY_STATE_COPY[status]} />
      ) : (
        <div className="space-y-3" aria-busy={isFetching}>
          {eligibleOnPage.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-text-muted">
              <input
                ref={selectAllRef}
                type="checkbox"
                aria-label="Seleccionar todas las elegibles en esta página"
                checked={allEligibleSelected}
                onChange={toggleSelectAllOnPage}
                disabled={bulkApprove.isPending}
              />
              Seleccionar todas las elegibles en esta página
            </label>
          )}
          {products.map((product, index) => {
            const isPending = !product.isApproved && !product.rejectedAt;
            const isRejected = !product.isApproved && !!product.rejectedAt;
            return (
              <Card
                key={product.id}
                data-testid={`admin-product-${product.id}`}
              >
                <div className="flex flex-wrap items-center gap-4">
                  {isBulkApprovable(product) && (
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${product.title} (#${product.id.slice(0, 8)})`}
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelected(product.id)}
                      disabled={bulkApprove.isPending}
                      className="h-4 w-4 flex-shrink-0"
                    />
                  )}
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
                    {/* `?preview=1` skips the anonymous server-side probe in
                        `app/products/[id]/page.tsx`, which would answer 404 for a
                        listing that is not public yet — i.e. for exactly the
                        pending and rejected rows this queue exists to moderate.
                        The client query behind it carries the admin token. */}
                    <Link
                      href={`/products/${product.id}?preview=1`}
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
                      Condición: {conditionLabel(product.condition)}
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
                    {/* Independent of the moderation badge above: a listing
                        the seller paused stays hidden from the catalog no
                        matter what an admin does here, so approving/
                        rejecting it without this would give no indication
                        it still won't show up. */}
                    {product.pausedAt && (
                      <Badge variant="default">Pausado por el vendedor</Badge>
                    )}
                    {/* Same eligibility rule as the bulk-select checkbox
                        above (isBulkApprovable): excludes sold listings, since
                        the API already refuses to approve one. */}
                    {isBulkApprovable(product) && (
                      <Button
                        size="sm"
                        variant="accent"
                        onClick={() => approve.mutate(product.id)}
                        disabled={approve.isPending}
                      >
                        Aprobar
                      </Button>
                    )}
                    {/* También disponible sobre una publicación ya aprobada: es la
                        única forma de bajarla del catálogo sin borrar su
                        historial de reseñas/pedidos, que es lo que hace
                        "Eliminar". Se excluyen las vendidas (soldAt): son
                        historial y no se tocan desde aquí. */}
                    {(isPending || product.isApproved) && !product.soldAt && (
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

      <Pager
        page={page}
        pages={meta?.pages ?? 0}
        isFetching={isFetching}
        onPageChange={setPage}
      />

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
