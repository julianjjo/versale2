"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createApi } from "@/lib/api";
import { tokenStore } from "@/lib/token";
import Link from "next/link";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const api = createApi(API_URL);

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isAuthed = typeof window !== "undefined" && tokenStore.get() !== null;

  const { data, isLoading } = useQuery({
    queryKey: ["cart"],
    queryFn: async () => {
      const response = await api.get("/cart");
      return response.data;
    },
    enabled: isAuthed,
  });

  const updateQty = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      await api.patch(`/cart/items/${itemId}`, { quantity });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/cart/items/${itemId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const checkout = useMutation({
    mutationFn: async () => {
      await api.post("/orders", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push("/orders");
    },
  });

  if (!isAuthed) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p>Please <Link href="/login" className="underline">log in</Link> to view your cart.</p>
      </div>
    );
  }

  if (isLoading) return <p className="p-8 text-zinc-500">Loading…</p>;

  const items = data?.items ?? [];
  const total = items.reduce(
    (sum: number, it: { priceAtAdd: number; quantity: number }) => sum + it.priceAtAdd * it.quantity,
    0,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Your cart</h1>
      {items.length === 0 ? (
        <p className="text-zinc-500">Your cart is empty. <Link href="/products" className="underline">Browse products</Link>.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item: { id: string; productId: string; quantity: number; priceAtAdd: number; product?: { title: string; size: string; condition: string } }) => (
            <div key={item.id} className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <p className="font-medium">{item.product?.title ?? item.productId}</p>
                <p className="text-sm text-zinc-500">${item.priceAtAdd.toFixed(2)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  defaultValue={item.quantity}
                  onBlur={(e) => {
                    const q = Math.max(1, Number(e.target.value));
                    if (q !== item.quantity) updateQty.mutate({ itemId: item.id, quantity: q });
                  }}
                  className="w-16 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1"
                />
                <button
                  onClick={() => removeItem.mutate(item.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-4">
            <span className="text-lg font-semibold">Total: ${total.toFixed(2)}</span>
            <button
              onClick={() => checkout.mutate()}
              disabled={checkout.isPending}
              className="rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-4 py-2 hover:opacity-90 disabled:opacity-50"
            >
              {checkout.isPending ? "Placing order…" : "Checkout"}
            </button>
          </div>
          {checkout.error && (
            <p className="text-sm text-red-500">
              {(checkout.error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                "Checkout failed"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
