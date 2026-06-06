"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Spinner, Card } from "@/components/ui";
import type { Order, Product, User } from "@/lib/types";
import Link from "next/link";

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

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="py-8 flex items-center justify-center gap-2 text-zinc-500">
          <Spinner className="h-5 w-5" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <StatCard
              label="Revenue (USD)"
              value={`$${totalRevenue.toFixed(2)}`}
            />
          </div>

          {orders && orders.length > 0 && (
            <Card>
              <h2 className="font-semibold mb-3">Recent orders</h2>
              <div className="space-y-2">
                {orders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between text-sm border-b border-zinc-100 dark:border-zinc-800 last:border-0 pb-2 last:pb-0"
                  >
                    <span>#{order.id.slice(0, 8)}</span>
                    <span>{order.status}</span>
                    <span className="font-medium">
                      ${order.totalAmount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
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
    <Card className="hover:shadow-md transition-shadow h-full">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
