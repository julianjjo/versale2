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
import { conditionLabel } from "@/lib/product-condition";
import type { Cart, CartItem } from "@/lib/types";


function parseQuantity(raw: string, fallback: number): number {
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  if (n > 99) return 99;
  return n;
}

type ShippingAddress = {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const REQUIRED_ADDRESS_FIELDS: Array<keyof ShippingAddress> = [
  "street",
  "city",
  "country",
];

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "",
  });
  const [addressErrors, setAddressErrors] = useState<
    Partial<Record<keyof ShippingAddress, string>>
  >({});

  const updateAddressField = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress((a) => ({ ...a, [field]: value }));
    setAddressErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const { data, isLoading, isLoadingError, isRefetchError, refetch } = useQuery<Cart>({
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
      productTitle: string;
    }) => {
      await api.patch(`/cart/items/${itemId}`, { quantity });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setAnnouncement(
        `Cantidad de ${variables.productTitle} actualizada a ${variables.quantity}.`,
      );
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos actualizar el producto")),
  });

  const removeItem = useMutation({
    mutationFn: async ({ itemId }: { itemId: string; productTitle: string }) => {
      await api.delete(`/cart/items/${itemId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      setAnnouncement(`${variables.productTitle} se eliminó del carrito.`);
    },
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
      await api.post("/orders", { shippingAddress });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      router.push("/orders");
    },
    onError: (err) => setError(extractApiError(err, "No pudimos procesar el pago")),
  });

  const handleCheckout = () => {
    const errors: Partial<Record<keyof ShippingAddress, string>> = {};
    for (const field of REQUIRED_ADDRESS_FIELDS) {
      if (shippingAddress[field].trim() === "") {
        errors[field] = "Obligatorio";
      }
    }
    if (Object.keys(errors).length > 0) {
      setAddressErrors(errors);
      setError("Completa la dirección de envío para continuar.");
      return;
    }
    setAddressErrors({});
    setError(null);
    checkout.mutate();
  };

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

  if (isLoadingError) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="No pudimos cargar tu carrito"
          description="Ocurrió un error al conectar con el servidor. Intenta de nuevo."
          action={<Button onClick={() => refetch()}>Reintentar</Button>}
        />
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
      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      {isRefetchError && (
        <p
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 rounded-md border border-danger/30 bg-danger/10 px-4 py-2 text-sm text-danger"
        >
          <span>No pudimos actualizar tu carrito.</span>
          <Button variant="ghost" onClick={() => refetch()}>
            Reintentar
          </Button>
        </p>
      )}

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
                  updateQty.mutate({
                    itemId: item.id,
                    quantity,
                    productTitle: item.product?.title ?? "el producto",
                  })
                }
                onRemove={() =>
                  removeItem.mutate({
                    itemId: item.id,
                    productTitle: item.product?.title ?? "el producto",
                  })
                }
                isRemoving={removeItem.isPending}
              />
            ))}
          </div>

          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <h2 className="heading-card mb-3">Dirección de envío</h2>
              <div className="space-y-3">
                <Input
                  label="Calle y número"
                  value={shippingAddress.street}
                  onChange={(e) => updateAddressField("street", e.target.value)}
                  error={addressErrors.street}
                  required
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Ciudad"
                    value={shippingAddress.city}
                    onChange={(e) => updateAddressField("city", e.target.value)}
                    error={addressErrors.city}
                    required
                  />
                  <Input
                    label="Departamento"
                    value={shippingAddress.state}
                    onChange={(e) => updateAddressField("state", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Código postal"
                    value={shippingAddress.zip}
                    onChange={(e) => updateAddressField("zip", e.target.value)}
                  />
                  <Input
                    label="País"
                    value={shippingAddress.country}
                    onChange={(e) => updateAddressField("country", e.target.value)}
                    error={addressErrors.country}
                    required
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
                <span>No incluido</span>
              </div>
              <Divider className="my-3" />
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-text-primary">
                  Total sin envío
                </span>
                <Price value={total} className="text-lg text-text-primary" />
              </div>
              {/* The API's order total is the sum of the items only: there is
                  no shipping calculation anywhere in the product, so the
                  summary says so instead of implying one will appear later. */}
              <p className="mb-4 text-xs leading-[1.5] text-text-muted">
                El costo del envío no está incluido en este total: se acuerda
                con el vendedor al momento de la entrega.
              </p>
              <Button
                variant="accent"
                onClick={handleCheckout}
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
  const [lastSyncedQuantity, setLastSyncedQuantity] = useState(item.quantity);

  // Keep the controlled input in sync when the underlying cart item changes
  // (e.g. after a successful update or when the cart is refetched). Setting
  // state during render rather than in an effect avoids the extra
  // effect-triggered re-render.
  if (item.quantity !== lastSyncedQuantity) {
    setLastSyncedQuantity(item.quantity);
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
              loading="lazy"
              decoding="async"
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
              {conditionLabel(item.product.condition)} · Talla{" "}
              {item.product.size}
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
