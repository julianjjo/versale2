"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  Select,
  Price,
} from "@/components/ui";
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_VARIANT,
} from "@/lib/order-status";
import type { Order, OrderStatus } from "@/lib/types";
import { useState } from "react";
import Link from "next/link";

const STATUSES = ORDER_STATUSES;

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery<Order[]>({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await api.get<Order[]>("/orders/admin/all");
      return res.data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: OrderStatus;
    }) => {
      await api.patch(`/orders/admin/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    },
    onError: (err) =>
      setError(extractApiError(err, "No pudimos cambiar el estado")),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
        <Spinner className="h-5 w-5" /> Cargando…
      </div>
    );
  }

  const orders = data ?? [];

  return (
    <div>
      <h2 className="heading-section mb-4 text-text-primary">
        Todos los pedidos
      </h2>
      {error && (
        <p className="mb-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      {orders.length === 0 ? (
        <EmptyState title="Aún no hay pedidos" />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-mono font-medium text-text-primary hover:underline"
                  >
                    Pedido #{order.id.slice(0, 8)}
                  </Link>
                  <p className="mt-1 text-xs text-text-muted">
                    {order.items.length} producto
                    {order.items.length === 1 ? "" : "s"} ·{" "}
                    <Price value={order.totalAmount} /> ·{" "}
                    {new Date(order.createdAt).toLocaleDateString("es-CO")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    value={order.status}
                    onChange={(e) =>
                      updateStatus.mutate({
                        id: order.id,
                        status: e.target.value as OrderStatus,
                      })
                    }
                    disabled={updateStatus.isPending}
                    aria-label="Estado del pedido"
                    className="w-40 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {ORDER_STATUS_LABEL[s]}
                      </option>
                    ))}
                  </Select>
                  <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
                    {ORDER_STATUS_LABEL[order.status]}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
