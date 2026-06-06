"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Button,
  Input,
  Card,
  EmptyState,
  Spinner,
} from "@/components/ui";
import type { Cart } from "@/lib/types";

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [shippingAddress, setShippingAddress] = useState({
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "",
  });

  const { data, isLoading } = useQuery<Cart>({
    queryKey: ["cart"],
    queryFn: async () => {
      const response = await api.get<Cart>("/cart");
      return response.data;
    },
    enabled: Boolean(user),
  });

  const updateQty = useMutation({
    mutationFn: async ({
      itemId,
      quantity,
    }: {
      itemId: string;
      quantity: number;
    }) => {
      await api.patch(`/cart/items/${itemId}`, { quantity });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err) => setError(extractApiError(err, "Failed to update item")),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/cart/items/${itemId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err) => setError(extractApiError(err, "Failed to remove item")),
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      await api.delete("/cart");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err) => setError(extractApiError(err, "Failed to clear cart")),
  });

  const checkout = useMutation({
    mutationFn: async () => {
      const hasAddress = Object.values(shippingAddress).some(
        (v) => v.trim() !== "",
      );
      await api.post("/orders", hasAddress ? { shippingAddress } : {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push("/orders");
    },
    onError: (err) => setError(extractApiError(err, "Checkout failed")),
  });

  if (isAuthLoading) {
    return (
      <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
        <Spinner className="h-5 w-5" /> Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <EmptyState
          title="Please log in"
          description="You need an account to view your cart."
          action={
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-4 py-2 text-sm"
            >
              Log in
            </Link>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
        <Spinner className="h-5 w-5" /> Loading…
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = items.reduce(
    (sum, it) => sum + it.priceAtAdd * it.quantity,
    0,
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Your cart</h1>
        {items.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => clearCart.mutate()}
            disabled={clearCart.isPending}
          >
            Clear cart
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="Browse the marketplace to find something you love."
          action={
            <Link
              href="/products"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-4 py-2 text-sm"
            >
              Browse products
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 bg-zinc-100 dark:bg-zinc-800 rounded-md flex items-center justify-center text-zinc-400 text-xs flex-shrink-0 overflow-hidden">
                    {item.product?.images?.[0] ? (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.title}
                        className="object-cover w-full h-full"
                      />
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/products/${item.productId}`}
                      className="font-medium hover:underline block truncate"
                    >
                      {item.product?.title ?? item.productId}
                    </Link>
                    <p className="text-xs text-zinc-500 mt-1">
                      ${item.priceAtAdd.toFixed(2)} each
                    </p>
                    {item.product && (
                      <p className="text-xs text-zinc-500 mt-1">
                        {item.product.condition} · Size {item.product.size}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Input
                      type="number"
                      min={1}
                      defaultValue={item.quantity}
                      onBlur={(e) => {
                        const q = Math.max(1, Number(e.target.value));
                        if (q !== item.quantity) {
                          updateQty.mutate({
                            itemId: item.id,
                            quantity: q,
                          });
                        }
                      }}
                      className="w-20"
                    />
                    <button
                      onClick={() => removeItem.mutate(item.id)}
                      disabled={removeItem.isPending}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <Card>
              <h2 className="font-semibold mb-3">Shipping address</h2>
              <div className="space-y-2">
                <Input
                  placeholder="Street"
                  value={shippingAddress.street}
                  onChange={(e) =>
                    setShippingAddress((a) => ({
                      ...a,
                      street: e.target.value,
                    }))
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="City"
                    value={shippingAddress.city}
                    onChange={(e) =>
                      setShippingAddress((a) => ({
                        ...a,
                        city: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="State"
                    value={shippingAddress.state}
                    onChange={(e) =>
                      setShippingAddress((a) => ({
                        ...a,
                        state: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="ZIP"
                    value={shippingAddress.zip}
                    onChange={(e) =>
                      setShippingAddress((a) => ({
                        ...a,
                        zip: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Country"
                    value={shippingAddress.country}
                    onChange={(e) =>
                      setShippingAddress((a) => ({
                        ...a,
                        country: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-500">Subtotal</span>
                <span className="font-medium">${total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-sm text-zinc-500">
                <span>Shipping</span>
                <span>Calculated at delivery</span>
              </div>
              <div className="border-t border-zinc-200 dark:border-zinc-800 my-3" />
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold">Total</span>
                <span className="font-semibold text-lg">
                  ${total.toFixed(2)}
                </span>
              </div>
              <Button
                onClick={() => checkout.mutate()}
                disabled={checkout.isPending}
                fullWidth
              >
                {checkout.isPending ? "Placing order…" : "Checkout"}
              </Button>
            </Card>

            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
