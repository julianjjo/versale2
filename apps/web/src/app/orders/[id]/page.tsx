"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
} from "@/components/ui";
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

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
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
          description="You need an account to view this order."
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

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <EmptyState
          title="Order not found"
          description="We couldn't find that order."
          action={
            <Link
              href="/orders"
              className="inline-flex items-center justify-center rounded-md bg-zinc-900 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-900 px-4 py-2 text-sm"
            >
              Back to orders
            </Link>
          }
        />
      </div>
    );
  }

  const shipping = data.shippingAddress as Record<string, string> | null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/orders"
        className="text-sm text-zinc-500 hover:underline mb-4 inline-block"
      >
        ← Back to orders
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">
          Order #{data.id.slice(0, 8)}
        </h1>
        <Badge variant={STATUS_VARIANT[data.status]}>{data.status}</Badge>
      </div>

      <Card>
        <h2 className="font-semibold mb-3">Items</h2>
        <div className="space-y-3">
          {data.items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0 pb-3 last:pb-0"
            >
              <div className="w-16 h-16 bg-zinc-100 dark:bg-zinc-800 rounded-md flex items-center justify-center text-zinc-400 text-xs overflow-hidden flex-shrink-0">
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
                {item.product && (
                  <p className="text-xs text-zinc-500">
                    {item.product.condition} · Size {item.product.size}
                  </p>
                )}
                <p className="text-sm text-zinc-500 mt-1">
                  ${item.price.toFixed(2)} × {item.quantity}
                </p>
              </div>
              <div className="font-semibold">
                ${(item.price * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 mt-4 pt-4 flex items-center justify-between">
          <span className="font-semibold">Total</span>
          <span className="text-lg font-semibold">
            ${data.totalAmount.toFixed(2)}
          </span>
        </div>
      </Card>

      {shipping && Object.keys(shipping).length > 0 && (
        <Card className="mt-4">
          <h2 className="font-semibold mb-3">Shipping address</h2>
          <div className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1">
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
        <h2 className="font-semibold mb-2">Order details</h2>
        <dl className="text-sm space-y-1">
          <div className="flex justify-between">
            <dt className="text-zinc-500">Placed on</dt>
            <dd>{new Date(data.createdAt).toLocaleString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Last updated</dt>
            <dd>{new Date(data.updatedAt).toLocaleString()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-zinc-500">Status</dt>
            <dd>
              <Badge variant={STATUS_VARIANT[data.status]}>
                {data.status}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
