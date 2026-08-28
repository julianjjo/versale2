"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Button,
  Price,
  Modal,
  Input,
  Textarea,
  PageContainer,
  SectionHeader,
} from "@/components/ui";
import { Pager } from "@/components/admin/pager";
import { useDebouncedSearch } from "@/lib/use-debounced-search";
import { conditionLabel } from "@/lib/product-condition";
import type { Product } from "@/lib/types";
import Link from "next/link";

type StatusFilter =
  "all" | "pending" | "approved" | "paused" | "rejected" | "sold";

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobados" },
  { value: "paused", label: "Pausados" },
  { value: "rejected", label: "Rechazados" },
  { value: "sold", label: "Vendidos" },
];

const EMPTY_STATE_COPY: Record<StatusFilter, string> = {
  all: "Aún no has publicado ningún producto",
  pending: "No tienes publicaciones pendientes",
  approved: "No tienes publicaciones aprobadas",
  paused: "No tienes publicaciones pausadas",
  rejected: "No tienes publicaciones rechazadas",
  sold: "Todavía no has vendido nada",
};

type EditForm = { title: string; description: string; price: string };

function formatStat(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

// Mirrors the DTOs' own cap (apps/api/src/products/dto/bulk-pause.dto.ts,
// bulk-unpause.dto.ts): enforced here too so a seller who selects across
// many pages gets a clear, actionable message instead of only finding out
// after the request 400s.
const MAX_BULK_ACTION = 100;

function isBulkPausable(product: Product): boolean {
  return product.isApproved && !product.pausedAt && product.status !== "SOLD";
}

// No isApproved requirement — mirrors unpauseProduct()'s own rule: a paused
// listing sent back to review by a later moderated edit is still valid to
// reactivate.
function isBulkUnpausable(product: Product): boolean {
  return !!product.pausedAt && product.status !== "SOLD";
}

// The checkbox is offered whenever either bulk action could apply to a row
// — matches this page's own per-row canTogglePause condition exactly
// ((isApproved || isPaused) && !isSold), just split into the two halves the
// two separate bulk buttons below need.
function isBulkSelectable(product: Product): boolean {
  return isBulkPausable(product) || isBulkUnpausable(product);
}

export default function MisProductosPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  if (isAuthLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando…
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Inicia sesión"
          description="Necesitas una cuenta para ver tus publicaciones."
          action={
            <Button onClick={() => router.push("/login")}>
              Iniciar sesión
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return <MisProductosList />;
}

function MisProductosList() {
  const router = useRouter();
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    title: "",
    description: "",
    price: "",
  });
  const [editError, setEditError] = useState<string | null>(null);

  const { searchInput, setSearchInput, search } = useDebouncedSearch(() =>
    setPage(1),
  );

  const { data, isLoading, isFetching, isError } = useQuery({
    queryKey: ["mis-productos", search, status, page],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("status", status);
      params.set("page", String(page));
      params.set("limit", "20");
      const res = await api.get<{
        data: Product[];
        meta: { total: number; page: number; pages: number };
      }>(`/products/mine?${params.toString()}`, { signal });
      return res.data;
    },
    // Igual que en el panel de admin: cada pestaña/página es una queryKey
    // distinta, y mantenemos la lista anterior en pantalla mientras llega la
    // siguiente para no vaciar la vista en cada cambio de filtro.
    placeholderData: keepPreviousData,
  });

  // Also invalidates the caches this same page links out to (the product's own
  // detail view, reached via the card's title link, and the public catalog) —
  // otherwise a seller who previewed a listing before editing it could see the
  // pre-edit title/price/description there for as long as those queries'
  // staleTime allows, even though this page already shows the save as done.
  const invalidate = (productId?: string) => {
    queryClient.invalidateQueries({ queryKey: ["mis-productos"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    if (productId) {
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
    }
  };

  // A row resolved individually (edited, deleted, paused/unpaused one at a
  // time) shouldn't linger in a bulk selection made before that — its
  // eligibility for either bulk action may have just changed, or it may be
  // gone from this tab entirely.
  const discardSelected = (id: string) => {
    setSelectedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const openEdit = (product: Product) => {
    setError(null);
    setEditError(null);
    setEditForm({
      title: product.title,
      description: product.description,
      price: String(product.price),
    });
    setEditTarget(product);
  };

  const closeEdit = () => {
    if (update.isPending) return;
    setEditTarget(null);
    setEditError(null);
  };

  const update = useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: Record<string, string | number>;
    }) => {
      await api.patch(`/products/${id}`, body);
    },
    onSuccess: (_data, { id }) => {
      invalidate(id);
      discardSelected(id);
      setEditTarget(null);
    },
    onError: (err) =>
      setEditError(
        extractApiError(err, "No pudimos actualizar la publicación"),
      ),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: (_data, id) => {
      invalidate(id);
      discardSelected(id);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar la publicación")),
  });

  const pauseToggle = useMutation({
    mutationFn: async ({ id, pause }: { id: string; pause: boolean }) => {
      await api.patch(`/products/${id}/${pause ? "pause" : "unpause"}`);
    },
    onSuccess: (_data, { id }) => {
      invalidate(id);
      discardSelected(id);
    },
    onError: (err, { pause }) =>
      setError(
        extractApiError(
          err,
          pause
            ? "No pudimos pausar la publicación"
            : "No pudimos reactivar la publicación",
        ),
      ),
  });

  const bulkPause = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await api.patch<{ paused: number; requested: number }>(
        "/products/bulk-pause",
        { ids },
      );
      return res.data;
    },
    onSuccess: (result, ids) => {
      // The blanket list-level keys only need one invalidation for the
      // whole batch — only the per-product cache entry (the seller's own
      // preview, reached via this row's title link) needs one per id.
      invalidate();
      ids.forEach((id) =>
        queryClient.invalidateQueries({ queryKey: ["product", id] }),
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setError(null);
      // A shortfall can come from more than one cause (sold, already paused,
      // no longer approved, or — since the checkbox is shared with
      // bulk-unpause — a row that was only ever unpause-eligible). The
      // all-or-nothing case gets its own wording: "las demás" reads as a
      // race that spared some of the batch, which is misleading when none
      // of it went through.
      setNotice(
        result.paused === result.requested
          ? null
          : result.paused === 0
            ? "Ninguna de las publicaciones seleccionadas estaba disponible para pausar."
            : `Se pausaron ${result.paused} de ${result.requested} publicaciones. Las demás ya no estaban disponibles para pausar.`,
      );
    },
    onError: (err) => {
      setNotice(null);
      setError(
        extractApiError(
          err,
          "No pudimos pausar las publicaciones seleccionadas",
        ),
      );
    },
  });

  const bulkUnpause = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await api.patch<{ unpaused: number; requested: number }>(
        "/products/bulk-unpause",
        { ids },
      );
      return res.data;
    },
    onSuccess: (result, ids) => {
      invalidate();
      ids.forEach((id) =>
        queryClient.invalidateQueries({ queryKey: ["product", id] }),
      );
      setSelectedIds((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setError(null);
      setNotice(
        result.unpaused === result.requested
          ? null
          : result.unpaused === 0
            ? "Ninguna de las publicaciones seleccionadas estaba disponible para reactivar."
            : `Se reactivaron ${result.unpaused} de ${result.requested} publicaciones. Las demás ya no estaban disponibles para reactivar.`,
      );
    },
    onError: (err) => {
      setNotice(null);
      setError(
        extractApiError(
          err,
          "No pudimos reactivar las publicaciones seleccionadas",
        ),
      );
    },
  });

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    const title = editForm.title.trim();
    const description = editForm.description.trim();
    const price = Number(editForm.price.trim());
    if (!title || !description) {
      setEditError("El título y la descripción son obligatorios.");
      return;
    }
    if (
      !Number.isFinite(price) ||
      !Number.isInteger(price) ||
      price < 1 ||
      price > 100_000_000
    ) {
      setEditError(
        "El precio debe ser un número entero entre 1 y 100.000.000.",
      );
      return;
    }

    // Only send fields that actually changed. `/sell` never trims on submit,
    // so a stored title/description can carry whitespace this form's own
    // `.trim()` strips on every save — comparing the trimmed values on both
    // sides keeps a price-only edit from reading as a title/description
    // change too and sending an untouched, already-approved listing back to
    // moderation (products.service.ts's `hasModeratedChanges` compares
    // whatever this sends against the stored value with a strict `!==`).
    const body: Record<string, string | number> = {};
    if (title !== editTarget.title.trim()) body.title = title;
    if (description !== editTarget.description.trim())
      body.description = description;
    if (price !== editTarget.price) body.price = price;

    if (Object.keys(body).length === 0) {
      setEditError("No hay cambios que guardar.");
      return;
    }

    update.mutate({ id: editTarget.id, body });
  };

  const products = data?.data ?? [];
  const meta = data?.meta;

  useEffect(() => {
    if (meta && meta.pages !== lastSeenPages) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp pagination when total pages shrink (external meta → local state sync)
      setLastSeenPages(meta.pages);
      setPage((currentPage) => Math.min(currentPage, Math.max(1, meta.pages)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- meta.pages is the stable primitive; meta ref changes every fetch
  }, [meta?.pages, lastSeenPages]);

  const setTab = (next: StatusFilter) => {
    setStatus(next);
    setPage(1);
    // A selection made under one status filter doesn't carry meaning under
    // another — e.g. a paused item selected before switching to "Pendientes"
    // would leave the bulk bar counting a row no longer even on screen.
    setSelectedIds(new Set());
    // Same reasoning for a bulk action's outcome notice: it describes a
    // batch that's no longer even in view once the tab changes, and would
    // otherwise linger on screen until another bulk action happens to
    // overwrite it.
    setNotice(null);
  };

  const isFiltered = Boolean(search) || status !== "all";

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

  const eligibleOnPage = products.filter(isBulkSelectable);
  const someEligibleSelected = eligibleOnPage.some((product) =>
    selectedIds.has(product.id),
  );
  const allEligibleSelected =
    eligibleOnPage.length > 0 &&
    eligibleOnPage.every((product) => selectedIds.has(product.id));
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
  // a selection can legitimately hold ids only one of the two actions can do
  // anything with — e.g. an already-paused row is selectable (to reactivate)
  // but isn't pause-eligible. Disabling a button when NONE of the
  // currently-verifiable selection (ids whose product data is loaded on this
  // page) is eligible for that specific action closes the common case —
  // selecting every eligible row on a single status tab, then reaching for
  // the wrong button. A selection spanning another page falls back to the
  // existing send-and-report-shortfall behavior.
  const selectedOnPage = products.filter((product) =>
    selectedIds.has(product.id),
  );
  const selectionFullyOnPage = selectedOnPage.length === selectedIds.size;
  const noneSelectedCanBePaused =
    selectionFullyOnPage &&
    selectedOnPage.length > 0 &&
    !selectedOnPage.some(isBulkPausable);
  const noneSelectedCanBeUnpaused =
    selectionFullyOnPage &&
    selectedOnPage.length > 0 &&
    !selectedOnPage.some(isBulkUnpausable);

  const bulkActionPending = bulkPause.isPending || bulkUnpause.isPending;

  return (
    <PageContainer size="wide">
      <SectionHeader
        title="Mis publicaciones"
        description="Administra el estado, el precio y la descripción de lo que has publicado."
        action={
          <Button variant="accent" onClick={() => router.push("/sell")}>
            Publicar producto
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          type="search"
          placeholder="Buscar por título, marca o categoría"
          aria-label="Buscar publicaciones"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value);
          }}
          className="max-w-md"
          wrapperClassName="flex-1 basis-full sm:basis-auto"
        />
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
              // Switching tabs clears the current selection (see setTab) —
              // disabled while a bulk action is in flight, same as every
              // other selection-changing control, so a batch's outcome
              // notice can't end up describing a tab the seller already
              // left.
              disabled={bulkActionPending}
              className={`filter-pill ${status === tab.value ? "is-active" : ""}`}
            >
              {tab.label}
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
            variant="secondary"
            onClick={() => bulkPause.mutate(Array.from(selectedIds))}
            disabled={
              bulkActionPending || exceedsBulkLimit || noneSelectedCanBePaused
            }
          >
            {bulkPause.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              "Pausar seleccionadas"
            )}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => bulkUnpause.mutate(Array.from(selectedIds))}
            disabled={
              bulkActionPending || exceedsBulkLimit || noneSelectedCanBeUnpaused
            }
          >
            {bulkUnpause.isPending ? (
              <Spinner className="h-4 w-4" />
            ) : (
              "Reactivar seleccionadas"
            )}
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
      ) : isError ? (
        // Distinct from the empty state below: a failed request must not read
        // as "no tienes publicaciones" — `data` stays undefined either way,
        // and `products.length === 0` alone can't tell the two apart.
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 p-4 text-sm text-danger"
        >
          No pudimos cargar tus publicaciones. Intenta de nuevo.
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          title={
            search
              ? "Ninguna publicación coincide con tu búsqueda"
              : EMPTY_STATE_COPY[status]
          }
          action={
            !isFiltered ? (
              <Link href="/sell">
                <Button variant="accent">Publicar tu primer producto</Button>
              </Link>
            ) : undefined
          }
        />
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
          {products.map((product) => {
            // Moderation band, per the roadmap's closed state rule: a rejection
            // without a written reason reads as "En revisión" to the seller —
            // an unexplained "Rechazado" is less actionable than silence.
            const isRejected = !product.isApproved && !!product.rejectionReason;
            const isSold = product.status === "SOLD";
            const isPaused = !!product.pausedAt;
            const canEditOrDelete = !isSold;
            // Pausing requires the listing to currently be approved (mirrors
            // pauseProduct()'s own guard), but reactivating does not — a
            // paused listing can be sent back to review by a later moderated
            // edit, and the backend still lets it be unpaused from that state
            // (see unpauseProduct()'s own comment). Gating on isApproved alone
            // would make the button vanish exactly when a seller needs it.
            // Same rule as the bulk-selection checkbox below (isBulkSelectable).
            const canTogglePause = isBulkSelectable(product);

            return (
              <Card key={product.id} data-testid={`mine-product-${product.id}`}>
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
                        className="object-cover"
                      />
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
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
                      Condición: {conditionLabel(product.condition)}
                    </p>
                    <p
                      className="mt-1 text-xs text-text-muted"
                      data-testid={`mine-product-stats-${product.id}`}
                    >
                      {formatStat(product.viewCount ?? 0, "vista", "vistas")}
                      {" · "}
                      {formatStat(
                        product._count?.favoritedBy ?? 0,
                        "favorito",
                        "favoritos",
                      )}
                      {" · "}
                      {formatStat(
                        product._count?.questions ?? 0,
                        "pregunta",
                        "preguntas",
                      )}
                    </p>
                    {isRejected && product.rejectionReason && (
                      <p className="mt-1 text-xs text-danger">
                        Motivo del rechazo: {product.rejectionReason}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Precedence matches ProductCard's own paused-badge logic
                        (products-browser.tsx): moderation status (rechazado/
                        pendiente) wins over "pausado" so the two surfaces never
                        tell a different story about the same listing — a
                        listing paused, then sent back to review by a later
                        edit, is not-approved-and-paused at once, and this
                        shows the more actionable "needs review" fact first. */}
                    {isSold ? (
                      <Badge variant="warning">Vendido</Badge>
                    ) : isRejected ? (
                      <Badge variant="danger">Rechazado</Badge>
                    ) : !product.isApproved ? (
                      <Badge variant="warning">En revisión</Badge>
                    ) : isPaused ? (
                      <Badge variant="default">Pausado</Badge>
                    ) : (
                      <Badge variant="success">Publicado</Badge>
                    )}
                    {canTogglePause && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          pauseToggle.mutate({
                            id: product.id,
                            pause: !isPaused,
                          })
                        }
                        disabled={
                          pauseToggle.isPending ||
                          remove.isPending ||
                          update.isPending ||
                          bulkActionPending
                        }
                      >
                        {isPaused ? "Reactivar" : "Pausar"}
                      </Button>
                    )}
                    {canEditOrDelete && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openEdit(product)}
                        disabled={
                          remove.isPending ||
                          update.isPending ||
                          pauseToggle.isPending ||
                          bulkActionPending
                        }
                      >
                        Editar
                      </Button>
                    )}
                    {/* Roadmap 1.15: relisting a one-of-a-kind garment (or
                        cloning a good listing) shouldn't mean retyping the
                        same title/category/size into /sell — preload them.
                        Available for every own row regardless of status: the
                        sold case is exactly the relist use case. */}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        const params = new URLSearchParams({
                          title: product.title,
                          category: product.category,
                          size: product.size,
                        });
                        router.push(`/sell?${params.toString()}`);
                      }}
                      disabled={
                        remove.isPending ||
                        update.isPending ||
                        pauseToggle.isPending ||
                        bulkActionPending
                      }
                    >
                      Publicar otro igual
                    </Button>
                    {canEditOrDelete && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setError(null);
                          if (confirm(`¿Eliminar "${product.title}"?`)) {
                            remove.mutate(product.id);
                          }
                        }}
                        disabled={
                          remove.isPending ||
                          update.isPending ||
                          pauseToggle.isPending ||
                          bulkActionPending
                        }
                      >
                        Eliminar
                      </Button>
                    )}
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
        open={!!editTarget}
        onClose={closeEdit}
        title={`Editar "${editTarget?.title ?? ""}"`}
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <p className="text-sm text-text-muted">
            Cambiar el título, la descripción o el precio envía la publicación
            de nuevo a revisión antes de volver a aparecer en el catálogo.
          </p>
          <Input
            label="Título"
            value={editForm.title}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, title: e.target.value }))
            }
            disabled={update.isPending}
            required
            maxLength={120}
          />
          <Textarea
            label="Descripción"
            value={editForm.description}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, description: e.target.value }))
            }
            rows={4}
            disabled={update.isPending}
            required
            maxLength={2000}
          />
          <Input
            label="Precio (COP)"
            type="number"
            min="1"
            max={100_000_000}
            step="1"
            value={editForm.price}
            onChange={(e) =>
              setEditForm((f) => ({ ...f, price: e.target.value }))
            }
            disabled={update.isPending}
            required
            hint="Precio en pesos colombianos, sin decimales."
          />
          {editError && (
            <p className="text-sm text-danger" role="alert">
              {editError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={closeEdit}
              disabled={update.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="accent" disabled={update.isPending}>
              {update.isPending ? <Spinner className="h-4 w-4" /> : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
