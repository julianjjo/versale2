"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Spinner, Card, EmptyState, Badge } from "@/components/ui";
import type { Order, OrderStatus } from "@/lib/types";

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

export default function OrdersPage() {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data, isLoading } = useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: async () => {
      const response = await api.get<Order[]>("/orders");
      return response.data;
    },
    enabled: Boolean(user),
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
          description="You need an account to view your orders."
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold mb-6">Order history</h1>
      {data && data.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Once you place an order, it will appear here."
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
        <div className="space-y-3">
          {data?.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block hover:shadow-md transition-shadow"
            >
              <Card>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-500">
                    Order #{order.id.slice(0, 8)}
                  </span>
                  <Badge variant={STATUS_VARIANT[order.status]}>
                    {order.status}
                  </Badge>
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300">
                  {order.items.length} item
                  {order.items.length === 1 ? "" : "s"} · $
                  {order.totalAmount.toFixed(2)}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Placed on {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
