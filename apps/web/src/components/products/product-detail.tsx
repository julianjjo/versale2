"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import {
  Button,
  Input,
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
import type { Product, Review } from "@/lib/types";

export function ProductDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [quantity, setQuantity] = useState(1);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<Product>({
    queryKey: ["product", id],
    queryFn: async () => {
      const response = await api.get<Product>(`/products/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

  const addToCart = useMutation({
    mutationFn: async () => {
      await api.post("/cart/items", { productId: id, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setSuccess("Added to cart");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => setError(extractApiError(err, "Failed to add to cart")),
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
      setSuccess("Review posted");
      setTimeout(() => setSuccess(null), 3000);
    },
    onError: (err) => setError(extractApiError(err, "Failed to post review")),
  });

  const handleAddToCart = () => {
    setError(null);
    if (!user) {
      router.push("/login");
      return;
    }
    addToCart.mutate();
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!user) {
      router.push("/login");
      return;
    }
    createReview.mutate();
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Loading product…
        </div>
      </PageContainer>
    );
  }
  if (isError || !data) {
    return (
      <PageContainer>
        <EmptyState
          title="Product not found"
          description="This listing might have been removed or is not available."
          action={
            <Button
              onClick={() => router.push("/products")}
              variant="secondary"
            >
              Back to browse
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const reviews = (data as Product & { reviews?: Review[] }).reviews ?? [];
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;
  const isOwn = user?.id === data.sellerId;

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
              <span className="text-sm text-text-muted">No image</span>
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
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-eyebrow">
              {data.brand ? data.brand : "Versale"}
            </p>
            <h1 className="heading-section mt-1 text-text-primary">
              {data.title}
            </h1>
            <p className="mt-1 text-sm text-text-muted">{data.category}</p>
            {averageRating !== null && (
              <div className="mt-2 flex items-center gap-2">
                <StarRating value={averageRating} />
                <span className="text-sm text-text-muted">
                  {averageRating.toFixed(1)} ({reviews.length} review
                  {reviews.length === 1 ? "" : "s"})
                </span>
              </div>
            )}
          </div>

          <div className="flex items-baseline gap-2">
            <Price value={data.price} className="text-3xl font-semibold" />
            <span className="text-xs text-text-muted">USD</span>
          </div>

          <p className="whitespace-pre-line text-sm leading-relaxed text-text-primary">
            {data.description}
          </p>

          <Divider />

          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-text-muted">Size</dt>
            <dd className="font-medium text-text-primary">{data.size}</dd>
            <dt className="text-text-muted">Condition</dt>
            <dd>
              <Badge>{data.condition}</Badge>
            </dd>
            <dt className="text-text-muted">Category</dt>
            <dd className="font-medium text-text-primary">{data.category}</dd>
            <dt className="text-text-muted">Seller</dt>
            <dd className="font-medium text-text-primary">
              {data.seller?.name ?? "—"}
            </dd>
          </dl>

          {!isOwn && data.isApproved ? (
            <div className="flex items-end gap-3 pt-2">
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Number(e.target.value)))
                }
                className="w-24"
                aria-label="Quantity"
              />
              <Button
                onClick={handleAddToCart}
                disabled={addToCart.isPending}
                size="lg"
              >
                {addToCart.isPending ? "Adding…" : "Add to cart"}
              </Button>
            </div>
          ) : isOwn ? (
            <Badge variant="info">This is your listing</Badge>
          ) : (
            <Badge variant="warning">Not yet available</Badge>
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

      <section className="mt-12">
        <h2 className="heading-section mb-4 text-text-primary">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-text-muted">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text-primary">
                    {review.user?.name ?? "Anonymous"}
                  </span>
                  <StarRating value={review.rating} />
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm text-text-primary">
                    {review.comment}
                  </p>
                )}
                <p className="mt-2 text-xs text-text-muted">
                  {new Date(review.createdAt).toLocaleDateString()}
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
            <h3 className="heading-card">Write a review</h3>
            <div>
              <label className="text-sm font-medium text-text-primary">
                Rating
              </label>
              <div className="mt-1 flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`text-2xl transition-colors ${
                      n <= rating
                        ? "text-warning"
                        : "text-border hover:text-text-muted"
                    }`}
                    aria-label={`${n} star${n === 1 ? "" : "s"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <Textarea
              label="Comment (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Share your experience with this item"
            />
            <Button type="submit" disabled={createReview.isPending}>
              {createReview.isPending ? "Posting…" : "Post review"}
            </Button>
          </form>
        )}
      </section>

      {!isAuthLoading && !user && (
        <p className="mt-4 text-sm text-text-muted">
          <a
            href="/login"
            className="font-medium text-text-primary underline-offset-4 hover:underline"
          >
            Log in
          </a>{" "}
          to add this item to your cart or write a review.
        </p>
      )}
    </PageContainer>
  );
}
