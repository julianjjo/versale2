"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Button,
  Input,
  PageContainer,
  SectionHeader,
  Price,
} from "@/components/ui";
import { Pager } from "@/components/admin/pager";
import { ORDER_STATUS_LABEL, ORDER_STATUS_VARIANT } from "@/lib/order-status";
import type { Order } from "@/lib/types";

function shippingAddressLine(address: Record<string, unknown>): string {
  const city = typeof address.city === "string" ? address.city : "";
  const state = typeof address.state === "string" ? address.state : "";
  return [city, state].filter(Boolean).join(", ") || "—";
}

export default function MisVentasPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  // Keyed by order id: several "Marcar como enviado" forms can be open on the
  // same page, each with its own in-progress tracking number draft.
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>(
    {},
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["mis-ventas", page],
    queryFn: async () => {
      const res = await api.get<{
        data: Order[];
        meta: { total: number; page: number; pages: number };
      }>(`/orders/mine/sales?page=${page}&limit=10`);
      return res.data;
    },
    enabled: Boolean(user),
  });

  const ship = useMutation({
    mutationFn: async ({
      orderId,
      trackingNumber,
    }: {
      orderId: string;
      trackingNumber: string;
    }) => {
      await api.patch(`/orders/mine/sales/${orderId}/ship`, {
        trackingNumber: trackingNumber || undefined,
      });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["mis-ventas"] });
    },
    onError: (err) =>
      setError(
        extractApiError(err, "No pudimos marcar el pedido como enviado"),
      ),
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
          description="Necesitas una cuenta para ver tus ventas."
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
          <Spinner className="h-5 w-5" /> Cargando ventas…
        </div>
      </PageContainer>
    );
  }

  const orders = data?.data ?? [];
  const meta = data?.meta;

  return (
    <PageContainer>
      <SectionHeader
        title="Mis ventas"
        description="Gestiona el envío de los productos que has vendido."
      />

      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {orders.length === 0 ? (
        <EmptyState
          title="Aún no tienes ventas"
          description="Cuando alguien compre uno de tus productos, aparecerá aquí."
        />
      ) : (
        <div className="space-y-3" aria-busy={isFetching}>
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-text-muted">
                  Pedido #{order.id.slice(0, 8)}
                </span>
                <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
                  {ORDER_STATUS_LABEL[order.status]}
                </Badge>
              </div>
              <p className="mt-2 text-sm text-text-primary">
                Comprador: {order.user?.name ?? "—"}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                Enviar a: {shippingAddressLine(order.shippingAddress)}
              </p>
              <ul className="mt-2 space-y-1">
                {order.items.map((item) => (
                  <li key={item.id} className="text-sm text-text-primary">
                    {item.product?.title ?? "Producto eliminado"} ·{" "}
                    <Price value={item.price} />
                  </li>
                ))}
              </ul>

              {order.trackingNumber && (
                <p className="mt-2 text-xs text-text-muted">
                  Guía de envío: {order.trackingNumber}
                </p>
              )}

              {order.status === "PAID" && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setError(null);
                    ship.mutate({
                      orderId: order.id,
                      trackingNumber: trackingDrafts[order.id] ?? "",
                    });
                  }}
                  className="mt-3 flex flex-wrap items-end gap-2"
                >
                  <Input
                    label="Número de guía (opcional)"
                    value={trackingDrafts[order.id] ?? ""}
                    onChange={(e) =>
                      setTrackingDrafts((drafts) => ({
                        ...drafts,
                        [order.id]: e.target.value,
                      }))
                    }
                    className="max-w-xs"
                  />
                  <Button type="submit" size="sm" disabled={ship.isPending}>
                    {ship.isPending ? "Guardando…" : "Marcar como enviado"}
                  </Button>
                </form>
              )}
            </Card>
          ))}
        </div>
      )}

      <Pager
        page={page}
        pages={meta?.pages ?? 0}
        isFetching={isFetching}
        onPageChange={setPage}
      />
    </PageContainer>
  );
}
