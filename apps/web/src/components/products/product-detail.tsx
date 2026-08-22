"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { loginRedirectUrl, useAuth } from "@/lib/auth";
import { useRef, useState } from "react";
import {
  Button,
  Textarea,
  Spinner,
  Card,
  Badge,
  EmptyState,
  PageContainer,
  Price,
  StarRating,
  Divider,
} from "@/components/ui";
import { MAX_ITEM_QUANTITY } from "@/lib/cart";
import { conditionLabel } from "@/lib/product-condition";
import { isTerminalError } from "@/lib/http-error";
import { tokenStore } from "@/lib/token";
import type { Product, Review } from "@/lib/types";
import { FavoriteButton } from "@/components/products/favorite-button";
import { ShareButton } from "@/components/products/share-button";
import { ReportProductButton } from "@/components/products/report-product-button";
import { ProductQuestions } from "@/components/products/product-questions";
import { SellerReplyBlock } from "@/components/products/seller-reply-block";
import { ProductCard } from "@/components/products/products-browser";
import { ProductGallery } from "@/components/products/product-gallery";
import {
  RecentlyViewed,
  useRecordProductView,
} from "@/components/products/recently-viewed";

// Shared by the "write a review" form and the inline "edit my review" form so
// the accessible radiogroup (roving tabindex, arrow-key navigation) isn't
// hand-duplicated across both — each needs its own ref array, since a button
// ref from one can't be reused to focus the other.
function StarRatingInput({
  value,
  onChange,
  idPrefix,
}: {
  value: number;
  onChange: (rating: number) => void;
  idPrefix: string;
}) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div>
      <span
        id={`${idPrefix}-rating-label`}
        className="text-sm font-medium text-text-primary"
      >
        Calificación
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${idPrefix}-rating-label`}
        className="mt-1 flex items-center gap-1"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            ref={(el) => {
              buttonRefs.current[n - 1] = el;
            }}
            type="button"
            role="radio"
            aria-checked={n === value}
            tabIndex={n === value ? 0 : -1}
            onClick={() => onChange(n)}
            onKeyDown={(e) => {
              let next: number | null = null;
              if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                next = value < 5 ? value + 1 : 1;
              } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                next = value > 1 ? value - 1 : 5;
              } else if (e.key === "Home") {
                next = 1;
              } else if (e.key === "End") {
                next = 5;
              }
              if (next !== null) {
                e.preventDefault();
                onChange(next);
                buttonRefs.current[next - 1]?.focus();
              }
            }}
            className={`text-2xl transition-colors ${
              n <= value
                ? "text-warning"
                : "text-border hover:text-text-muted"
            }`}
            aria-label={`${n} estrella${n === 1 ? "" : "s"}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  );
}

export function ProductDetail({
  /** Product already resolved on the server (see `app/products/[id]/page.tsx`).
   *  Seeds the query so the page paints without a spinner; the client still
   *  refetches with the visitor's token, which can see more than the anonymous
   *  server probe (own pending listing, admin). */
  initialProduct,
}: {
  initialProduct?: Product;
} = {}) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editRating, setEditRating] = useState(5);
  const [editComment, setEditComment] = useState("");

  // The server probe that produced `initialProduct` is anonymous, so for a
  // visitor without a token it already IS the answer — treating it as fresh
  // skips a second identical round-trip on every product view. A visitor WITH
  // a token can see more than the probe did (their own pending listing, admin),
  // so their copy is seeded as stale and refetched immediately.
  const [seededAt] = useState(() =>
    initialProduct && !tokenStore.get() ? Date.now() : 0,
  );

  const {
    data,
    isLoading,
    isError,
    error: loadError,
    refetch,
  } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: async () => {
      const response = await api.get<Product>(`/products/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
    initialData: initialProduct,
    initialDataUpdatedAt: seededAt,
    // Only governs the seeded copy; `invalidateQueries` after a review still
    // refetches straight away.
    staleTime: 60_000,
  });

  // Fetched independently of the main product query above — it only needs
  // the id from the URL, so it doesn't wait on that request to resolve
  // before firing its own.
  const { data: related } = useQuery<{ data: Product[] }>({
    queryKey: ["product-related", id],
    queryFn: async () => {
      const response = await api.get<{ data: Product[] }>(
        `/products/${id}/related`,
      );
      return response.data;
    },
    enabled: Boolean(id),
    // Matches the main product query's staleTime above — without it this
    // sibling query refetches on every remount while the product next to it
    // stays cached.
    staleTime: 60_000,
  });
  // Guards against a missing/malformed response shape so this
  // nice-to-have section can never crash the rest of the page.
  const relatedProducts = related?.data ?? [];

  // Skips the seller's own listing — visiting your own product page while
  // managing it isn't the kind of "browsing interest" this history is for,
  // and would otherwise clutter the visitor's own recently-viewed rail with
  // their own inventory. Waits on `isAuthLoading` too: `user` starts out
  // `null` before the profile fetch resolves, indistinguishable from a
  // genuinely anonymous visitor — recording while that's still unsettled
  // could record a seller's own product (seeded via `initialData`, so
  // `data` is often ready before auth is) with no way to undo it once auth
  // resolves and reveals they were the owner all along. Called
  // unconditionally (before the loading/error early returns below) since
  // hooks can't be called conditionally; `data` is simply undefined until
  // the product loads.
  useRecordProductView(
    data && !isAuthLoading && user?.id !== data.sellerId
      ? data.id
      : undefined,
  );

  const addToCart = useMutation({
    mutationFn: async () => {
      await api.post("/cart/items", {
        productId: id,
        quantity: MAX_ITEM_QUANTITY,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setSuccess("Agregado al carrito");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos agregarlo al carrito")),
  });

  const createReview = useMutation({
    mutationFn: async () => {
      await api.post<Review>("/reviews", {
        productId: id,
        rating,
        comment: comment || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      setComment("");
      setRating(5);
      setSuccess("Reseña publicada");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos publicar la reseña")),
  });

  const replyToReview = useMutation({
    mutationFn: async (reviewId: string) => {
      await api.patch(`/reviews/${reviewId}/reply`, { reply: replyText });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      setReplyingTo(null);
      setReplyText("");
      setSuccess("Respuesta publicada");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos publicar la respuesta")),
  });

  const updateReview = useMutation({
    mutationFn: async (reviewId: string) => {
      // Unlike creating a review, editing one has an existing comment that
      // has to be overwritable *to blank* — `|| undefined` here (like the
      // create form uses) would drop an emptied field from the request body
      // entirely, which the API reads as "leave the current comment alone"
      // rather than "clear it", so the old text would silently survive.
      await api.patch(`/reviews/${reviewId}`, {
        rating: editRating,
        comment: editComment,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      setEditingReviewId(null);
      setSuccess("Reseña actualizada");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos actualizar tu reseña")),
  });

  const deleteReview = useMutation({
    mutationFn: async (reviewId: string) => {
      await api.delete(`/reviews/${reviewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      setSuccess("Reseña eliminada");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar tu reseña")),
  });

  const toggleHelpful = useMutation({
    mutationFn: async ({
      reviewId,
      voted,
    }: {
      reviewId: string;
      voted: boolean;
    }) => {
      // `voted` is the state *before* this click — true means "un-mark it",
      // matching FavoriteButton's own isFavorite-before-toggle convention.
      if (voted) {
        await api.delete(`/reviews/${reviewId}/helpful`);
      } else {
        await api.post(`/reviews/${reviewId}/helpful`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos registrar tu voto")),
  });

  const loginRedirect = (reason: "cart" | "review" | "helpful") =>
    loginRedirectUrl(id, reason);

  const handleAddToCart = () => {
    setError(null);
    if (!user) {
      router.push(loginRedirect("cart"));
      return;
    }
    addToCart.mutate();
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      router.push(loginRedirect("review"));
      return;
    }
    createReview.mutate();
  };

  const handleReplySubmit = (e: React.FormEvent, reviewId: string) => {
    e.preventDefault();
    setError(null);
    replyToReview.mutate(reviewId);
  };

  const handleEditReviewSubmit = (e: React.FormEvent, reviewId: string) => {
    e.preventDefault();
    setError(null);
    updateReview.mutate(reviewId);
  };

  const handleDeleteReview = (reviewId: string) => {
    setError(null);
    if (confirm("¿Eliminar tu reseña? Esta acción no se puede deshacer.")) {
      deleteReview.mutate(reviewId);
    }
  };

  const handleToggleHelpful = (review: Review) => {
    setError(null);
    if (!user) {
      router.push(loginRedirect("helpful"));
      return;
    }
    toggleHelpful.mutate({ reviewId: review.id, voted: !!review.votedByMe });
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando producto…
        </div>
      </PageContainer>
    );
  }
  // Un 404 sí significa que la prenda no existe; cualquier otro fallo (red,
  // timeout, 500) es temporal. Antes ambos caían en "Producto no encontrado",
  // que le decía al visitante que la prenda se había eliminado cuando en
  // realidad solo había que reintentar.
  const requestFailed = !isTerminalError(loadError, [404]);

  if (isError && !data && requestFailed) {
    return (
      <PageContainer>
        <EmptyState
          title="No pudimos cargar la prenda"
          description="Hubo un problema al conectar con el servidor. Puede ser temporal."
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
      </PageContainer>
    );
  }
  // Only the absence of data is a dead end: a failed refetch on top of the
  // server-rendered product keeps showing the product rather than replacing it
  // with an empty state.
  if (!data) {
    return (
      <PageContainer>
        <EmptyState
          title="Producto no encontrado"
          description="Esta publicación pudo haber sido eliminada o ya no está disponible."
          action={
            <Button
              onClick={() => router.push("/products")}
              variant="secondary"
            >
              Volver al marketplace
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const reviews = data.reviews ?? [];
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;
  const isOwn = user?.id === data.sellerId;
  // A sold listing stays readable — its buyer reaches it from order history and
  // writes the review here — so the page has to say it is gone rather than
  // offering an add-to-cart the API would reject.
  const isSold = data.status === "SOLD";
  // The seller's own temporary-hide toggle: still a normal, approved listing
  // (unlike isSold/isApproved), just not currently buyable — so this only
  // needs to swap out the buy button, not gate the rest of the page.
  const isPaused = Boolean(data.pausedAt);
  const ownReview = user
    ? reviews.find((review) => review.userId === user.id)
    : undefined;

  return (
    <PageContainer size="wide">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Keyed on id + the images themselves (not just id): a same-id
            refetch that changes the picture set (e.g. a moderated-field edit,
            once re-approved) remounts the gallery instead of trying to
            reconcile a stale index against a changed array — see
            ProductGallery's own doc comment for why that reconciliation
            problem doesn't have a good answer. */}
        <ProductGallery
          key={`${id}:${(data.images ?? []).map((img) => img.url).join("|")}`}
          images={data.images ?? []}
          title={data.title}
        />
        <div className="space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-eyebrow">
                  {data.brand ? data.brand : "Versale"}
                </p>
                <h1 className="heading-section mt-1 text-text-primary">
                  {data.title}
                </h1>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <ShareButton
                  productId={data.id}
                  title={data.title}
                  onCopied={() => {
                    setError(null);
                    setSuccess("Enlace copiado");
                    setTimeout(() => setSuccess(null), 3000);
                  }}
                  onError={(message) => {
                    setSuccess(null);
                    setError(message);
                  }}
                />
                {!isOwn && <FavoriteButton productId={data.id} />}
              </div>
            </div>
            <p className="mt-1 text-sm text-text-muted">{data.category}</p>
            {averageRating !== null && (
              <div className="mt-2 flex items-center gap-2">
                <StarRating value={averageRating} />
                <span className="text-sm text-text-muted">
                  {averageRating.toFixed(1)} ({reviews.length} reseña
                  {reviews.length === 1 ? "" : "s"})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <Price value={data.price} className="text-3xl" />
            <span className="text-xs text-text-muted">COP</span>
          </div>

          <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
            {data.description}
          </p>

          {/* Item 4: seller-curated measurements/defects. Hidden entirely when
              absent — an empty section reads as a bug, not as transparency. */}
          {data.measurements && (
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Medidas
              </h2>
              <p className="mt-1 whitespace-pre-line text-sm text-text-primary">
                {data.measurements}
              </p>
            </div>
          )}
          {data.defects && (
            <div className="rounded-lg border border-border bg-surface-muted p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Defectos
              </h2>
              <p className="mt-1 whitespace-pre-line text-sm text-text-primary">
                {data.defects}
              </p>
            </div>
          )}

          <Divider />

          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-text-muted">Talla</dt>
            <dd className="font-medium text-text-primary">{data.size}</dd>
            <dt className="text-text-muted">Condición</dt>
            <dd>
              <Badge>{conditionLabel(data.condition)}</Badge>
            </dd>
            <dt className="text-text-muted">Categoría</dt>
            <dd className="font-medium text-text-primary">{data.category}</dd>
            <dt className="text-text-muted">Vendedor</dt>
            <dd className="font-medium text-text-primary">
              {data.seller ? (
                <Link
                  href={`/vendedores/${data.sellerId}`}
                  className="underline-offset-2 hover:underline"
                >
                  {data.seller.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </dl>

          {/* No quantity picker: each listing is a single secondhand garment, so
              the only quantity the API accepts is `MAX_ITEM_QUANTITY`. A stepper
              here offered 1–99 and every value above 1 came back as a 400. */}
          {isSold ? (
            <Badge variant="warning">Ya se vendió</Badge>
          ) : isOwn ? (
            <Badge variant="info">
              {/* A moderated-field edit sent back to review while paused
                  (isApproved:false, pausedAt still set) is a materially
                  different, more actionable state than "just paused" — the
                  seller still needs re-approval regardless of unpausing, and
                  the plain paused message alone would hide that. */}
              {isPaused && !data.isApproved
                ? "Pausaste esta publicación y además está pendiente de revisión"
                : isPaused
                  ? "Pausaste esta publicación: no la ven los compradores"
                  : "Esta es tu publicación"}
            </Badge>
          ) : isPaused && data.isApproved ? (
            <Badge variant="warning">
              El vendedor pausó esta publicación temporalmente
            </Badge>
          ) : data.isApproved ? (
            <div className="flex items-end gap-3 pt-2">
              <Button
                variant="accent"
                onClick={handleAddToCart}
                disabled={addToCart.isPending}
                size="lg"
              >
                {addToCart.isPending ? "Agregando…" : "Agregar al carrito"}
              </Button>
            </div>
          ) : (
            <Badge variant="warning">Aún no disponible</Badge>
          )}

          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-success" role="status">
              {success}
            </p>
          )}

          {/* Keyed on the product id: this component instance can be reused
              across two different products in a row (e.g. via the related-
              products grid below), and without a remount its own "already
              sent"/open-form/error state would silently survive the
              navigation — see ProductGallery's doc comment for the same
              underlying issue and fix shape. */}
          {!isOwn && <ReportProductButton key={data.id} productId={data.id} />}
        </div>
      </div>

      <section id="resenas" className="mt-12">
        <h2 className="heading-section mb-4 text-text-primary">Reseñas</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-text-muted">Aún no hay reseñas.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {review.user?.name ?? "Anónimo"}
                    </span>
                    {review.verifiedPurchase && (
                      <Badge variant="success">Compra verificada</Badge>
                    )}
                  </div>
                  <StarRating value={review.rating} />
                </div>
                {editingReviewId === review.id ? (
                  <form
                    onSubmit={(e) => handleEditReviewSubmit(e, review.id)}
                    className="mt-3 space-y-3"
                  >
                    <StarRatingInput
                      value={editRating}
                      onChange={setEditRating}
                      idPrefix={`edit-review-${review.id}`}
                    />
                    <Textarea
                      label="Comentario (opcional)"
                      value={editComment}
                      onChange={(e) => setEditComment(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        disabled={updateReview.isPending}
                      >
                        {updateReview.isPending ? "Guardando…" : "Guardar cambios"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingReviewId(null)}
                        disabled={updateReview.isPending}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    {review.comment && (
                      <p className="mt-2 text-sm text-text-primary">
                        {review.comment}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-text-muted">
                      {new Date(review.createdAt).toLocaleDateString("es-CO")}
                    </p>
                  </>
                )}

                {/* A reviewer can't vote on their own review — the API
                    rejects it, and offering the control here would just be a
                    button that always errors. */}
                {review.userId !== user?.id && (
                  <Button
                    size="sm"
                    variant={review.votedByMe ? "accent" : "secondary"}
                    className="mt-3"
                    // `toggleHelpful` is one mutation shared by every review
                    // card, so disabling on `isPending` alone would lock every
                    // OTHER review's button too while this one's request is in
                    // flight — checking `variables` scopes the disabled state
                    // to the review that was actually clicked.
                    disabled={
                      toggleHelpful.isPending &&
                      toggleHelpful.variables?.reviewId === review.id
                    }
                    aria-pressed={!!review.votedByMe}
                    onClick={() => handleToggleHelpful(review)}
                  >
                    {review.votedByMe ? "Útil" : "¿Te fue útil?"}
                    {!!review.helpfulCount && ` (${review.helpfulCount})`}
                  </Button>
                )}

                {review.id === ownReview?.id &&
                  editingReviewId !== review.id && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={deleteReview.isPending}
                        onClick={() => {
                          setEditingReviewId(review.id);
                          setEditRating(review.rating);
                          setEditComment(review.comment ?? "");
                        }}
                      >
                        Editar reseña
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDeleteReview(review.id)}
                        disabled={deleteReview.isPending}
                      >
                        {deleteReview.isPending ? "Eliminando…" : "Eliminar reseña"}
                      </Button>
                    </div>
                  )}

                {review.sellerReply && (
                  <SellerReplyBlock text={review.sellerReply} />
                )}

                {isOwn &&
                  (replyingTo === review.id ? (
                    <form
                      onSubmit={(e) => handleReplySubmit(e, review.id)}
                      className="mt-3 space-y-2"
                    >
                      <Textarea
                        label="Tu respuesta"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={replyToReview.isPending}
                        >
                          {replyToReview.isPending
                            ? "Guardando…"
                            : "Guardar respuesta"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setReplyingTo(null)}
                          disabled={replyToReview.isPending}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-3"
                      onClick={() => {
                        setReplyingTo(review.id);
                        setReplyText(review.sellerReply ?? "");
                      }}
                    >
                      {review.sellerReply ? "Editar respuesta" : "Responder"}
                    </Button>
                  ))}
              </Card>
            ))}
          </div>
        )}

        {/* Once the buyer already has a review on this product, editing it
            happens inline on their own review card above — and a second POST
            for the same listing is rejected outright (one review per buyer,
            enforced by the API and the DB's @@unique([userId, productId])),
            so hiding the form is the only correct UI here. */}
        {user && !isOwn && data.isApproved && !ownReview && (
          <form
            onSubmit={handleReviewSubmit}
            className="mt-6 max-w-md space-y-3 rounded-lg border border-border bg-surface p-4"
          >
            <h3 className="heading-card">Escribe una reseña</h3>
            <StarRatingInput
              value={rating}
              onChange={setRating}
              idPrefix="review"
            />
            <Textarea
              label="Comentario (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Cuéntanos qué te pareció esta prenda"
            />
            <Button type="submit" disabled={createReview.isPending}>
              {createReview.isPending ? "Publicando…" : "Publicar reseña"}
            </Button>
          </form>
        )}
      </section>

      <ProductQuestions
        key={data.id}
        productId={data.id}
        isOwn={isOwn}
        isApproved={data.isApproved}
        questions={data.questions ?? []}
      />

      {!isAuthLoading && !user && (
        <p className="mt-4 text-sm text-text-muted">
          <a
            href={loginRedirect("cart")}
            className="font-medium text-text-primary underline-offset-4 hover:underline"
          >
            Inicia sesión
          </a>{" "}
          para agregar este producto a tu carrito, escribir una reseña o hacer
          una pregunta.
        </p>
      )}

      {relatedProducts.length > 0 && (
        <section className="mt-10">
          <h2 className="heading-section text-text-primary">
            Productos similares
          </h2>
          <div className="products-grid mt-4 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <RecentlyViewed excludeId={data.id} />
    </PageContainer>
  );
}
