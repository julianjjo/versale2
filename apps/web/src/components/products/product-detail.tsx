"use client";

import { useQuery } from "@tanstack/react-query";
import { createApi } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tokenStore } from "@/lib/token";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const api = createApi(API_URL);

export function ProductDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const queryClient = useQueryClient();
  const [quantity, setQuantity] = useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const response = await api.get<Product>(`/products/${id}`);
      return response.data;
    },
    enabled: Boolean(id),
  });

  const addToCart = useMutation({
    mutationFn: async () => {
      if (!tokenStore.get()) throw new Error("Please log in to add items to your cart");
      await api.post("/cart/items", { productId: id, quantity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      alert("Added to cart");
    },
  });

  if (isLoading) return <p className="p-8 text-zinc-500">Loading…</p>;
  if (isError || !data) return <p className="p-8 text-red-500">Product not found.</p>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="aspect-square bg-zinc-100 dark:bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-400">
          {data.images?.[0] ? (
            <img src={data.images[0]} alt={data.title} className="object-cover w-full h-full rounded-lg" />
          ) : (
            "No image"
          )}
        </div>
        <div>
          <h1 className="text-2xl font-semibold">{data.title}</h1>
          <p className="text-zinc-500 mt-1">
            {data.brand ? `${data.brand} · ` : ""}
            {data.category}
          </p>
          <p className="text-3xl font-semibold mt-4">${data.price.toFixed(2)}</p>
          <p className="mt-4 text-zinc-700 dark:text-zinc-300">{data.description}</p>
          <dl className="mt-6 grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-zinc-500">Size</dt>
            <dd>{data.size}</dd>
            <dt className="text-zinc-500">Condition</dt>
            <dd>{data.condition}</dd>
            <dt className="text-zinc-500">Seller</dt>
            <dd>{data.seller?.name ?? "—"}</dd>
          </dl>

          <div className="mt-6 flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              className="w-20 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
            />
            <button
              onClick={() => addToCart.mutate()}
              disabled={addToCart.isPending}
              className="rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-4 py-2 hover:opacity-90 disabled:opacity-50"
            >
              {addToCart.isPending ? "Adding…" : "Add to cart"}
            </button>
          </div>
          {addToCart.error && (
            <p className="mt-2 text-sm text-red-500">
              {(addToCart.error as Error).message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
