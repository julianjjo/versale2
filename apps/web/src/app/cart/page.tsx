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
import type { Cart, CartItem } from "@/lib/types";

const CONDITION_LABELS: Record<string, string> = {
  New: "Nuevo",
  "Like New": "Como nuevo",
  Good: "Buen estado",
  Fair: "Aceptable",
};

function parseQuantity(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  if (n > 99) return 99;
  return n;
}

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
    onError: (err) =>
      setError(extractApiError(err, "No pudimos actualizar el producto")),
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      await api.delete(`/cart/items/${itemId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err) =>
      setError(extractApiError(err, "No pudimos eliminar el producto")),
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      await api.delete("/cart");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
    onError: (err) =>
      setError(extractApiError(err, "No pudimos vaciar el carrito")),
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
    onError: (err) => setError(extractApiError(err, "No pudimos procesar el pago")),
  });

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
          description="Necesitas una cuenta para ver tu carrito."
          action={
            <Button onClick={() => router.push("/login")}>Iniciar sesión</Button>
          }
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando tu carrito…
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
        title="Tu carrito"
        description="Revisa tus productos antes de pagar."
        action={
          items.length > 0 ? (
            <Button
              variant="ghost"
              onClick={() => clearCart.mutate()}
              disabled={clearCart.isPending}
            >
              Vaciar carrito
            </Button>
          ) : null
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="Tu carrito está vacío"
          description="Explora el marketplace y encuentra algo que te encante."
          action={
            <Button onClick={() => router.push("/products")}>
              Explorar productos
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {items.map((item) => (
              <CartItemRow
                key={item.id}
                item={item}
                isUpdating={updateQty.isPending}
                onUpdateQuantity={(quantity) =>
                  updateQty.mutate({ itemId: item.id, quantity })
                }
                onRemove={() => removeItem.mutate(item.id)}
                isRemoving={removeItem.isPending}
              />
            ))}
          </div>

          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <h2 className="heading-card mb-3">Dirección de envío</h2>
              <div className="space-y-3">
                <Input
                  placeholder="Calle y número"
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
                    placeholder="Ciudad"
                    value={shippingAddress.city}
                    onChange={(e) =>
                      setShippingAddress((a) => ({
                        ...a,
                        city: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Departamento"
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
                    placeholder="Código postal"
                    value={shippingAddress.zip}
                    onChange={(e) =>
                      setShippingAddress((a) => ({
                        ...a,
                        zip: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="País"
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
                <span>Envío</span>
                <span>Se calcula al entregar</span>
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
                {checkout.isPending ? "Procesando pedido…" : "Pagar"}
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

function CartItemRow({
  item,
  isUpdating,
  onUpdateQuantity,
  onRemove,
  isRemoving,
}: {
  item: CartItem;
  isUpdating: boolean;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [lastSynced, setLastSynced] = useState(item.quantity);

  // Keep the controlled input in sync when the underlying cart item changes
  // (e.g. after a successful update or when the cart is refetched).
  if (item.quantity !== lastSynced) {
    setLastSynced(item.quantity);
    setQuantity(String(item.quantity));
  }

  const commit = () => {
    const next = parseQuantity(quantity, item.quantity);
    if (next !== item.quantity) {
      onUpdateQuantity(next);
    } else {
      // Reset the input text to the canonical value (e.g. when the user
      // typed "abc" and we fall back to the previous valid quantity).
      setQuantity(String(item.quantity));
    }
  };

  return (
    <Card>
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
              {CONDITION_LABELS[item.product.condition] ??
                item.product.condition}{" "}
              · Talla {item.product.size}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <Input
            type="number"
            min={1}
            max={99}
            value={quantity}
            disabled={isUpdating}
            onChange={(e) => setQuantity(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="w-20"
            aria-label="Cantidad"
          />
          <button
            onClick={onRemove}
            disabled={isRemoving}
            className="text-xs font-medium text-danger transition-colors hover:text-danger/80 disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>
    </Card>
  );
}
