"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, extractApiError } from "@/lib/api";
import { Spinner, Card, EmptyState, Badge } from "@/components/ui";
import type { Order, OrderStatus } from "@/lib/types";
import { useState } from "react";
import Link from "next/link";

const STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const STATUS_VARIANT: Record<
  OrderStatus,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  PENDING: "warning",
  PAID: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
};

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
      setError(extractApiError(err, "Failed to update status")),
  });

  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
        <Spinner className="h-5 w-5" /> Loading…
      </div>
    );
  }

  const orders = data ?? [];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">All orders</h2>
      {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
      {orders.length === 0 ? (
        <EmptyState title="No orders yet" />
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/orders/${order.id}`}
                    className="font-medium hover:underline"
                  >
                    Order #{order.id.slice(0, 8)}
                  </Link>
                  <p className="text-xs text-zinc-500 mt-1">
                    {order.items.length} item
                    {order.items.length === 1 ? "" : "s"} · $
                    {order.totalAmount.toFixed(2)} ·{" "}
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={order.status}
                    onChange={(e) =>
                      updateStatus.mutate({
                        id: order.id,
                        status: e.target.value as OrderStatus,
                      })
                    }
                    disabled={updateStatus.isPending}
                    className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <Badge variant={STATUS_VARIANT[order.status]}>
                    {order.status}
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
