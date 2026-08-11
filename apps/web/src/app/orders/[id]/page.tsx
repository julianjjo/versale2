"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Button,
  PageContainer,
  Price,
  Divider,
} from "@/components/ui";
import { ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT } from "@/lib/order-status";
import type { Order } from "@/lib/types";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data, isLoading, isError } = useQuery<Order>({
    queryKey: ["order", params.id],
    queryFn: async () => {
      const response = await api.get<Order>(`/orders/${params.id}`);
      return response.data;
    },
    enabled: Boolean(user && params.id),
  });

  if (isAuthLoading || isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Cargando pedido…
        </div>
      </PageContainer>
    );
  }

  if (!user) {
    return (
      <PageContainer size="narrow">
        <EmptyState
          title="Inicia sesión"
          description="Necesitas una cuenta para ver este pedido."
          action={
            <Button onClick={() => router.push("/login")}>Iniciar sesión</Button>
          }
        />
      </PageContainer>
    );
  }

  if (isError || !data) {
    return (
      <PageContainer>
        <EmptyState
          title="Pedido no encontrado"
          description="No pudimos encontrar ese pedido."
          action={
            <Button onClick={() => router.push("/orders")}>
              Volver a mis pedidos
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const shipping = data.shippingAddress as Record<string, string> | null;

  return (
    <PageContainer size="default">
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center text-sm font-medium text-text-muted transition-colors hover:text-text-primary"
      >
        ← Volver a mis pedidos
      </Link>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl text-text-primary sm:text-[28px]">
          Pedido <span className="tabular-nums">#{data.id.slice(0, 8)}</span>
        </h1>
        <Badge variant={ORDER_STATUS_VARIANT[data.status]}>
          {ORDER_STATUS_LABEL[data.status]}
        </Badge>
      </div>

      <Card>
        <h2 className="heading-card mb-3">Productos</h2>
        <div className="space-y-3">
          {data.items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
            >
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface-muted text-xs text-text-muted">
                {item.product?.images?.[0] ? (
                  <img
                    src={item.product.images[0]}
                    alt={item.product.title}
                    loading={index === 0 ? undefined : "lazy"}
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
                {item.product && (
                  <p className="text-xs text-text-muted">
                    {item.product.condition} · Talla {item.product.size}
                  </p>
                )}
                <p className="mt-1 text-sm text-text-muted">
                  <Price value={item.price} /> × {item.quantity}
                </p>
              </div>
              <div className="font-semibold">
                <Price value={item.price * item.quantity} />
              </div>
            </div>
          ))}
        </div>
        <Divider className="my-4" />
        <div className="flex items-center justify-between">
          <span className="font-semibold text-text-primary">Total</span>
          <Price
            value={data.totalAmount}
            className="text-lg font-semibold text-text-primary"
          />
        </div>
      </Card>

      {shipping && Object.keys(shipping).length > 0 && (
        <Card className="mt-4">
          <h2 className="heading-card mb-3">Dirección de envío</h2>
          <div className="space-y-1 text-sm text-text-primary">
            {shipping.street && <p>{shipping.street}</p>}
            {(shipping.city || shipping.state || shipping.zip) && (
              <p>
                {[shipping.city, shipping.state, shipping.zip]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            )}
            {shipping.country && <p>{shipping.country}</p>}
          </div>
        </Card>
      )}

      <Card className="mt-4">
        <h2 className="heading-card mb-2">Detalles del pedido</h2>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-muted">Realizado el</dt>
            <dd className="text-text-primary">
              {new Date(data.createdAt).toLocaleString("es-CO")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Última actualización</dt>
            <dd className="text-text-primary">
              {new Date(data.updatedAt).toLocaleString("es-CO")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Estado</dt>
            <dd>
              <Badge variant={ORDER_STATUS_VARIANT[data.status]}>
                {ORDER_STATUS_LABEL[data.status]}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>
    </PageContainer>
  );
}
