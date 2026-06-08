"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  Spinner,
  Card,
  EmptyState,
  Badge,
  PageContainer,
  SectionHeader,
  Price,
  type BadgeVariant,
} from "@/components/ui";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_VARIANT: Record<OrderStatus, BadgeVariant> = {
  PENDING: "warning",
  PAID: "info",
  SHIPPED: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export default function OrdersPage() {
  const router = useRouter();
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
          description="You need an account to view your orders."
          action={<button onClick={() => router.push("/login")}>Log in</button>}
        />
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
          <Spinner className="h-5 w-5" /> Loading orders…
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer size="default">
      <SectionHeader
        title="Order history"
        description="Track and review your past purchases."
      />
      {data && data.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="Once you place an order, it will appear here."
          action={
            <button onClick={() => router.push("/products")}>
              Browse products
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data?.map((order) => (
            <a
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <Card className="hover:shadow-md">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-text-muted">
                    Order #{order.id.slice(0, 8)}
                  </span>
                  <Badge variant={STATUS_VARIANT[order.status]}>
                    {order.status}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-text-primary">
                  {order.items.length} item
                  {order.items.length === 1 ? "" : "s"} ·{" "}
                  <Price value={order.totalAmount} className="font-semibold" />
                </p>
                <p className="mt-1 text-xs text-text-muted">
                  Placed on {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </Card>
            </a>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
