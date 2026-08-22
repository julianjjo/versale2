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
import Image from "next/image";
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

// Mirrors both DTOs' own cap (apps/api/src/products/dto/bulk-approve.dto.ts,
// bulk-reject.dto.ts): enforced here too so an admin who selects across many
// pages gets a clear, actionable message instead of only finding out after
// the request 400s.
const MAX_BULK_ACTION = 100;

// A listing can be bulk-approved from the same two states its own row's
// "Aprobar" button already covers (pending or previously rejected), as long
// as it hasn't been sold since — mirrors the per-row condition so a selected
// checkbox never promises an action the request would silently drop.
function isBulkApprovable(product: Product): boolean {
  const isPending = !product.isApproved && !product.rejectedAt;
  const isRejected = !product.isApproved && !!product.rejectedAt;
  return (isPending || isRejected) && product.status !== "SOLD";
}

// Same reasoning as isBulkApprovable, mirroring the per-row "Rechazar"
// button's own eligibility instead: pending or currently-approved, not sold.
// An already-rejected listing has nothing to gain from being rejected again.
function isBulkRejectable(product: Product): boolean {
  const isPending = !product.isApproved && !product.rejectedAt;
  return (isPending || product.isApproved) && product.status !== "SOLD";
}

// isBulkApprovable and isBulkRejectable between them cover every status a
// non-sold product can be in (pending, approved, rejected), so this is
// exactly `product.status !== "SOLD"` — spelled out as the union of the two so a
// selected checkbox always maps back to at least one of the two buttons
// below, rather than asserting the equivalence and hoping it stays true if
// either predicate's rules change.
function isBulkSelectable(product: Product): boolean {
  return isBulkApprovable(product) || isBulkRejectable(product);
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
  const [bulkRejectOpen, setBulkRejectOpen] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState("");

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
      // A shortfall can come from more than one cause (sold, deleted,
      // already handled by another admin, or — since the checkbox above is
      // shared with bulk-reject — a row that was only ever reject-eligible)
      // — the message names the effect, not a specific guessed cause. The
      // all-or-nothing case gets its own wording: "las demás" reads as a
      // race that spared some of the batch, which is misleading when none
      // of it went through.
      setNotice(
        result.approved === result.requested
          ? null
          : result.approved === 0
            ? "Ninguna de las publicaciones seleccionadas estaba disponible para aprobar."
            : `Se aprobaron ${result.approved} de ${result.requested} publicaciones. Las demás ya no estaban disponibles para aprobar.`,
      );
    },
    onError: (err) => {
      setNotice(null);
      setError(
        extractApiError(err, "No pudimos aprobar las publicaciones seleccionadas"),
      );
    },
  });

  const bulkReject = useMutation({
    mutationFn: async ({ ids, reason }: { ids: string[]; reason: string }) => {
      const res = await api.patch<{ rejected: number; requested: number }>(
        "/products/admin/bulk-reject",
        { ids, reason: reason.trim() || undefined },
      );
      return res.data;
    },
    onSuccess: (result, { ids }) => {
      invalidateProducts();
      setSelectedIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setError(null);
      setBulkRejectOpen(false);
      setBulkRejectReason("");
      // Same reasoning as bulkApprove's shortfall notice, including the
      // all-or-nothing wording: the API's compare-and-swap can't say which
      // selected ids were already sold, deleted, approve-only-eligible, or
      // rejected by another admin — only that fewer than requested were
      // actually rejected.
      setNotice(
        result.rejected === result.requested
          ? null
          : result.rejected === 0
            ? "Ninguna de las publicaciones seleccionadas estaba disponible para rechazar."
            : `Se rechazaron ${result.rejected} de ${result.requested} publicaciones. Las demás ya no estaban disponibles para rechazar.`,
      );
    },
    onError: (err) => {
      setNotice(null);
      setError(
        extractApiError(err, "No pudimos rechazar las publicaciones seleccionadas"),
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

  const eligibleOnPage = products.filter(isBulkSelectable);
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

  const exceedsBulkLimit = selectedIds.size > MAX_BULK_ACTION;

  // The checkbox above is shared by both bulk actions (isBulkSelectable), so
  // a selection can legitimately hold ids that only one of the two actions
  // can do anything with — e.g. an approved-and-not-sold row is selectable
  // (for a bulk reject) but isn't approve-eligible. Sending it to the wrong
  // action wouldn't just no-op: the backend would silently drop it from the
  // count and report a shortfall that reads like a race condition instead of
  // "this row was never a candidate for that button." Disabling the button
  // when NONE of the selection could do anything closes the common case —
  // selecting every eligible row on a single status tab, then reaching for
  // the wrong one. This can only be verified for ids whose product data is
  // currently loaded (this page); a selection that also spans another page
  // falls back to the existing send-and-report-shortfall behavior, same as
  // it did before this PR for a legitimate mid-flight race.
  const selectedOnPage = products.filter((product) =>
    selectedIds.has(product.id),
  );
  const selectionFullyOnPage = selectedOnPage.length === selectedIds.size;
  const noneSelectedCanBeApproved =
    selectionFullyOnPage &&
    selectedOnPage.length > 0 &&
    !selectedOnPage.some(isBulkApprovable);
  const noneSelectedCanBeRejected =
    selectionFullyOnPage &&
    selectedOnPage.length > 0 &&
    !selectedOnPage.some(isBulkRejectable);

  const bulkActionPending = bulkApprove.isPending || bulkReject.isPending;

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
            {exceedsBulkLimit && ` (máximo ${MAX_BULK_ACTION} por lote)`}
          </span>
          <Button
            size="sm"
            variant="accent"
            onClick={() => bulkApprove.mutate(Array.from(selectedIds))}
            disabled={
              bulkActionPending || exceedsBulkLimit || noneSelectedCanBeApproved
            }
          >
            {bulkApprove.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              "Aprobar seleccionadas"
            )}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setBulkRejectOpen(true)}
            disabled={
              bulkActionPending || exceedsBulkLimit || noneSelectedCanBeRejected
            }
          >
            Rechazar seleccionadas
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
            disabled={bulkActionPending}
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
                disabled={bulkActionPending}
              />
              Seleccionar todas las elegibles en esta página
            </label>
          )}
          {products.map((product, index) => {
            const isRejected = !product.isApproved && !!product.rejectedAt;
            return (
              <Card
                key={product.id}
                data-testid={`admin-product-${product.id}`}
              >
                <div className="flex flex-wrap items-center gap-4">
                  {isBulkSelectable(product) && (
                    <input
                      type="checkbox"
                      aria-label={`Seleccionar ${product.title} (#${product.id.slice(0, 8)})`}
                      checked={selectedIds.has(product.id)}
                      onChange={() => toggleSelected(product.id)}
                      disabled={bulkActionPending}
                      className="h-4 w-4 flex-shrink-0"
                    />
                  )}
                  <div className="relative flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted text-xs text-text-muted">
                    {product.images?.[0] ? (
                      <Image
                        src={product.images[0].url}
                        alt={product.title}
                        fill
                        sizes="64px"
                        priority={index === 0}
                        className="object-cover"
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
                        "Eliminar". Se excluyen las vendidas (status SOLD): son
                        historial y no se tocan desde aquí. Misma regla que la
                        casilla de selección en lote (isBulkRejectable). */}
                    {isBulkRejectable(product) && (
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

      <Modal
        open={bulkRejectOpen}
        onClose={() => {
          if (bulkReject.isPending) return;
          setBulkRejectOpen(false);
          setBulkRejectReason("");
        }}
        title="Rechazar publicaciones seleccionadas"
      >
        <p className="text-sm text-text-muted">
          El motivo queda guardado como nota interna en cada una de las{" "}
          {selectedIds.size} publicaciones seleccionadas. Hoy el vendedor no
          recibe ninguna notificación del rechazo.
        </p>
        <Textarea
          className="mt-3"
          label="Motivo (opcional)"
          placeholder="Ej: las fotos no muestran bien el producto"
          value={bulkRejectReason}
          onChange={(e) => setBulkRejectReason(e.target.value)}
          disabled={bulkReject.isPending}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setBulkRejectOpen(false);
              setBulkRejectReason("");
            }}
            disabled={bulkReject.isPending}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            disabled={bulkReject.isPending}
            onClick={() =>
              bulkReject.mutate({
                ids: Array.from(selectedIds),
                reason: bulkRejectReason,
              })
            }
          >
            {bulkReject.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              "Rechazar seleccionadas"
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
