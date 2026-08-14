"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
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
  const ratingButtonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const loginRedirect = (reason: "cart" | "review") =>
    `/login?next=${encodeURIComponent(`/products/${id}`)}&reason=${reason}`;

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
  const isSold = Boolean(data.soldAt);

  return (
    <PageContainer size="wide">
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-muted">
            {data.images?.[0] ? (
              <img
                src={data.images[0]}
                alt={data.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm text-text-muted">Sin imagen</span>
            )}
          </div>
          {data.images && data.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {data.images.slice(1).map((img, idx) => (
                <div
                  key={idx}
                  className="aspect-square overflow-hidden rounded-md border border-border bg-surface-muted"
                >
                  <img
                    src={img}
                    alt={`${data.title} ${idx + 2}`}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
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
              {!isOwn && (
                <FavoriteButton productId={data.id} className="flex-shrink-0" />
              )}
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
              {data.seller?.name ?? "—"}
            </dd>
          </dl>

          {/* No quantity picker: each listing is a single secondhand garment, so
              the only quantity the API accepts is `MAX_ITEM_QUANTITY`. A stepper
              here offered 1–99 and every value above 1 came back as a 400. */}
          {isSold ? (
            <Badge variant="warning">Ya se vendió</Badge>
          ) : !isOwn && data.isApproved ? (
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
          ) : isOwn ? (
            <Badge variant="info">Esta es tu publicación</Badge>
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
                  <span className="text-sm font-medium text-text-primary">
                    {review.user?.name ?? "Anónimo"}
                  </span>
                  <StarRating value={review.rating} />
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm text-text-primary">
                    {review.comment}
                  </p>
                )}
                <p className="mt-2 text-xs text-text-muted">
                  {new Date(review.createdAt).toLocaleDateString("es-CO")}
                </p>
              </Card>
            ))}
          </div>
        )}

        {user && !isOwn && data.isApproved && (
          <form
            onSubmit={handleReviewSubmit}
            className="mt-6 max-w-md space-y-3 rounded-lg border border-border bg-surface p-4"
          >
            <h3 className="heading-card">Escribe una reseña</h3>
            <div>
              <span
                id="review-rating-label"
                className="text-sm font-medium text-text-primary"
              >
                Calificación
              </span>
              <div
                role="radiogroup"
                aria-labelledby="review-rating-label"
                className="mt-1 flex items-center gap-1"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    ref={(el) => {
                      ratingButtonRefs.current[n - 1] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={n === rating}
                    tabIndex={n === rating ? 0 : -1}
                    onClick={() => setRating(n)}
                    onKeyDown={(e) => {
                      let next: number | null = null;
                      if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                        next = rating < 5 ? rating + 1 : 1;
                      } else if (
                        e.key === "ArrowLeft" ||
                        e.key === "ArrowDown"
                      ) {
                        next = rating > 1 ? rating - 1 : 5;
                      } else if (e.key === "Home") {
                        next = 1;
                      } else if (e.key === "End") {
                        next = 5;
                      }
                      if (next !== null) {
                        e.preventDefault();
                        setRating(next);
                        ratingButtonRefs.current[next - 1]?.focus();
                      }
                    }}
                    className={`text-2xl transition-colors ${
                      n <= rating
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

      {!isAuthLoading && !user && (
        <p className="mt-4 text-sm text-text-muted">
          <a
            href={loginRedirect("cart")}
            className="font-medium text-text-primary underline-offset-4 hover:underline"
          >
            Inicia sesión
          </a>{" "}
          para agregar este producto a tu carrito o escribir una reseña.
        </p>
      )}
    </PageContainer>
  );
}
