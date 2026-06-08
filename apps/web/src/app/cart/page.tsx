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
  PageContainer,
  SectionHeader,
  Price,
  Divider,
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
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Loading…
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Please log in"
          description="You need an account to view your cart."
          action={
            <Button onClick={() => router.push("/login")}>Log in</Button>
          }
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Loading cart…
        </div>
      </PageContainer>
    );
  }

  const items = data?.items ?? [];
  const total = items.reduce(
    (sum, it) => sum + it.priceAtAdd * it.quantity,
    0,
  );

  return (
    <PageContainer size="default">
      <SectionHeader
        title="Your cart"
        description="Review your items before checkout."
        action={
          items.length > 0 ? (
            <Button
              variant="ghost"
              onClick={() => clearCart.mutate()}
              disabled={clearCart.isPending}
            >
              Clear cart
            </Button>
          ) : null
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="Your cart is empty"
          description="Browse the marketplace to find something you love."
          action={
            <Button onClick={() => router.push("/products")}>
              Browse products
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {items.map((item) => (
              <Card key={item.id}>
                <div className="flex items-start gap-4">
                  <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted text-xs text-text-muted">
                    {item.product?.images?.[0] ? (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      "—"
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${item.productId}`}
                      className="block truncate font-medium text-text-primary hover:underline"
                    >
                      {item.product?.title ?? item.productId}
                    </Link>
                    <Price
                      value={item.priceAtAdd}
                      className="mt-1 text-xs text-text-muted"
                    />
                    {item.product && (
                      <p className="mt-1 text-xs text-text-muted">
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
                          updateQty.mutate({ itemId: item.id, quantity: q });
                        }
                      }}
                      className="w-20"
                      aria-label="Quantity"
                    />
                    <button
                      onClick={() => removeItem.mutate(item.id)}
                      disabled={removeItem.isPending}
                      className="text-xs font-medium text-danger transition-colors hover:text-danger/80"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <h2 className="heading-card mb-3">Shipping address</h2>
              <div className="space-y-3">
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
                <div className="grid grid-cols-2 gap-3">
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
                <div className="grid grid-cols-2 gap-3">
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
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">Subtotal</span>
                <Price value={total} />
              </div>
              <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
                <span>Shipping</span>
                <span>Calculated at delivery</span>
              </div>
              <Divider className="my-3" />
              <div className="mb-4 flex items-center justify-between">
                <span className="font-semibold text-text-primary">Total</span>
                <Price
                  value={total}
                  className="text-lg font-semibold text-text-primary"
                />
              </div>
              <Button
                onClick={() => checkout.mutate()}
                disabled={checkout.isPending}
                fullWidth
                size="lg"
              >
                {checkout.isPending ? "Placing order…" : "Checkout"}
              </Button>
            </Card>

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
