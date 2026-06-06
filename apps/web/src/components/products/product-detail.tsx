"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { Button, Input, Textarea, Spinner, Card, Badge, EmptyState } from "@/components/ui";
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
      <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
        <Spinner className="h-5 w-5" /> Loading…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <EmptyState
          title="Product not found"
          description="This listing might have been removed or is not available."
          action={
            <Button onClick={() => router.push("/products")} variant="secondary">
              Back to browse
            </Button>
          }
        />
      </div>
    );
  }

  const reviews = (data as Product & { reviews?: Review[] }).reviews ?? [];
  const averageRating =
    reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;
  const isOwn = user?.id === data.sellerId;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-2">
          <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400 overflow-hidden">
            {data.images?.[0] ? (
              <img
                src={data.images[0]}
                alt={data.title}
                className="object-cover w-full h-full"
              />
            ) : (
              "No image"
            )}
          </div>
          {data.images && data.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {data.images.slice(1).map((img, idx) => (
                <div
                  key={idx}
                  className="aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden"
                >
                  <img
                    src={img}
                    alt={`${data.title} ${idx + 2}`}
                    className="object-cover w-full h-full"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <p className="text-zinc-500 mt-1">
            {data.brand ? `${data.brand} · ` : ""}
            {data.category}
          </p>
          {averageRating !== null && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-amber-500">
                {"★".repeat(Math.round(averageRating))}
                {"☆".repeat(5 - Math.round(averageRating))}
              </span>
              <span className="text-sm text-zinc-500">
                {averageRating.toFixed(1)} ({reviews.length} review
                {reviews.length === 1 ? "" : "s"})
              </span>
            </div>
          )}
          <p className="text-3xl font-semibold mt-4">
            ${data.price.toFixed(2)}
          </p>
          <p className="mt-4 text-zinc-700 dark:text-zinc-300 whitespace-pre-line">
            {data.description}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-zinc-500">Size</dt>
            <dd>{data.size}</dd>
            <dt className="text-zinc-500">Condition</dt>
            <dd>
              <Badge>{data.condition}</Badge>
            </dd>
            <dt className="text-zinc-500">Category</dt>
            <dd>{data.category}</dd>
            <dt className="text-zinc-500">Seller</dt>
            <dd>{data.seller?.name ?? "—"}</dd>
          </dl>

          {!isOwn && data.isApproved ? (
            <div className="mt-6 flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) =>
                  setQuantity(Math.max(1, Number(e.target.value)))
                }
                className="w-24"
              />
              <Button
                onClick={handleAddToCart}
                disabled={addToCart.isPending}
              >
                {addToCart.isPending ? "Adding…" : "Add to cart"}
              </Button>
            </div>
          ) : isOwn ? (
            <div className="mt-6">
              <Badge variant="info">This is your listing</Badge>
            </div>
          ) : (
            <div className="mt-6">
              <Badge variant="warning">Not yet available</Badge>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
          {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
        </div>
      </div>

      <section className="mt-12">
        <h2 className="text-lg font-semibold mb-4">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-zinc-500 text-sm">No reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <Card key={review.id}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {review.user?.name ?? "Anonymous"}
                  </span>
                  <span className="text-amber-500 text-sm">
                    {"★".repeat(review.rating)}
                    {"☆".repeat(5 - review.rating)}
                  </span>
                </div>
                {review.comment && (
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                    {review.comment}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-400">
                  {new Date(review.createdAt).toLocaleDateString()}
                </p>
              </Card>
            ))}
          </div>
        )}

        {user && !isOwn && data.isApproved && (
          <form
            onSubmit={handleReviewSubmit}
            className="mt-6 space-y-3 max-w-md"
          >
            <h3 className="text-sm font-semibold">Write a review</h3>
            <div>
              <label className="block text-sm font-medium mb-1">Rating</label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`text-2xl ${
                      n <= rating
                        ? "text-amber-500"
                        : "text-zinc-300 dark:text-zinc-600"
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
            />
            <Button type="submit" disabled={createReview.isPending}>
              {createReview.isPending ? "Posting…" : "Post review"}
            </Button>
          </form>
        )}
      </section>

      {!isAuthLoading && !user && (
        <p className="mt-4 text-sm text-zinc-500">
          <a href="/login" className="underline">
            Log in
          </a>{" "}
          to add this item to your cart or write a review.
        </p>
      )}
    </div>
  );
}
