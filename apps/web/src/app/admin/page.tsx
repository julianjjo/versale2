"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { api } from "@/lib/api";
import { Spinner, Card, Price } from "@/components/ui";
import type { Order, Product, User } from "@/lib/types";

export default function AdminOverview() {
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const res = await api.get<{
        data: Product[];
        meta: { total: number };
      }>("/products/admin/all?limit=1");
      return res.data;
    },
  });

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const res = await api.get<Order[]>("/orders/admin/all");
      return res.data;
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await api.get<User[]>("/users");
      return res.data;
    },
  });

  const pendingProducts = products?.meta.total ?? 0;
  const totalOrders = orders?.length ?? 0;
  const totalUsers = users?.length ?? 0;
  const totalRevenue = orders
    ?.filter((o) => o.status !== "CANCELLED")
    .reduce((sum, o) => sum + o.totalAmount, 0) ?? 0;

  const loading = productsLoading || ordersLoading || usersLoading;

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
        <Spinner className="h-5 w-5" /> Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Pending products"
          value={pendingProducts}
          href="/admin/products"
        />
        <StatCard
          label="Total orders"
          value={totalOrders}
          href="/admin/orders"
        />
        <StatCard
          label="Total users"
          value={totalUsers}
          href="/admin/users"
        />
        <StatCard label="Revenue (USD)" value={`$${totalRevenue.toFixed(2)}`} />
      </div>

      {orders && orders.length > 0 && (
        <Card>
          <h2 className="heading-card mb-3">Recent orders</h2>
          <div className="divide-y divide-border">
            {orders.slice(0, 5).map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between py-2 text-sm first:pt-0 last:pb-0"
              >
                <span className="font-mono text-text-muted">
                  #{order.id.slice(0, 8)}
                </span>
                <span className="text-text-primary">{order.status}</span>
                <Price
                  value={order.totalAmount}
                  className="font-semibold"
                />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const inner = (
    <Card className="h-full transition-shadow hover:shadow-md">
      <p className="text-eyebrow">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-text-primary">
        {value}
      </p>
    </Card>
  );
  return href ? (
    <Link
      href={href}
      className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}
