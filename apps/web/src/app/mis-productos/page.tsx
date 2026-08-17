"use client";

import { useState } from "react";
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
  | "all"
  | "pending"
  | "approved"
  | "paused"
  | "rejected"
  | "sold";

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
          action={<Button onClick={() => router.push("/login")}>Iniciar sesión</Button>}
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
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("status", status);
      params.set("page", String(page));
      params.set("limit", "20");
      const res = await api.get<{
        data: Product[];
        meta: { total: number; page: number; pages: number };
      }>(`/products/mine?${params.toString()}`);
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
      setEditTarget(null);
    },
    onError: (err) =>
      setEditError(extractApiError(err, "No pudimos actualizar la publicación")),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/products/${id}`);
    },
    onSuccess: (_data, id) => invalidate(id),
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar la publicación")),
  });

  const pauseToggle = useMutation({
    mutationFn: async ({ id, pause }: { id: string; pause: boolean }) => {
      await api.patch(`/products/${id}/${pause ? "pause" : "unpause"}`);
    },
    onSuccess: (_data, { id }) => invalidate(id),
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

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    setEditError(null);
    const title = editForm.title.trim();
    const description = editForm.description.trim();
    const price = Number(editForm.price);
    if (!title || !description) {
      setEditError("El título y la descripción son obligatorios.");
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setEditError("El precio debe ser un número mayor a 0.");
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
    if (description !== editTarget.description.trim()) body.description = description;
    if (price !== editTarget.price) body.price = price;

    if (Object.keys(body).length === 0) {
      setEditError("No hay cambios que guardar.");
      return;
    }

    update.mutate({ id: editTarget.id, body });
  };

  const products = data?.data ?? [];
  const meta = data?.meta;

  // Mismo patrón que el panel de admin: aprobar/rechazar/eliminar el último
  // ítem de una página achica `meta.pages` sin que `page` lo siga, dejando la
  // vista varada en una página vacía. Se corrige durante el render, no en un
  // efecto, para no pintar primero el estado desactualizado.
  if (meta && meta.pages !== lastSeenPages) {
    setLastSeenPages(meta.pages);
    setPage((currentPage) => Math.min(currentPage, Math.max(1, meta.pages)));
  }

  const setTab = (next: StatusFilter) => {
    setStatus(next);
    setPage(1);
  };

  const isFiltered = Boolean(search) || status !== "all";

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
          {products.map((product, index) => {
            const isRejected = !product.isApproved && !!product.rejectedAt;
            const isSold = !!product.soldAt;
            const isPaused = !!product.pausedAt;
            const canEditOrDelete = !isSold;
            // Pausing requires the listing to currently be approved (mirrors
            // pauseProduct()'s own guard), but reactivating does not — a
            // paused listing can be sent back to review by a later moderated
            // edit, and the backend still lets it be unpaused from that state
            // (see unpauseProduct()'s own comment). Gating on isApproved alone
            // would make the button vanish exactly when a seller needs it.
            const canTogglePause = (product.isApproved || isPaused) && !isSold;

            return (
              <Card key={product.id} data-testid={`mine-product-${product.id}`}>
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
                      <Badge variant="warning">Pendiente</Badge>
                    ) : isPaused ? (
                      <Badge variant="default">Pausado</Badge>
                    ) : (
                      <Badge variant="success">Aprobado</Badge>
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
                          update.isPending
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
                          pauseToggle.isPending
                        }
                      >
                        Editar
                      </Button>
                    )}
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
                          pauseToggle.isPending
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
          />
          <Input
            label="Precio (COP)"
            type="number"
            min="1"
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
