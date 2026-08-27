"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Badge,
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
import { getHttpStatus } from "@/lib/http-error";
import type { Cart, CartItem, Order, PaginatedResponse } from "@/lib/types";

export const RECENT_ORDER_WINDOW_MS = 120_000;

function isSold(item: CartItem): boolean {
  return item.product?.status === "SOLD";
}

function isPaused(item: CartItem): boolean {
  return Boolean(item.product?.pausedAt);
}

function isWithdrawn(item: CartItem): boolean {
  return item.product?.status === "WITHDRAWN";
}

function isUnavailable(item: CartItem): boolean {
  return !item.product || (Boolean(item.product.status) && item.product.status !== "AVAILABLE") || item.product.isApproved === false || isPaused(item);
}

function isProductPageViewable(item: CartItem): boolean {
  return !!item.product && item.product.isApproved !== false && item.product.status !== "WITHDRAWN";
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

const INCOMPLETE_ADDRESS_ERROR = "Completa la dirección de envío para continuar.";

export default function CartPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(""), 3000);
    return () => clearTimeout(t);
  }, [announcement]);
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

  const { data, isLoading, isLoadingError, isRefetchError, refetch } =
    useQuery<Cart>({
      queryKey: ["cart"],
      queryFn: async ({ signal }) => {
        const response = await api.get<Cart>("/cart", { signal });
        return response.data;
      },
      enabled: Boolean(user),
    });

  const { data: previousOrdersPage } = useQuery<PaginatedResponse<Order>>({
    queryKey: ["orders", "recent-for-checkout"],
    queryFn: async ({ signal }) => {
      const response = await api.get<PaginatedResponse<Order>>(
        "/orders?limit=5",
        { signal },
      );
      return response.data;
    },
    enabled: Boolean(user),
  });
  const previousOrders = previousOrdersPage?.data;

  function addressFieldValue(value: unknown): string {
    return typeof value === "string" ? value : "";
  }

  const lastShippingAddress = (
    Array.isArray(previousOrders) ? previousOrders : []
  ).find((order) => {
    const address = order.shippingAddress as
      | Record<string, unknown>
      | null
      | undefined;
    return (
      !!address &&
      REQUIRED_ADDRESS_FIELDS.every(
        (field) => addressFieldValue(address[field]).trim() !== "",
      )
    );
  })?.shippingAddress as Record<string, unknown> | undefined;

  const applyLastShippingAddress = () => {
    if (!lastShippingAddress) return;
    setShippingAddress({
      street: addressFieldValue(lastShippingAddress.street),
      city: addressFieldValue(lastShippingAddress.city),
      state: addressFieldValue(lastShippingAddress.state),
      zip: addressFieldValue(lastShippingAddress.zip),
      country: addressFieldValue(lastShippingAddress.country),
    });
    setAddressErrors({});
    setError((prev) => (prev === INCOMPLETE_ADDRESS_ERROR ? null : prev));
    setAnnouncement("Se completó la dirección con la de tu pedido anterior.");
  };

  const removeItem = useMutation({
    mutationFn: async ({
      itemId,
    }: {
      itemId: string;
      productTitle: string;
    }) => {
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

  const removeUnavailableItems = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const results = await Promise.allSettled(
        itemIds.map((itemId) => api.delete(`/cart/items/${itemId}`)),
      );
      const failed = results.find((result) => result.status === "rejected");
      if (failed) {
        throw (failed as PromiseRejectedResult).reason;
      }
    },
    onSuccess: (_data, itemIds) => {
      setError(null);
      setAnnouncement(
        itemIds.length === 1
          ? "Se quitó del carrito la prenda que ya no está disponible."
          : `Se quitaron del carrito ${itemIds.length} prendas que ya no están disponibles.`,
      );
    },
    onError: (err) =>
      setError(
        extractApiError(err, "No pudimos quitar las prendas no disponibles"),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["cart"] }),
  });

  const checkout = useMutation({
    mutationFn: async () => {
      const { data } = await api.post<{ id: string }>('/orders', {
        shippingAddress,
      });
      return data;
    },
    onSuccess: (created) => {
      setShippingAddress({ street: "", city: "", state: "", zip: "", country: "" });
      setAddressErrors({});
      queryClient.invalidateQueries({ queryKey: ['cart'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      router.push(`/orders/${created.id}`);
    },
    onError: async (err) => {
      if (getHttpStatus(err) !== undefined) {
        setError(extractApiError(err, "No pudimos procesar el pago"));
        return;
      }
      try {
        const { data: freshCart } = await api.get<Cart>('/cart');
        if (freshCart.items.length === 0) {
          const { data: recentOrders } = await api.get<
            PaginatedResponse<Order>
          >('/orders?limit=1');
          const justPlaced = recentOrders.data[0];
          const isFreshEnoughToBeOurs =
            justPlaced &&
            Date.now() - new Date(justPlaced.createdAt).getTime() <
              RECENT_ORDER_WINDOW_MS;
          if (isFreshEnoughToBeOurs) {
            setShippingAddress({ street: "", city: "", state: "", zip: "", country: "" });
            setAddressErrors({});
            queryClient.invalidateQueries({ queryKey: ['cart'] });
            queryClient.invalidateQueries({ queryKey: ['orders'] });
            router.push(`/orders/${justPlaced.id}`);
            return;
          }
        }
      } catch {
      }
      setError(extractApiError(err, "No pudimos procesar el pago"));
    },
  });

  const handleCheckout = () => {
    if (checkout.isPending) return;
    const errors: Partial<Record<keyof ShippingAddress, string>> = {};
    for (const field of REQUIRED_ADDRESS_FIELDS) {
      if (shippingAddress[field].trim() === "") {
        errors[field] = "Obligatorio";
      }
    }
    if (Object.keys(errors).length > 0) {
      setAddressErrors(errors);
      setError(INCOMPLETE_ADDRESS_ERROR);
      return;
    }
    if (unavailableItems.length > 0) return;
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
            <Button onClick={() => router.push("/login")}>
              Iniciar sesión
            </Button>
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
  const unavailableItems = items.filter(isUnavailable);
  const total = items.reduce((sum, it) => (isUnavailable(it) ? sum : sum + it.priceAtAdd * it.quantity), 0);

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

      {unavailableItems.length > 0 && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-text-primary"
        >
          <span>
            {unavailableItems.length === 1
              ? "Una prenda de tu carrito ya no está disponible. Quítala para poder pagar."
              : `${unavailableItems.length} prendas de tu carrito ya no están disponibles. Quítalas para poder pagar.`}
          </span>
          <Button
            variant="secondary"
            disabled={removeUnavailableItems.isPending}
            onClick={() =>
              removeUnavailableItems.mutate(
                unavailableItems.map((item) => item.id),
              )
            }
          >
            {removeUnavailableItems.isPending
              ? "Quitando…"
              : unavailableItems.length === 1
                ? "Quitar la prenda no disponible"
                : "Quitar las prendas no disponibles"}
          </Button>
        </div>
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
                onRemove={() =>
                  removeItem.mutate({
                    itemId: item.id,
                    productTitle: item.product?.title ?? "el producto",
                  })
                }
                isRemoving={removeItem.isPending && (removeItem.variables as { itemId: string } | undefined)?.itemId === item.id}
              />
            ))}
          </div>

          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="heading-card">Dirección de envío</h2>
                {lastShippingAddress && (
                  <button
                    type="button"
                    onClick={applyLastShippingAddress}
                    className="rounded-sm text-xs font-medium text-terracotta-deep underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                  >
                    Usar la de tu pedido anterior
                  </button>
                )}
              </div>
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
                    onChange={(e) =>
                      updateAddressField("state", e.target.value)
                    }
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
                    onChange={(e) =>
                      updateAddressField("country", e.target.value)
                    }
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
              <p className="mb-4 text-xs leading-[1.5] text-text-muted">
                El costo del envío no está incluido en este total: se acuerda
                con el vendedor al momento de la entrega.
              </p>
              <Button
                variant="accent"
                onClick={handleCheckout}
                disabled={checkout.isPending || unavailableItems.length > 0}
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
  onRemove,
  isRemoving,
}: {
  item: CartItem;
  onRemove: () => void;
  isRemoving: boolean;
}) {
  const sold = isSold(item);
  const paused = isPaused(item);
  const withdrawn = isWithdrawn(item);
  const unavailable = isUnavailable(item);
  const viewable = isProductPageViewable(item);
  const title = item.product?.title ?? item.productId;

  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="relative flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted text-xs text-text-muted">
          {item.product?.images?.[0] ? (
            <Image
              src={item.product.images[0].url}
              alt={item.product.title}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            "—"
          )}
        </div>
        <div className="min-w-0 flex-1">
          {viewable ? (
            <Link
              href={`/products/${item.productId}`}
              className="block truncate font-medium text-text-primary hover:underline"
            >
              {title}
            </Link>
          ) : (
            <p className="block truncate font-medium text-text-primary">
              {title}
            </p>
          )}
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
          {unavailable && (
            <Badge variant="warning" className="mt-2">
              {sold
                ? "Ya se vendió"
                : withdrawn
                  ? "Retirada por el vendedor"
                  : paused
                    ? "El vendedor la pausó temporalmente"
                    : "Ya no está disponible"}
            </Badge>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-text-muted">
            Cantidad: {item.quantity}
          </span>
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
